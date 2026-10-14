export const NOTIFICATION_FALLBACK_POLL_MS = 120_000;
export const NOTIFICATION_WS_RECONCILE_MS = 600_000;
export const NOTIFICATION_FIRST_RECONNECT_MIN_MS = 1_000;
export const NOTIFICATION_FIRST_RECONNECT_MAX_MS = 30_000;
export const NOTIFICATION_LATER_RECONNECT_MIN_MS = 30_000;
export const NOTIFICATION_RECONNECT_CAP_MS = 60_000;

export function notificationRefreshDue(
  websocketOpen: boolean,
  lastSuccessfulRefresh: number,
  now: number,
): boolean {
  if (!websocketOpen) return true;
  return lastSuccessfulRefresh <= 0 || now - lastSuccessfulRefresh >= NOTIFICATION_WS_RECONCILE_MS;
}

export function notificationReconnectDelay(
  reconnectAttempt: number,
  randomValue: number = Math.random(),
): number {
  const boundedRandom = Math.min(1, Math.max(0, randomValue));
  const firstAttempt = reconnectAttempt <= 0;
  const minimum = firstAttempt
    ? NOTIFICATION_FIRST_RECONNECT_MIN_MS
    : NOTIFICATION_LATER_RECONNECT_MIN_MS;
  const maximum = firstAttempt
    ? NOTIFICATION_FIRST_RECONNECT_MAX_MS
    : NOTIFICATION_RECONNECT_CAP_MS;
  return Math.round(minimum + (maximum - minimum) * boundedRandom);
}
