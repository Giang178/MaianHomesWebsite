import http from 'k6/http';
import {check} from 'k6';
import {
  guardLoadTarget,
  maybeProbeTargetReadiness,
  probeTargetReadiness,
} from './target_guard.js';

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:activity-list}': ['p(95)<500'],
    load_readiness_failed: ['rate==0'],
  },
};

const target = guardLoadTarget();
const baseUrl = target.baseUrl;
const cookie = __ENV.AUTH_COOKIE || '';

export function setup() {
  probeTargetReadiness(target, true, 'before');
}

export default function () {
  maybeProbeTargetReadiness(target);
  const response = http.get(
    `${baseUrl}/api/protected/activity-events?limit=50&module=${__ENV.MODULE || 'HR'}`,
    {headers: {Cookie: cookie}, tags: {name: 'activity-list'}},
  );
  check(response, {
    'activity list returns 200': result => result.status === 200,
    'activity list has cursor contract': result => {
      try {
        const payload = result.json();
        return Array.isArray(payload.items) && Object.hasOwn(payload, 'next_cursor');
      } catch {
        return false;
      }
    },
  });
}

export function teardown() {
  probeTargetReadiness(target, true, 'after');
}
