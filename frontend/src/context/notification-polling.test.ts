import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_FALLBACK_POLL_MS,
  NOTIFICATION_FIRST_RECONNECT_MAX_MS,
  NOTIFICATION_FIRST_RECONNECT_MIN_MS,
  NOTIFICATION_LATER_RECONNECT_MIN_MS,
  NOTIFICATION_RECONNECT_CAP_MS,
  NOTIFICATION_WS_RECONCILE_MS,
  notificationReconnectDelay,
  notificationRefreshDue,
} from './notification-polling';

describe('notification polling admission', () => {
  it('keeps the two-minute fallback cadence available when websocket is down', () => {
    expect(NOTIFICATION_FALLBACK_POLL_MS).toBe(120_000);
    expect(notificationRefreshDue(false, Date.now(), Date.now())).toBe(true);
  });

  it('suppresses redundant polling while websocket is healthy', () => {
    const now = 1_000_000;
    expect(notificationRefreshDue(true, now - NOTIFICATION_WS_RECONCILE_MS + 1, now)).toBe(false);
    expect(notificationRefreshDue(true, now - NOTIFICATION_WS_RECONCILE_MS, now)).toBe(true);
  });

  it('allows an initial reconciliation even with an open websocket', () => {
    expect(notificationRefreshDue(true, 0, Date.now())).toBe(true);
  });

  it('spreads the first reconnect over one to thirty seconds', () => {
    expect(notificationReconnectDelay(0, 0)).toBe(NOTIFICATION_FIRST_RECONNECT_MIN_MS);
    expect(notificationReconnectDelay(0, 0.5)).toBe(15_500);
    expect(notificationReconnectDelay(0, 1)).toBe(NOTIFICATION_FIRST_RECONNECT_MAX_MS);
  });

  it('keeps later reconnects randomized and capped at sixty seconds', () => {
    expect(notificationReconnectDelay(1, 0)).toBe(NOTIFICATION_LATER_RECONNECT_MIN_MS);
    expect(notificationReconnectDelay(1, 0.5)).toBe(45_000);
    expect(notificationReconnectDelay(99, 1)).toBe(NOTIFICATION_RECONNECT_CAP_MS);
  });
});
