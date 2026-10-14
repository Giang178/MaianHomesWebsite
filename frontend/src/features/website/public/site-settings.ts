'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface PublicSiteSettings {
  published_version?: number | null;
  published_at?: string | null;
  logo_header_media_id?: string | null;
  logo_footer_media_id?: string | null;
  logo_light_media_id?: string | null;
  logo_dark_media_id?: string | null;
  favicon_media_id?: string | null;
  default_og_media_id?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  zalo_oa_id?: string | null;
  zalo_url?: string | null;
  messenger_url?: string | null;
  social_links?: Record<string, string>;
  footer?: {
    company_name?: string;
    tax_id?: string;
    working_hours?: string;
    copyright_text?: string;
    [key: string]: unknown;
  };
}

export const SITE_SETTINGS_CACHE_KEY = 'maian:site-settings:v2';
export const LEGACY_SITE_SETTINGS_CACHE_KEY = 'maian:site-settings:v1';
export const SITE_SETTINGS_CHANNEL = 'maian:site-settings';

export const mediaUrl = (mediaId: string | null | undefined, fallback: string) =>
  mediaId ? `/api/public/marketing-media/${encodeURIComponent(mediaId)}` : fallback;

function isSiteSettings(value: unknown): value is PublicSiteSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCachedSettings(): PublicSiteSettings | null {
  try {
    const raw = window.sessionStorage.getItem(SITE_SETTINGS_CACHE_KEY)
      || window.sessionStorage.getItem(LEGACY_SITE_SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSiteSettings(parsed)) return null;
    const enveloped = (parsed as { settings?: unknown }).settings;
    return isSiteSettings(enveloped) ? enveloped : parsed;
  } catch {
    return null;
  }
}

function writeCachedSettings(settings: PublicSiteSettings) {
  try {
    window.sessionStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify({
      version: settings.published_version ?? null,
      settings,
    }));
    window.sessionStorage.removeItem(LEGACY_SITE_SETTINGS_CACHE_KEY);
  } catch {
    // Cache is optional.
  }
}

export function usePublicSiteSettings() {
  // The server and the first browser render must use the same snapshot. Cache
  // is applied only after hydration so an older published footer cannot cause
  // a server/client text mismatch.
  const [settings, setSettings] = useState<PublicSiteSettings>({});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const cached = readCachedSettings();

    if (cached) {
      queueMicrotask(() => {
        if (active) setSettings(cached);
      });
    }

    const loadPublishedSettings = async () => {
      try {
        const result = await apiFetch('/site-settings', { signal: controller.signal }, 'public');
        if (!active || !isSiteSettings(result)) return;
        setSettings(result);
        writeCachedSettings(result);
      } catch {
        // The last-known-good cache or code fallback remains visible.
      }
    };

    void loadPublishedSettings();

    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(SITE_SETTINGS_CHANNEL)
      : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type !== 'published' || !active) return;
        try {
          window.sessionStorage.removeItem(SITE_SETTINGS_CACHE_KEY);
          window.sessionStorage.removeItem(LEGACY_SITE_SETTINGS_CACHE_KEY);
        } catch {
          // Cache is optional.
        }
        void loadPublishedSettings();
      };
    }

    return () => {
      active = false;
      controller.abort();
      channel?.close();
    };
  }, []);

  return settings;
}