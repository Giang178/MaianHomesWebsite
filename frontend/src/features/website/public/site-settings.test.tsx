import {render, screen, waitFor} from '@testing-library/react';
import {renderToString} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(() => new Promise(() => undefined)),
}));

import {
  LEGACY_SITE_SETTINGS_CACHE_KEY,
  SITE_SETTINGS_CACHE_KEY,
  usePublicSiteSettings,
} from './site-settings';

function WorkingHours() {
  const settings = usePublicSiteSettings();
  return <span>{settings.footer?.working_hours || 'Thứ 2 – Thứ 7: 08:30 – 17:30'}</span>;
}

describe('usePublicSiteSettings hydration', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('does not use browser cache during the server render snapshot', () => {
    sessionStorage.setItem(LEGACY_SITE_SETTINGS_CACHE_KEY, JSON.stringify({
      footer: {working_hours: 'Thứ 2 – Thứ 6: 08:30 – 17:30'},
    }));

    expect(renderToString(<WorkingHours />)).toContain('Thứ 2 – Thứ 7: 08:30 – 17:30');
  });

  it('applies the cached published settings after hydration', async () => {
    sessionStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify({
      version: 2,
      settings: {
        published_version: 2,
        footer: {working_hours: 'Thứ 2 – Thứ 6: 08:30 – 17:30'},
      },
    }));

    render(<WorkingHours />);

    await waitFor(() => {
      expect(screen.getByText('Thứ 2 – Thứ 6: 08:30 – 17:30')).toBeInTheDocument();
    });
  });
});