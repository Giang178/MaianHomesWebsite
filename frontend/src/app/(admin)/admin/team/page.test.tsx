import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicTeamAdminPage from './page';
import { websiteAdminApi } from '@/features/website/admin/api';

vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: ['website.staff.read', 'website.staff.create', 'website.staff.update', 'website.staff.delete'] } }),
}));
vi.mock('@/features/website/admin/api', () => ({
  websiteAdminApi: {
    staff: {
      list: vi.fn(), options: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), transition: vi.fn(), uploadAvatar: vi.fn(),
    },
  },
}));

describe('PublicTeamAdminPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(websiteAdminApi.staff.list).mockResolvedValue({ items: [] });
    vi.mocked(websiteAdminApi.staff.options).mockResolvedValue({ projects: [], media: [] });
  });

  it('loads an empty CMS and opens the complete public profile form', async () => {
    render(<PublicTeamAdminPage />);
    expect(await screen.findByText('Chưa có hồ sơ phù hợp.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ' }));
    expect(screen.getByRole('heading', { name: 'Tạo hồ sơ đội ngũ' })).toBeInTheDocument();
    expect(screen.getByText('Ảnh chân dung *')).toBeInTheDocument();
    expect(screen.getByText('Chuyên môn *')).toBeInTheDocument();
    expect(screen.getByText('Dự án đã đồng hành')).toBeInTheDocument();
    expect(screen.getByText(/SEO title/)).toBeInTheDocument();
    expect(screen.getByText('Tự động tạo từ họ và tên khi lưu')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /slug/i })).not.toBeInTheDocument();
  });

  it('uploads a portrait directly inside the profile form', async () => {
    vi.mocked(websiteAdminApi.staff.uploadAvatar).mockResolvedValue({
      id: 'portrait-media-id',
      url: '/api/public/marketing-media/portrait-media-id',
      width: 1200,
      height: 1500,
      size: 1024,
      content_type: 'image/jpeg',
    });
    render(<PublicTeamAdminPage />);
    await screen.findByText('Chưa có hồ sơ phù hợp.');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ' }));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Chân dung chuyên gia Nguyễn Văn An'), { target: { value: 'Chân dung chuyên gia thử nghiệm' } });
    const file = new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Tải ảnh chân dung'), { target: { files: [file] } });
    await waitFor(() => expect(websiteAdminApi.staff.uploadAvatar).toHaveBeenCalledWith(file, 'Chân dung chuyên gia thử nghiệm'));
    expect(await screen.findByRole('img', { name: 'Chân dung chuyên gia thử nghiệm' })).toBeInTheDocument();
  });

  it('requires confirmation and deletes the selected profile version', async () => {
    vi.mocked(websiteAdminApi.staff.list).mockResolvedValue({
      items: [{
        id: 'staff-id', version: 3, status: 'ARCHIVED',
        draft: { full_name: 'Mai Do', position: 'Chuyen gia', slug: 'mai-do' },
      } as never],
    });
    vi.mocked(websiteAdminApi.staff.delete).mockResolvedValue(null);
    render(<PublicTeamAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Mai Do');
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận xóa vĩnh viễn/i }));
    await waitFor(() => expect(websiteAdminApi.staff.delete).toHaveBeenCalledWith('staff-id', 3));
  });
});
