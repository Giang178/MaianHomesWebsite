import {apiFetch} from '@/lib/api';

export type PublicLeadPayload = Record<string, unknown> & {
  customer_name: string;
  phone: string;
  consent?: boolean;
  consent_version?: string;
};

const pendingKeys = new Map<string, string>();

function requestKey(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function browserFingerprint(): string {
  if (typeof window === 'undefined') return 'server-render';
  const storageKey = 'maian_lead_fingerprint';
  let fingerprint = window.localStorage.getItem(storageKey) || '';
  if (!fingerprint) {
    fingerprint = requestKey();
    window.localStorage.setItem(storageKey, fingerprint);
  }
  return fingerprint;
}

export async function submitPublicLead(data: PublicLeadPayload) {
  const payload = {
    ...data,
    consent: data.consent ?? true,
    consent_version: data.consent_version || 'website-privacy-v1',
  };
  const identity = JSON.stringify(payload);
  const idempotencyKey = pendingKeys.get(identity) || requestKey();
  pendingKeys.set(identity, idempotencyKey);
  try {
    const result = await apiFetch(
      '/leads',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Client-Fingerprint': browserFingerprint(),
        },
      },
      'public',
    );
    pendingKeys.delete(identity);
    return result;
  } catch (error) {
    // Keep the same key for a retry after timeout/temporary server failure.
    throw error;
  }
}
