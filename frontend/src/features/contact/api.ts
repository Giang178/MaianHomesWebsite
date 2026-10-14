import {apiFetch} from '@/lib/api';

import type {PublicContactSettings} from './types';

export const contactApi = {
  publicSettings: (options: RequestInit = {}) =>
    apiFetch('/contact-settings', {cache: 'no-store', ...options}, 'public') as Promise<PublicContactSettings>,
};
