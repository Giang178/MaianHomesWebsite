import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  guardLoadTarget,
  maybeProbeTargetReadiness,
  probeTargetReadiness,
} from './target_guard.js';

/*
 * Read-only website capacity profile.
 * Public HTML is the primary workload. When AUTH_COOKIE is supplied, a small
 * protected activity read verifies the authenticated admin path as well.
 */
function positiveInteger(name, fallback, maximum) {
  const raw = String(__ENV[name] || fallback).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (value < 1 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}`);
  return value;
}

const target = guardLoadTarget();
const maxVus = positiveInteger('MAX_VUS', '125', 1000);
if (target.mode === 'local' && maxVus > 125) {
  throw new Error('Local mode is capped at 125 VU; use isolated staging for higher load');
}
if (maxVus > 125 && __ENV.CONFIRM_HIGH_LOAD !== `staging:${target.hostname}:${maxVus}`) {
  throw new Error('CONFIRM_HIGH_LOAD must include the exact staging host and MAX_VUS above 125');
}

function rampStages(ceiling) {
  const milestones = [25, 50, 125, 250, 500, 750, 1000].filter(value => value <= ceiling);
  if (!milestones.includes(ceiling)) milestones.push(ceiling);
  return milestones.map((vus, index) => ({
    duration: index === 0 ? (__ENV.WARMUP_DURATION || '1m') : (__ENV.STEP_DURATION || '2m'),
    target: vus,
  })).concat([
    { duration: __ENV.HOLD_DURATION || '5m', target: ceiling },
    { duration: __ENV.RAMP_DOWN_DURATION || '2m', target: 0 },
  ]);
}

const publicRequests = new Rate('load_public_requests');
const activityRequests = new Rate('load_activity_requests');
const serverErrors = new Rate('load_server_errors');
const unexpectedStatus = new Rate('load_unexpected_status');
const publicDataUnavailable = new Rate('load_public_data_unavailable');
const requestDuration = new Trend('website_request_duration');
const cookie = String(__ENV.AUTH_COOKIE || '').trim();
const moduleName = encodeURIComponent(__ENV.MODULE || 'SYSTEM');
const publicRoutes = ['/', '/gioi-thieu', '/du_an', '/tin_tuc', '/tuyen-dung'];

export const options = {
  stages: rampStages(maxVus),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    'http_req_duration{traffic_class:public-html}': ['p(95)<1500'],
    'http_req_duration{traffic_class:protected}': ['p(95)<2000'],
    load_public_requests: ['rate>0.80'],
    load_server_errors: ['rate<0.005'],
    load_unexpected_status: ['rate<0.01'],
    load_readiness_failed: ['rate==0'],
    load_public_data_unavailable: ['rate==0'],
  },
};

export function setup() {
  probeTargetReadiness(target, true, 'before');
  return {startedAt: new Date().toISOString()};
}

function record(response, label, trafficClass, expectedStatuses = [200]) {
  const successful = expectedStatuses.includes(response.status);
  const unavailable = trafficClass === 'public-html'
    && response.body && response.body.includes('data-public-data-status="unavailable"');
  publicRequests.add(trafficClass === 'public-html');
  activityRequests.add(label === 'activity-events');
  serverErrors.add(response.status >= 500);
  unexpectedStatus.add(!successful);
  publicDataUnavailable.add(unavailable);
  requestDuration.add(response.timings.duration, {traffic_class: trafficClass, workload: label});
  check(response, {
    [`${label} returns an expected status`]: result => expectedStatuses.includes(result.status),
    [`${label} has no unavailable marker`]: result => !unavailable,
  });
}

export default function () {
  maybeProbeTargetReadiness(target);
  const route = publicRoutes[Math.floor(Math.random() * publicRoutes.length)];
  const page = http.get(`${target.baseUrl}${route}`, {
    tags: {traffic_class: 'public-html', workload: 'public-page'},
    responseType: 'text',
  });
  record(page, 'public-page', 'public-html');

  if (cookie && Math.random() < 0.15) {
    const activity = http.get(
      `${target.baseUrl}/api/protected/activity-events?limit=50&module=${moduleName}`,
      {headers: {Cookie: cookie}, tags: {traffic_class: 'protected', workload: 'activity-events'}},
    );
    record(activity, 'activity-events', 'protected');
  }
  sleep(Number(__ENV.THINK_TIME_SECONDS || 1));
}

export function teardown() {
  probeTargetReadiness(target, true, 'after');
}