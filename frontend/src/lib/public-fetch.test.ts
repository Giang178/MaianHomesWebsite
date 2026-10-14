import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicJson } from './public-fetch';

describe('fetchPublicJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves a legitimate empty collection as a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await expect(fetchPublicJson<{ data: unknown[] }>('/api/items')).resolves.toMatchObject({
      state: 'ok',
      data: { data: [] },
      status: 200,
    });
  });

  it('distinguishes a real 404 from an upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(fetchPublicJson('/api/items/missing')).resolves.toEqual({
      state: 'not-found',
      status: 404,
      requestId: undefined,
    });
  });

  it('preserves upstream status and request id without exposing the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('sensitive upstream detail', {
        status: 503,
        headers: { 'x-request-id': 'req-public-123' },
      }),
    ));

    await expect(fetchPublicJson('/api/items')).resolves.toEqual({
      state: 'error',
      status: 503,
      requestId: 'req-public-123',
      reason: 'http',
    });
  });

  it('classifies malformed success payloads as invalid json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{broken', { status: 200, headers: { 'x-request-id': 'req-json' } }),
    ));

    await expect(fetchPublicJson('/api/items')).resolves.toEqual({
      state: 'error',
      status: 200,
      requestId: 'req-json',
      reason: 'invalid-json',
    });
  });

  it('classifies network failures without leaking exception details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network detail')));

    await expect(fetchPublicJson('/api/items')).resolves.toEqual({
      state: 'error',
      reason: 'network',
    });
  });
});
