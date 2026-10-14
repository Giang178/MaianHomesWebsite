import { beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => cache);

import { POST } from './route';

describe('public revalidation webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MARKETING_REVALIDATE_SECRET = 'test-secret';
  });

  it('invalidates team list, homepage, new slug and old slug', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'test-secret',
      },
      body: JSON.stringify({ entity: 'TEAM', slug: 'slug-moi', old_slug: 'slug-cu' }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(cache.revalidateTag).toHaveBeenCalledWith('public-team', 'max');
    expect(cache.revalidateTag).toHaveBeenCalledWith('public-team-slug-moi', 'max');
    expect(cache.revalidateTag).toHaveBeenCalledWith('public-team-slug-cu', 'max');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/doi-ngu');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/doi-ngu/slug-moi');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/doi-ngu/slug-cu');
  });

  it('does not accept unsafe slug values as paths', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'test-secret',
      },
      body: JSON.stringify({ entity: 'TEAM', slug: '../admin' }),
    });
    await POST(request as never);

    expect(cache.revalidateTag).toHaveBeenCalledWith('public-team', 'max');
    expect(cache.revalidatePath).not.toHaveBeenCalledWith('/doi-ngu/../admin');
  });

  it('invalidates the recruitment list and job detail after publishing', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'test-secret',
      },
      body: JSON.stringify({ entity: 'JOB', slug: 'chuyen-vien-marketing' }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(cache.revalidateTag).toHaveBeenCalledWith('public-jobs', 'max');
    expect(cache.revalidateTag).toHaveBeenCalledWith('public-job-chuyen-vien-marketing', 'max');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/tuyen-dung');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/tuyen-dung/chuyen-vien-marketing');
  });

  it('invalidates company knowledge pages and shared cache tag', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'test-secret',
      },
      body: JSON.stringify({ entity: 'COMPANY_KNOWLEDGE' }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(cache.revalidateTag).toHaveBeenCalledWith('company-knowledge', 'max');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/gioi-thieu');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/llms.txt');
  });

  it('invalidates the shared site settings and client layout for branding', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'test-secret',
      },
      body: JSON.stringify({ entity: 'BRANDING' }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(cache.revalidateTag).toHaveBeenCalledWith('site-settings', 'max');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('rejects an invalid shared secret without invalidating cache', async () => {
    const request = new Request('http://localhost/api/webhook/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-marketing-revalidate-secret': 'wrong-secret',
      },
      body: JSON.stringify({ entity: 'ARTICLE', slug: 'tin-moi' }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
