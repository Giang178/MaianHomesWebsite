import { apiFetch } from '@/lib/api';

import {buildQuery, type QueryValue} from '../shared/http';
import type {CursorPage} from '../shared/types';
import type {ActivityEvent, ActivityMetadata, PurgePreview, PurgeResult} from './types';

const endpoint = '/activity-events';

export const activityApi = {
  list: (filters: Record<string, QueryValue>, signal?: AbortSignal) =>
    apiFetch(`${endpoint}${buildQuery(filters)}`, {signal}) as Promise<CursorPage<ActivityEvent>>,
  detail: (id: string, signal?: AbortSignal) =>
    apiFetch(`${endpoint}/${encodeURIComponent(id)}`, {signal}) as Promise<ActivityEvent>,
  metadata: () => apiFetch(`${endpoint}/metadata`) as Promise<ActivityMetadata>,
  purgePreview: () => apiFetch(`${endpoint}/purge-preview`) as Promise<PurgePreview>,
  purge: (payload: {preview_token: string; reason: string; confirmation: string}) =>
    apiFetch(`${endpoint}/purge`, {method: 'POST', body: JSON.stringify(payload)}) as Promise<PurgeResult>,
  exportCsv: async (filters: Record<string, QueryValue>) => {
    const response = await fetch(`/api/protected${endpoint}/export${buildQuery(filters)}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as {detail?: {message?: string; code?: string}} | null;
      throw new Error(payload?.detail?.message || payload?.detail?.code || 'Không thể xuất nhật ký.');
    }
    return response.blob();
  },
};
