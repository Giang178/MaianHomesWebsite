import {beforeEach, describe, expect, it} from 'vitest';

import {
  CONTACT_SETTINGS_CACHE_KEY,
  CONTACT_SETTINGS_CACHE_TTL_MS,
  readCachedContactSettings,
  writeCachedContactSettings,
} from './cache';

const contact = {
  phone: '0969105059',
  phone_href: 'tel:0969105059',
  zalo_oa_id: '4085613041166590560',
  zalo_url: 'https://zalo.me/4085613041166590560',
  messenger_url: 'https://m.me/MaianHomes',
  email: 'contact@maianhomes.vn',
  email_href: 'mailto:contact@maianhomes.vn',
};

describe('public contact settings cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns a valid last-known-good value within its TTL', () => {
    writeCachedContactSettings(contact, 1_000);
    expect(readCachedContactSettings(1_000 + CONTACT_SETTINGS_CACHE_TTL_MS - 1)).toEqual(contact);
  });

  it('removes expired values', () => {
    writeCachedContactSettings(contact, 1_000);
    expect(readCachedContactSettings(1_000 + CONTACT_SETTINGS_CACHE_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(CONTACT_SETTINGS_CACHE_KEY)).toBeNull();
  });

  it('rejects an unsafe cached redirect', () => {
    window.localStorage.setItem(CONTACT_SETTINGS_CACHE_KEY, JSON.stringify({
      cached_at: Date.now(),
      settings: {...contact, messenger_url: 'javascript:alert(1)'},
    }));

    expect(readCachedContactSettings()).toBeNull();
  });

  it('rejects an unsafe cached Zalo redirect', () => {
    window.localStorage.setItem(CONTACT_SETTINGS_CACHE_KEY, JSON.stringify({
      cached_at: Date.now(),
      settings: {...contact, zalo_url: 'https://attacker.com/zalo'},
    }));

    expect(readCachedContactSettings()).toBeNull();
  });

  it('rejects a cached Zalo URL that points to a personal phone number', () => {
    window.localStorage.setItem(CONTACT_SETTINGS_CACHE_KEY, JSON.stringify({
      cached_at: Date.now(),
      settings: {...contact, zalo_url: 'https://zalo.me/0969105059'},
    }));

    expect(readCachedContactSettings()).toBeNull();
  });

  it('rejects an invalid cached Zalo OA ID', () => {
    window.localStorage.setItem(CONTACT_SETTINGS_CACHE_KEY, JSON.stringify({
      cached_at: Date.now(),
      settings: {...contact, zalo_oa_id: 'invalid'},
    }));

    expect(readCachedContactSettings()).toBeNull();
  });

  it('accepts settings when the optional Zalo URL is omitted', () => {
    const withoutZalo = {
      phone: contact.phone,
      phone_href: contact.phone_href,
      messenger_url: contact.messenger_url,
      email: contact.email,
      email_href: contact.email_href,
    };

    writeCachedContactSettings(withoutZalo, 1_000);

    expect(readCachedContactSettings(1_001)).toEqual(withoutZalo);
  });
});
