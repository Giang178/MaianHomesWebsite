import type {ImgHTMLAttributes} from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import Navbar from './Navbar';

const mocks = vi.hoisted(() => ({
  listProjectsPublic: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img alt="" {...props}/>,
}));

vi.mock('@/features/content/api', () => ({
  contentApi: {
    listProjectsPublic: mocks.listProjectsPublic,
  },
}));

vi.mock('@/features/website/public/site-settings', () => ({
  mediaUrl: (_mediaId: unknown, fallback: string) => fallback,
  usePublicSiteSettings: () => ({}),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
}));

describe('public project navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProjectsPublic.mockResolvedValue({data: []});
    mocks.apiFetch.mockResolvedValue({coworking: true, office: true});
  });

  it('exposes a direct all-projects link on desktop and mobile', async () => {
    render(<Navbar/>);

    const desktopLink = screen.getByRole('link', {
      name: 'Dự án bất động sản Maian Homes',
    });
    expect(desktopLink).toHaveAttribute('href', '/du_an');

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu'}));

    await waitFor(() => {
      expect(screen.getAllByRole('link', {
        name: 'Dự án bất động sản Maian Homes',
      })).toHaveLength(2);
    });
  });
});
