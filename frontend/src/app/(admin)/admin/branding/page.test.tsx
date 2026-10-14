import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BrandingAdminPage from './page';
import BrandingFooterPreviewClient from '@/app/(preview)/branding-footer-preview/PreviewClient';
import { websiteAdminApi } from '@/features/website/admin/api';

vi.mock('@/lib/use-permissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));
vi.mock('@/features/website/admin/api', () => ({
  websiteAdminApi: {
    branding: {
      get: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
    },
  },
}));

describe('BrandingAdminPage footer simulation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(websiteAdminApi.branding.get).mockResolvedValue({
      version: 4,
      status: 'DRAFT',
      draft: {
        phone: '0901 111 222',
        email: 'hello@example.com',
        address: '123 Đường Thử Nghiệm',
        footer: {
          company_name: 'CÔNG TY THỬ NGHIỆM',
          tax_id: '0123456789',
          working_hours: 'Thứ 2 – Thứ 6',
          copyright_text: '© 2026 CÔNG TY THỬ NGHIỆM',
        },
        social_links: { youtube: 'https://youtube.com/@maianhomes' },
      },
    });
  });
  it('renders the public Footer component with live draft values and viewport controls', async () => {
    render(<BrandingAdminPage />);

    const preview = await screen.findByTestId<HTMLIFrameElement>('branding-footer-preview');
    expect(preview).toHaveAttribute('data-preview-mode', 'desktop');
    const postMessage = vi.spyOn(preview.contentWindow!, 'postMessage');
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: window.location.origin,
        source: preview.contentWindow,
        data: { type: 'branding-footer-preview-ready' },
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'branding-footer-preview',
        contact: expect.objectContaining({ phone: '0901 111 222' }),
        siteSettings: expect.objectContaining({ address: '123 Đường Thử Nghiệm' }),
      }),
      window.location.origin,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /Số Hotline hiển thị/i }), {
      target: { value: '0988 777 666' },
    });
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ contact: expect.objectContaining({ phone: '0988 777 666' }) }),
      window.location.origin,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(preview).toHaveAttribute('data-preview-mode', 'mobile');
    expect(preview).toHaveAttribute('title', 'Mô phỏng Footer mobile');
  });

  it('renders the real responsive Footer after receiving same-origin draft data', async () => {
    render(<BrandingFooterPreviewClient />);

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: 'branding-footer-preview',
          contact: {
            phone: '0901 111 222', phone_href: 'tel:0901111222',
            email: 'hello@example.com', email_href: 'mailto:hello@example.com',
            zalo_url: null, messenger_url: null,
          },
          siteSettings: {
            address: '123 Đường Thử Nghiệm',
            footer: { company_name: 'CÔNG TY THỬ NGHIỆM' },
            social_links: { youtube: 'https://youtube.com/@maianhomes' },
          },
        },
      }),
    );

    const footer = await screen.findByRole('contentinfo');
    expect(within(footer).getAllByText('CÔNG TY THỬ NGHIỆM').length).toBeGreaterThan(0);
    expect(within(footer).getAllByText('123 Đường Thử Nghiệm').length).toBeGreaterThan(0);
    expect(within(footer).getByRole('link', { name: /Kênh YouTube chính thức/i })).toHaveAttribute(
      'href',
      'https://youtube.com/@maianhomes',
    );
  });
});
