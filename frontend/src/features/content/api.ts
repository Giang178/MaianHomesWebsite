import { apiFetch, apiUpload } from '@/lib/api';

/**
 * Compatibility surface retained only for endpoints still used by current screens.
 */
export function normalizeInternalProjectList<T = unknown>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export const contentApi = {
  // Public
  listProjectsPublic: (params?: { is_featured?: boolean }) => {
    const query = new URLSearchParams();
    query.set('view', 'summary');
    if (params?.is_featured !== undefined) query.append('is_featured', String(params.is_featured));
    const qs = query.toString();
    return apiFetch(`/projects${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    }, 'public');
  },
  getProjectPublic: (id_or_slug: string) => apiFetch(`/projects/${id_or_slug}`, {}, 'public'),

  listProjectsInternal: async <T = unknown>(): Promise<T[]> => {
    const res = await apiFetch('/projects', {}, 'protected');
    return normalizeInternalProjectList<T>(res);
  },
  uploadProjectImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload('/projects/upload', formData);
  },
};

const createIdempotencyKey = () => typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const articleApi = {
  listMyArticles: (params?: { status?: string; category?: string; q?: string; skip?: number; limit?: number; cursor?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.q) query.append('q', params.q);
    if (params?.cursor) query.append('cursor', params.cursor);
    if (params?.skip !== undefined) query.append('skip', String(params.skip));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch(`/articles/my${qs ? `?${qs}` : ''}`, {}, 'protected');
  },
  getDetail: (id: string) => apiFetch(`/articles/${id}`, {}, 'protected'),
  create: (data: unknown) => apiFetch('/articles', { method: 'POST', body: JSON.stringify({ ...(data as Record<string, unknown>), idempotency_key: createIdempotencyKey() }) }, 'protected'),
  createDraft: () => apiFetch('/articles/drafts', { method: 'POST', body: JSON.stringify({ idempotency_key: createIdempotencyKey() }) }, 'protected'),
  update: (id: string, data: unknown) => {
    const payload = { ...(data as Record<string, unknown>) };
    const expectedVersion = Number(payload.version || payload.expected_version || 1);
    delete payload.version;
    return apiFetch(`/articles/${id}`, { method: 'PUT', body: JSON.stringify({ ...payload, expected_version: expectedVersion, idempotency_key: createIdempotencyKey() }) }, 'protected');
  },
  transitionStatus: (id: string, action: string, note = '', expectedVersion = 1, overrideWarningCodes: string[] = []) =>
    apiFetch(`/articles/${id}/transition`, { method: 'POST', body: JSON.stringify({ action, note, expected_version: expectedVersion, idempotency_key: createIdempotencyKey(), override_warning_codes: overrideWarningCodes }) }, 'protected'),
  getRevisions: (id: string) => apiFetch(`/articles/${id}/revisions`, {}, 'protected'),
  getAuditLogs: (id: string) => apiFetch(`/articles/${id}/audit-logs`, {}, 'protected'),
  deletePermanently: (id: string, expectedVersion: number) => {
    const query = new URLSearchParams({
      expected_version: String(expectedVersion),
      idempotency_key: createIdempotencyKey(),
    });
    return apiFetch(`/articles/${id}/permanent?${query}`, { method: 'DELETE' }, 'protected');
  },
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload('/articles/upload-image', formData);
  },
  trackView: (slugOrId: string) => apiFetch(`/articles/${slugOrId}/track-view`, { method: 'POST' }, 'public'),
};

export const companyKnowledgeApi = {
  get: () => apiFetch('/company-knowledge', {}, 'protected'),
  update: (payload: unknown, expectedVersion: number) =>
    apiFetch('/company-knowledge', {
      method: 'PUT',
      body: JSON.stringify({ payload, expected_version: expectedVersion, idempotency_key: createIdempotencyKey() }),
    }, 'protected'),
  transition: (action: string, expectedVersion: number, note = '') =>
    apiFetch('/company-knowledge/transition', {
      method: 'POST',
      body: JSON.stringify({ action, expected_version: expectedVersion, note, idempotency_key: createIdempotencyKey() }),
    }, 'protected'),
};
