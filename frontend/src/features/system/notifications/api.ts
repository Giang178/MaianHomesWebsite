import { apiFetch } from '@/lib/api';

export const notificationsApi = {
  list: () => apiFetch('/notifications', {}, 'protected'),
  markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }, 'protected'),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'PATCH' }, 'protected'),
};
