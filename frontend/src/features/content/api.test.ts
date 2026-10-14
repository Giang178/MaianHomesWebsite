import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';
import { articleApi, companyKnowledgeApi, contentApi, normalizeInternalProjectList } from './api';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  apiUpload: vi.fn(),
}));

const projects = [
  {
    id: 'project-1',
    name: 'Dự án 1',
    slug: 'du-an-1',
    location: 'TP.HCM',
    price_range: '10 tỷ',
    status: 'AVAILABLE' as const,
  },
];

describe('normalizeInternalProjectList', () => {
  it('keeps the legacy array response', () => {
    expect(normalizeInternalProjectList(projects)).toEqual(projects);
  });

  it('extracts items from the paginated response', () => {
    expect(normalizeInternalProjectList({ items: projects, total: 1 })).toEqual(projects);
  });

  it('falls back to data and safely rejects invalid responses', () => {
    expect(normalizeInternalProjectList({ data: projects })).toEqual(projects);
    expect(normalizeInternalProjectList({ items: null })).toEqual([]);
    expect(normalizeInternalProjectList(null)).toEqual([]);
  });
});

describe('contentApi.listProjectsInternal', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('always exposes projects as an array to consumers', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: projects, next_cursor: null, total: 1 });

    await expect(contentApi.listProjectsInternal()).resolves.toEqual(projects);
    expect(apiFetch).toHaveBeenCalledWith('/projects', {}, 'protected');
  });
});

describe('companyKnowledgeApi contract', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it('sends the backend payload field and an idempotency key when updating', async () => {
    await companyKnowledgeApi.update({ company_name: 'Maian Homes' }, 3);

    const [, options] = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.payload).toEqual({ company_name: 'Maian Homes' });
    expect(body.draft).toBeUndefined();
    expect(body.expected_version).toBe(3);
    expect(body.idempotency_key).toEqual(expect.any(String));
  });

  it('sends an idempotency key for workflow transitions', async () => {
    await companyKnowledgeApi.transition('publish', 4, 'approved');

    const [, options] = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({ action: 'publish', expected_version: 4, note: 'approved' });
    expect(body.idempotency_key).toEqual(expect.any(String));
  });
});
describe('articleApi draft contract', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ id: 'article-1', version: 1 });
  });

  it('creates a provisional draft with an idempotency key', async () => {
    await articleApi.createDraft();

    expect(apiFetch).toHaveBeenCalledWith(
      '/articles/drafts',
      expect.objectContaining({ method: 'POST' }),
      'protected',
    );
    const [, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(JSON.parse(String(options?.body)).idempotency_key).toEqual(expect.any(String));
  });
});
