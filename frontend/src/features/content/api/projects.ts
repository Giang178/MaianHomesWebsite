import { apiFetch } from '@/lib/api';
import { contentApi } from '@/features/content/api';
import { createIdempotencyKey, transitionContent } from './workflow';
import type { ContentAction } from '../contracts/generated';
import type { ProjectAdminResponse, ProjectFormData, ProjectListItem, ProjectUploadResponse } from '../projects/project-form-contract';

export const projectsApi = {
  list: async (cursor?: string): Promise<{ items: ProjectListItem[]; next_cursor: string | null; total: number }> => {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    const response = await apiFetch(`/projects${query.toString() ? `?${query.toString()}` : ''}`) as
      | ProjectListItem[]
      | {items?: ProjectListItem[]; data?: ProjectListItem[]; next_cursor?: string | null; total?: number};
    if (Array.isArray(response)) return { items: response, next_cursor: null, total: response.length };
    const items = Array.isArray(response.items) ? response.items : (Array.isArray(response.data) ? response.data : []);
    return { items, next_cursor: response.next_cursor ?? null, total: response.total ?? items.length };
  },
  detail: (id: string): Promise<ProjectAdminResponse> => apiFetch(`/projects/${id}`),
  validate: (data: ProjectFormData): Promise<ProjectAdminResponse['validation']> =>
    apiFetch('/projects/validate', { method: 'POST', body: JSON.stringify(data) }),
  create: (data: ProjectFormData, idempotencyKey = createIdempotencyKey('project-create')): Promise<ProjectAdminResponse> =>
    apiFetch('/projects', { method: 'POST', body: JSON.stringify({ ...data, idempotency_key: idempotencyKey }) }),
  update: (id: string, data: ProjectFormData, expectedVersion: number, idempotencyKey = createIdempotencyKey(`project-${id}-save`)): Promise<ProjectAdminResponse> =>
    apiFetch(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...data,
        expected_version: expectedVersion,
        idempotency_key: idempotencyKey,
      }),
    }),
  transition: (
    id: string,
    action: ContentAction,
    expectedVersion: number,
    note = '',
    warnings: string[] = [],
  ) => transitionContent('projects', id, action, expectedVersion, note, warnings),
  archive: (id: string, expectedVersion: number) => {
    const query = new URLSearchParams({
      expected_version: String(expectedVersion),
      idempotency_key: createIdempotencyKey(`project-${id}-archive`),
    });
    return apiFetch(`/projects/${id}?${query}`, { method: 'DELETE' });
  },
  deletePermanently: (id: string, expectedVersion: number) => {
    const query = new URLSearchParams({
      expected_version: String(expectedVersion),
      idempotency_key: createIdempotencyKey(`project-${id}-delete-permanently`),
    });
    return apiFetch(`/projects/${id}/permanent?${query}`, { method: 'DELETE' });
  },
  upload: (file: File): Promise<ProjectUploadResponse> => contentApi.uploadProjectImage(file),
};
