import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  guardLoadTarget,
  maybeProbeTargetReadiness,
  probeTargetReadiness,
} from './target_guard.js';

/*
 * Read-only notification WebSocket capacity profile. Each concurrent VU uses
 * a different staging session. SESSION_POOL_FILE must point to a git-ignored
 * *.sessions.json file containing an array of full Cookie header strings.
 */

function positiveInteger(name, fallback, minimum, maximum) {
  const raw = String(__ENV[name] || fallback).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

const target = guardLoadTarget();
const maxVus = positiveInteger('MAX_VUS', '125', 1, 1000);
if (target.mode === 'local' && maxVus > 125) {
  throw new Error('Local WebSocket mode is capped at 125 VU');
}
if (maxVus > 125 && __ENV.CONFIRM_HIGH_LOAD !== `staging:${target.hostname}:${maxVus}`) {
  throw new Error('CONFIRM_HIGH_LOAD must include the exact staging host and MAX_VUS above 125');
}

const sessionPoolFile = String(__ENV.SESSION_POOL_FILE || '').trim();
if (!sessionPoolFile || !sessionPoolFile.endsWith('.sessions.json')) {
  throw new Error('SESSION_POOL_FILE must explicitly reference a git-ignored *.sessions.json file');
}

const sessionPool = new SharedArray('unique websocket staging sessions', () => {
  let payload;
  try {
    payload = JSON.parse(open(sessionPoolFile));
  } catch {
    throw new Error('SESSION_POOL_FILE must contain valid JSON');
  }
  if (!Array.isArray(payload)) throw new Error('SESSION_POOL_FILE must contain a JSON array');

  const seenTokens = new Set();
  return payload.map((entry, index) => {
    const cookie = typeof entry === 'string' ? entry.trim() : String(entry?.cookie || '').trim();
    if (!cookie || /[\r\n]/.test(cookie)) {
      throw new Error(`Session pool entry ${index} is not a safe Cookie header`);
    }
    const tokenMatch = /(?:^|;\s*)access_token=([^;\s]+)/.exec(cookie);
    if (!tokenMatch) throw new Error(`Session pool entry ${index} lacks access_token`);
    if (seenTokens.has(tokenMatch[1])) {
      throw new Error(`Session pool contains a duplicate access_token at entry ${index}`);
    }
    seenTokens.add(tokenMatch[1]);
    return cookie;
  });
});

if (sessionPool.length < maxVus) {
  throw new Error(`SESSION_POOL_FILE requires at least ${maxVus} unique sessions`);
}

const sessionDurationSeconds = positiveInteger('WS_SESSION_DURATION_SECONDS', '60', 30, 600);
const pingIntervalSeconds = positiveInteger('WS_PING_INTERVAL_SECONDS', '25', 10, 120);
const pongTimeoutSeconds = positiveInteger('WS_PONG_TIMEOUT_SECONDS', '10', 2, 60);
if (pongTimeoutSeconds >= pingIntervalSeconds) {
  throw new Error('WS_PONG_TIMEOUT_SECONDS must be lower than WS_PING_INTERVAL_SECONDS');
}

function rampStages(ceiling) {
  const milestones = [25, 50, 125, 250, 500, 750, 1000].filter(value => value <= ceiling);
  if (!milestones.includes(ceiling)) milestones.push(ceiling);
  return milestones.map((targetVus, index) => ({
    duration: index === 0 ? (__ENV.WARMUP_DURATION || '1m') : (__ENV.STEP_DURATION || '2m'),
    target: targetVus,
  })).concat([
    { duration: __ENV.HOLD_DURATION || '5m', target: ceiling },
    { duration: __ENV.RAMP_DOWN_DURATION || '2m', target: 0 },
  ]);
}

const connectFailures = new Rate('ws_connect_failed');
const pongFailures = new Rate('ws_pong_failed');
const unexpectedCloses = new Rate('ws_unexpected_close');
const reconnects = new Counter('ws_reconnects');
const pings = new Counter('ws_pings');
const pongs = new Counter('ws_pongs');
const pongLatency = new Trend('ws_pong_latency', true);

export const options = {
  scenarios: {
    notification_websockets: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: rampStages(maxVus),
      gracefulRampDown: `${sessionDurationSeconds + 15}s`,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    load_readiness_failed: ['rate==0'],
    ws_connect_failed: ['rate<0.01'],
    ws_pong_failed: ['rate<0.01'],
    ws_unexpected_close: ['rate<0.01'],
    ws_connecting: ['p(95)<1500'],
    ws_pong_latency: ['p(95)<1000'],
  },
  userAgent: 'maian-staging-websocket-capacity-test/1.0',
};

const websocketUrl = target.baseUrl.replace(/^http/, 'ws') + '/api/ws/notifications';

export function setup() {
  probeTargetReadiness(target, true, 'before');
}

export default function () {
  maybeProbeTargetReadiness(target);
  const cookie = sessionPool[(__VU - 1) % sessionPool.length];
  if (__ITER > 0) reconnects.add(1);

  let opened = false;
  let intentionalClose = false;
  let pendingPingAt = 0;
  let pendingFailureRecorded = false;
  const vuSessionSeconds = __VU === 1
    ? Math.min(sessionDurationSeconds, positiveInteger('READINESS_PROBE_INTERVAL_SECONDS', '30', 15, 300))
    : sessionDurationSeconds;

  const response = ws.connect(websocketUrl, {
    headers: {
      Cookie: cookie,
      Origin: target.baseUrl,
    },
    tags: { workload: 'notification-websocket' },
  }, socket => {
    socket.on('open', () => {
      opened = true;
      socket.setInterval(() => {
        if (pendingPingAt) {
          pongFailures.add(true);
          pendingFailureRecorded = true;
          socket.close(4000, 'Pong timeout');
          return;
        }
        pendingPingAt = Date.now();
        pendingFailureRecorded = false;
        pings.add(1);
        socket.send(JSON.stringify({ type: 'ping' }));
        socket.setTimeout(() => {
          if (!pendingPingAt || pendingFailureRecorded) return;
          pongFailures.add(true);
          pendingFailureRecorded = true;
          socket.close(4000, 'Pong timeout');
        }, pongTimeoutSeconds * 1000);
      }, pingIntervalSeconds * 1000);

      socket.setTimeout(() => {
        intentionalClose = true;
        socket.close(1000, 'Capacity profile reconnect cycle');
      }, vuSessionSeconds * 1000);
    });

    socket.on('message', message => {
      let payload;
      try {
        payload = JSON.parse(message);
      } catch {
        return;
      }
      if (payload.type !== 'pong' || !pendingPingAt) return;
      pongLatency.add(Date.now() - pendingPingAt);
      pongFailures.add(false);
      pongs.add(1);
      pendingPingAt = 0;
      pendingFailureRecorded = false;
    });

    socket.on('close', code => {
      if (pendingPingAt && !pendingFailureRecorded) pongFailures.add(true);
      unexpectedCloses.add(!intentionalClose && code !== 1000);
    });

    socket.on('error', () => {
      if (!opened) connectFailures.add(true);
    });
  });

  const connected = opened && response.status === 101;
  connectFailures.add(!connected);
  check(response, {
    'WebSocket handshake returns 101': result => result.status === 101,
    'WebSocket open event fired': () => opened,
  });
  if (!connected) sleep(1 + Math.random());
}

export function teardown() {
  probeTargetReadiness(target, true, 'after');
}
