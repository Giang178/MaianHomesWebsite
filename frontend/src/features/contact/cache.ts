import type {PublicContactSettings} from './types';

export const CONTACT_SETTINGS_CACHE_KEY = 'maian-public-contact-settings-v2';
export const LEGACY_CONTACT_SETTINGS_CACHE_KEY = 'maian-public-contact-settings-v1';
export const CONTACT_SETTINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedContactSettings = {
  cached_at: number;
  settings: PublicContactSettings;
};

const isNullableString = (value: unknown): value is string | null | undefined =>
  value === null || value === undefined || typeof value === 'string';

const isSafeMessengerUrl = (value: string | null) => {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['m.me', 'messenger.com', 'www.messenger.com'].includes(url.hostname.toLowerCase())
      && url.pathname !== '/';
  } catch {
    return false;
  }
};

const isSafeZaloUrl = (value: string | null | undefined) => {
  if (value == null) return true;
  try {
    const url = new URL(value);
    const isDomainSafe = url.protocol === 'https:'
      && ['zalo.me', 'www.zalo.me', 'chat.zalo.me', 'oa.zalo.me'].includes(url.hostname.toLowerCase())
      && url.pathname !== '/';
    const isPhoneLink = /zalo\.me\/(?:\+?84|0)\d{8,11}$/i.test(value);
    return isDomainSafe && !isPhoneLink;
  } catch {
    return false;
  }
};

export function isPublicContactSettings(value: unknown): value is PublicContactSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;
  if (
    !isNullableString(settings.phone)
    || !isNullableString(settings.phone_href)
    || !isNullableString(settings.zalo_oa_id)
    || !isNullableString(settings.zalo_url)
    || !isNullableString(settings.messenger_url)
    || !isNullableString(settings.email)
    || !isNullableString(settings.email_href)
  ) {
    return false;
  }

  const phonePairIsValid = settings.phone === null
    ? settings.phone_href === null
    : typeof settings.phone_href === 'string' && /^tel:\+?\d{8,15}$/.test(settings.phone_href);
  const emailPairIsValid = settings.email === null
    ? settings.email_href === null
    : typeof settings.email_href === 'string'
      && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(settings.email_href);

  return phonePairIsValid
    && emailPairIsValid
    && (settings.zalo_oa_id == null || /^\d{10,30}$/.test(settings.zalo_oa_id as string))
    && isSafeZaloUrl(settings.zalo_url as string | null | undefined)
    && isSafeMessengerUrl(settings.messenger_url as string | null);
}

export function readCachedContactSettings(
  now = Date.now(),
): PublicContactSettings | null {
  if (typeof window === 'undefined') return null;

  try {
    try {
      window.localStorage.removeItem(LEGACY_CONTACT_SETTINGS_CACHE_KEY);
    } catch {
      // Ignore
    }
    const raw = window.localStorage.getItem(CONTACT_SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedContactSettings>;
    if (
      typeof cached.cached_at !== 'number'
      || now - cached.cached_at > CONTACT_SETTINGS_CACHE_TTL_MS
      || !isPublicContactSettings(cached.settings)
    ) {
      window.localStorage.removeItem(CONTACT_SETTINGS_CACHE_KEY);
      return null;
    }
    return cached.settings;
  } catch {
    try {
      window.localStorage.removeItem(CONTACT_SETTINGS_CACHE_KEY);
    } catch {
      // Ignore browsers that disable local storage completely.
    }
    return null;
  }
}

export function writeCachedContactSettings(
  settings: PublicContactSettings,
  now = Date.now(),
) {
  if (typeof window === 'undefined' || !isPublicContactSettings(settings)) return;

  try {
    const cached: CachedContactSettings = {cached_at: now, settings};
    window.localStorage.setItem(CONTACT_SETTINGS_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage may be unavailable in private browsing. Runtime data still works.
  }
}
