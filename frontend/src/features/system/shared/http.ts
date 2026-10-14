import { apiFetch } from '@/lib/api';

export type QueryValue = string | number | undefined;

export const buildQuery = (values: Record<string, QueryValue>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.size ? `?${params}` : '';
};

const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const mutate = <T>(endpoint: string, method: string, body?: unknown) =>
  apiFetch(endpoint, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {'Idempotency-Key': generateIdempotencyKey()},
  }, 'protected') as Promise<T>;

export const get = <T>(endpoint: string) =>
  apiFetch(endpoint, {}, 'protected') as Promise<T>;
