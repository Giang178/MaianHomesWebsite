import { apiFetch, apiUpload } from '@/lib/api';
import type {
  AccountUser,
  AccountCreatePayload,
  AccountCreatedResponse,
  AccountUpdatePayload,
  PermissionCatalog,
} from './types';

export const accountsApi = {
  me: (): Promise<AccountUser> =>
    apiFetch('/website/accounts/me/profile', { method: 'GET' }, 'protected'),

  permissions: (): Promise<PermissionCatalog> =>
    apiFetch('/website/permissions', { method: 'GET' }, 'protected'),
  list: (): Promise<AccountUser[]> => {
    return apiFetch('/website/accounts', { method: 'GET' }, 'protected');
  },

  create: (payload: AccountCreatePayload): Promise<AccountCreatedResponse> => {
    return apiFetch(
      '/website/accounts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      'protected',
    );
  },

  update: (id: string, payload: AccountUpdatePayload): Promise<AccountUser> => {
    return apiFetch(
      `/website/accounts/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      'protected',
    );
  },

  uploadAvatar: (id: string, file: File): Promise<AccountUser> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload(`/website/accounts/${id}/avatar`, formData);
  },

  revokeSessions: (id: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch(
      `/website/accounts/${id}/revoke-sessions`,
      {
        method: 'POST',
      },
      'protected',
    );
  },

  issue: (id: string): Promise<{ success: boolean; delivery_queued: boolean; status: string }> =>
    apiFetch(`/website/accounts/${id}/issue`, { method: 'POST' }, 'protected'),
};
