import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {contactApi} from './api';
import {readCachedContactSettings, writeCachedContactSettings} from './cache';
import {EMPTY_CONTACT_SETTINGS} from './types';
import {usePublicContactSettings} from './usePublicContactSettings';

vi.mock('./api', () => ({contactApi: {publicSettings: vi.fn()}}));

const contact = {
  phone: '0969105059',
  phone_href: 'tel:0969105059',
  zalo_url: 'https://zalo.me/maianhomes',
  messenger_url: 'https://m.me/MaianHomes',
  email: 'contact@maianhomes.vn',
  email_href: 'mailto:contact@maianhomes.vn',
};

function ContactProbe() {
  const {contact: settings, status} = usePublicContactSettings();
  return (
    <div>
      <span data-testid="phone">{settings.phone_href ?? 'none'}</span>
      <span data-testid="status">{status}</span>
    </div>
  );
}

describe('usePublicContactSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('retries after an initial failure and recovers without a page refresh', async () => {
    vi.useFakeTimers();
    vi.mocked(contactApi.publicSettings)
      .mockRejectedValueOnce(new Error('backend starting'))
      .mockResolvedValue(contact);

    render(<ContactProbe />);
    await act(async () => Promise.resolve());
    expect(contactApi.publicSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('phone')).toHaveTextContent('none');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(contactApi.publicSettings).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('phone')).toHaveTextContent('tel:0969105059');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });

  it('keeps cached settings visible while the backend is unavailable', async () => {
    writeCachedContactSettings(contact);
    vi.mocked(contactApi.publicSettings).mockRejectedValue(new Error('offline'));

    render(<ContactProbe />);
    expect(await screen.findByText('tel:0969105059')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('stale');
  });

  it('honors a successful empty response and replaces stale cache data', async () => {
    writeCachedContactSettings(contact);
    vi.mocked(contactApi.publicSettings).mockResolvedValue(EMPTY_CONTACT_SETTINGS);

    render(<ContactProbe />);
    await act(async () => Promise.resolve());

    expect(screen.getByTestId('phone')).toHaveTextContent('none');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(readCachedContactSettings()).toEqual(EMPTY_CONTACT_SETTINGS);
  });

  it('cancels scheduled retries after unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(contactApi.publicSettings).mockRejectedValue(new Error('offline'));

    const view = render(<ContactProbe />);
    await act(async () => Promise.resolve());
    expect(contactApi.publicSettings).toHaveBeenCalledTimes(1);
    view.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(contactApi.publicSettings).toHaveBeenCalledTimes(1);
  });
});
