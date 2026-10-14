import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, SESSION_EXPIRED_EVENT, shouldRedirectExpiredSession } from './api';

describe('apiFetch cancellation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts timed-out requests with an explicit reason and returns REQUEST_TIMEOUT', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = apiFetch('/slow-request');
    const rejection = expect(request).rejects.toMatchObject({
      message: 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.',
      status: 0,
      code: 'REQUEST_TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toMatchObject({
      name: 'TimeoutError',
      message: 'API request timed out',
    });
    await rejection;
  });

  it('preserves cancellation initiated by the caller', async () => {
    const controller = new AbortController();
    const cancellation = new DOMException('Component unmounted', 'AbortError');
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = apiFetch('/cancelled-request', { signal: controller.signal });
    controller.abort(cancellation);

    await expect(request).rejects.toBe(cancellation);
  });
  it('does not try to parse the empty body of a 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiFetch('/empty-response', { method: 'DELETE' })).resolves.toBeNull();
  });
});

describe('apiFetch session expiry', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('clears the employee session without redirecting a public page', async () => {
    window.history.replaceState({}, '', '/lien-he');
    localStorage.setItem('maian_user', JSON.stringify({email: 'staff@example.com'}));
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired, {once: true});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 401,
      headers: {'x-request-id': 'request-expired'},
    })));

    await expect(apiFetch('/notifications')).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
      requestId: 'request-expired',
    });

    expect(window.location.pathname).toBe('/lien-he');
    expect(localStorage.getItem('maian_user')).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('only redirects expired protected sessions from the admin area', () => {
    expect(shouldRedirectExpiredSession('/')).toBe(false);
    expect(shouldRedirectExpiredSession('/tin_tuc')).toBe(false);
    expect(shouldRedirectExpiredSession('/admin')).toBe(true);
    expect(shouldRedirectExpiredSession('/admin/content')).toBe(true);
  });
});
