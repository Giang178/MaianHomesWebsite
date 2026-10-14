import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUploadPublic } from './api';


describe('apiUploadPublic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the stable idempotency key as a request header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'consignment-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiUploadPublic('/consignments/with-images', new FormData(), 'stable-key');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/consignments/with-images',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Idempotency-Key': 'stable-key' },
      }),
    );
  });
});
