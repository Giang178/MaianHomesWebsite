'use client';

import {useEffect, useState} from 'react';

import {contactApi} from './api';
import {
  isPublicContactSettings,
  readCachedContactSettings,
  writeCachedContactSettings,
} from './cache';
import {EMPTY_CONTACT_SETTINGS, type PublicContactSettings} from './types';

export type ContactSettingsStatus = 'loading' | 'ready' | 'stale' | 'retrying';

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000] as const;
const REQUEST_TIMEOUT_MS = 8_000;

export function usePublicContactSettings() {
  const [contact, setContact] = useState<PublicContactSettings>(EMPTY_CONTACT_SETTINGS);
  const [status, setStatus] = useState<ContactSettingsStatus>('loading');

  useEffect(() => {
    let active = true;
    let attempt = 0;
    let hasCachedValue = false;
    let inFlight = false;
    let retryTimer: number | null = null;
    let requestController: AbortController | null = null;
    let requestTimeout: number | null = null;

    const cached = readCachedContactSettings();
    if (cached) {
      hasCachedValue = true;
      setContact(cached);
      setStatus('stale');
    }

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = (load: () => Promise<void>) => {
      if (!active) return;
      clearRetryTimer();
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      retryTimer = window.setTimeout(() => void load(), delay);
    };

    const load = async () => {
      if (!active || inFlight) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus(hasCachedValue ? 'stale' : 'retrying');
        scheduleRetry(load);
        return;
      }

      inFlight = true;
      clearRetryTimer();
      requestController = new AbortController();
      requestTimeout = window.setTimeout(() => requestController?.abort(), REQUEST_TIMEOUT_MS);

      try {
        const settings = await contactApi.publicSettings({signal: requestController.signal});
        if (!active) return;
        if (!isPublicContactSettings(settings)) throw new Error('INVALID_PUBLIC_CONTACT_SETTINGS');

        attempt = 0;
        hasCachedValue = true;
        setContact(settings);
        setStatus('ready');
        writeCachedContactSettings(settings);
      } catch {
        if (!active) return;
        setStatus(hasCachedValue ? 'stale' : 'retrying');
        scheduleRetry(load);
      } finally {
        inFlight = false;
        if (requestTimeout !== null) {
          window.clearTimeout(requestTimeout);
          requestTimeout = null;
        }
        requestController = null;
      }
    };

    const retryNow = () => {
      if (!active) return;
      attempt = 0;
      clearRetryTimer();
      void load();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') retryNow();
    };

    window.addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void load();

    return () => {
      active = false;
      clearRetryTimer();
      if (requestTimeout !== null) window.clearTimeout(requestTimeout);
      requestController?.abort();
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {contact, status};
}
