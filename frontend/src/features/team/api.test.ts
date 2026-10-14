import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicTeam, getPublicTeamMember } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public team cache contract', () => {
  it('shares the team list response for five minutes across public renders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], total: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await getPublicTeam({ featured: true, limit: 4 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/team?featured=true&limit=4'),
      expect.objectContaining({
        cache: 'force-cache',
        next: { revalidate: 300, tags: ['public-team'] },
      }),
    );
  });

  it('tags a profile with both the collection and slug for coherent revalidation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: 'nguyen-an' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await getPublicTeamMember('nguyen-an');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/team/nguyen-an'),
      expect.objectContaining({
        cache: 'force-cache',
        next: { revalidate: 300, tags: ['public-team', 'public-team-nguyen-an'] },
      }),
    );
  });

  it('keeps the safe upstream request id on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 503,
      headers: { 'x-request-id': 'req-public-team-1' },
    })));

    await expect(getPublicTeam()).rejects.toMatchObject({
      name: 'TeamApiError',
      status: 503,
      requestId: 'req-public-team-1',
    });
  });
});
