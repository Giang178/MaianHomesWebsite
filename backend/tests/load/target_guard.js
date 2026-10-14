import http from 'k6/http';
import { check } from 'k6';
import execution from 'k6/execution';
import { Rate } from 'k6/metrics';

const PRODUCTION_HOSTS = new Set([
  'maianhomes.vn',
  'www.maianhomes.vn',
  'admin.maianhomes.vn',
]);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const STAGING_HOST_PATTERN = /(^|[.-])(staging|stage|perf|loadtest|load-test)([.-]|$)/i;

export const readinessFailureRate = new Rate('load_readiness_failed');

function requiredEnvironment(name) {
  const value = String(__ENV[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('BASE_URL must be explicitly configured');

  const match = /^(https?):\/\/([^/?#]+)$/i.exec(normalized);
  if (!match || match[2].includes('@')) {
    throw new Error('BASE_URL must contain only http(s) scheme, host, and optional port');
  }

  const authority = match[2];
  let hostname;
  let port = '';
  if (authority.startsWith('[')) {
    const bracket = authority.indexOf(']');
    if (bracket < 0) throw new Error('BASE_URL contains an invalid IPv6 hostname');
    hostname = authority.slice(0, bracket + 1).toLowerCase();
    const remainder = authority.slice(bracket + 1);
    if (remainder) {
      if (!/^:\d+$/.test(remainder)) throw new Error('BASE_URL contains an invalid port');
      port = remainder.slice(1);
    }
  } else {
    const parts = authority.split(':');
    if (parts.length > 2) throw new Error('IPv6 hostnames in BASE_URL must use brackets');
    hostname = parts[0].toLowerCase().replace(/\.$/, '');
    port = parts[1] || '';
  }

  if (!hostname || (!hostname.startsWith('[') && !/^[a-z0-9.-]+$/i.test(hostname))) {
    throw new Error('BASE_URL contains an invalid hostname');
  }
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw new Error('BASE_URL port must be between 1 and 65535');
  }
  return { baseUrl: normalized, hostname };
}

export function guardLoadTarget(value = __ENV.BASE_URL) {
  const target = parseBaseUrl(value);
  if (PRODUCTION_HOSTS.has(target.hostname)) {
    throw new Error(`Refusing to run a load test against production host ${target.hostname}`);
  }

  const mode = requiredEnvironment('LOAD_TEST_TARGET').toLowerCase();
  if (mode === 'local') {
    if (!LOOPBACK_HOSTS.has(target.hostname)) {
      throw new Error('Local load tests are restricted to a loopback hostname');
    }
    if (__ENV.CONFIRM_LOCAL_TARGET !== `local:${target.hostname}:disposable`) {
      throw new Error('CONFIRM_LOCAL_TARGET must confirm the exact disposable loopback target');
    }
  } else if (mode === 'staging') {
    if (!STAGING_HOST_PATTERN.test(target.hostname)) {
      throw new Error('Remote load tests require a hostname containing staging/stage/perf/loadtest');
    }
    if (requiredEnvironment('EXPECTED_TARGET_HOST').toLowerCase() !== target.hostname) {
      throw new Error('EXPECTED_TARGET_HOST does not match BASE_URL');
    }
    if (__ENV.CONFIRM_STAGING_TARGET !== `staging:${target.hostname}`) {
      throw new Error('CONFIRM_STAGING_TARGET must explicitly confirm the staging hostname');
    }
  } else {
    throw new Error('LOAD_TEST_TARGET must be staging or local');
  }

  return { ...target, mode };
}

function expectedReadinessIdentity(target) {
  const identity = {
    release: requiredEnvironment('EXPECTED_RELEASE'),
    imageRevision: requiredEnvironment('EXPECTED_IMAGE_REVISION'),
    marker: requiredEnvironment('EXPECTED_LOAD_TEST_MARKER'),
    deploymentTier: requiredEnvironment('EXPECTED_DEPLOYMENT_TIER'),
  };
  if (target.mode === 'staging' && identity.deploymentTier !== 'staging') {
    throw new Error('Remote load tests require EXPECTED_DEPLOYMENT_TIER=staging');
  }
  if (target.mode === 'staging' && !/^[0-9a-f]{7,40}$/i.test(identity.imageRevision)) {
    throw new Error('Remote load tests require an immutable Git SHA in EXPECTED_IMAGE_REVISION');
  }
  return identity;
}

export function probeTargetReadiness(target, fatal = false, phase = 'periodic') {
  const expected = expectedReadinessIdentity(target);
  const response = http.get(`${target.baseUrl}/health/ready`, {
    redirects: 0,
    responseType: 'text',
    timeout: __ENV.READINESS_REQUEST_TIMEOUT || '15s',
    tags: { traffic_class: 'guard', workload: `readiness-${phase}` },
  });

  let payload = null;
  let failure = '';
  if (response.status !== 200) {
    failure = `HTTP ${response.status}`;
  } else {
    try {
      payload = response.json();
    } catch {
      failure = 'malformed JSON';
    }
  }
  if (!failure && payload.status !== 'ready') failure = 'status is not ready';
  if (!failure && payload.release !== expected.release) failure = 'release mismatch';
  if (!failure && payload.image_revision !== expected.imageRevision) {
    failure = 'baked image revision mismatch';
  }
  if (!failure && payload.load_test_marker !== expected.marker) failure = 'load-test marker mismatch';
  if (!failure && payload.deployment_tier !== expected.deploymentTier) {
    failure = 'deployment tier mismatch';
  }

  readinessFailureRate.add(Boolean(failure), { phase });
  check(response, {
    [`${phase} readiness identity matches`]: () => !failure,
  }, { traffic_class: 'guard', workload: `readiness-${phase}` });

  if (failure && fatal) {
    throw new Error(`Target readiness identity check failed (${phase}): ${failure}`);
  }
  return !failure;
}

let nextPeriodicProbeAt = 0;

export function maybeProbeTargetReadiness(target) {
  if (__VU !== 1) return true;
  const rawInterval = String(__ENV.READINESS_PROBE_INTERVAL_SECONDS || '30');
  if (!/^\d+$/.test(rawInterval)) {
    throw new Error('READINESS_PROBE_INTERVAL_SECONDS must be an integer');
  }
  const intervalSeconds = Number(rawInterval);
  if (intervalSeconds < 15 || intervalSeconds > 300) {
    throw new Error('READINESS_PROBE_INTERVAL_SECONDS must be between 15 and 300');
  }
  const now = Date.now();
  if (now < nextPeriodicProbeAt) return true;
  nextPeriodicProbeAt = now + (intervalSeconds * 1000);
  const ready = probeTargetReadiness(target, false, 'periodic');
  if (!ready) {
    execution.test.abort(
      'Periodic target readiness identity check failed; aborting all load generation',
    );
  }
  return ready;
}
