import { apiFetch, apiUploadPublic } from '@/lib/api';

export const consignmentApi = {
  createPublic: (data: unknown) =>
    apiFetch('/consignments', { method: 'POST', body: JSON.stringify(data) }, 'public'),
  createPublicWithImages: (data: unknown, files: File[], idempotencyKey: string) => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(data));
    files.forEach((file) => formData.append('files', file));
    return apiUploadPublic('/consignments/with-images', formData, idempotencyKey);
  },
};
