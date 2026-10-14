import { apiFetch } from '@/lib/api';
import type { ContentAction, TransitionPayload } from '../contracts/generated';

export const createIdempotencyKey = (scope = 'marketing') =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `${scope}-${globalThis.crypto.randomUUID()}`
    : `${scope}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const transitionContent = (
  aggregate: 'projects' | 'articles',
  id: string,
  action: ContentAction,
  expectedVersion: number,
  note = '',
  overrideWarningCodes: string[] = [],
) => {
  const payload: TransitionPayload = {
    action,
    expected_version: expectedVersion,
    idempotency_key: createIdempotencyKey(`${aggregate}-${id}-${action}`),
    note,
    override_warning_codes: overrideWarningCodes,
  };
  return apiFetch(`/${aggregate}/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

