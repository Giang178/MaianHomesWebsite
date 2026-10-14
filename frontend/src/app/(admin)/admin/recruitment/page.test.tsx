import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecruitmentAdminPage from './page';
import { websiteAdminApi } from '@/features/website/admin/api';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: ['website.recruitment.read', 'website.recruitment.create', 'website.recruitment.update'] } }),
}));
vi.mock('@/features/content/articles/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="Nội dung tuyển dụng" value={value} onChange={event => onChange(event.target.value)} />,
}));
vi.mock('@/features/website/admin/api', () => ({
  websiteAdminApi: {
    recruitment: { list: vi.fn(), applications: vi.fn(), create: vi.fn(), update: vi.fn(), transition: vi.fn() },
  },
}));

describe('RecruitmentAdminPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(websiteAdminApi.recruitment.list).mockResolvedValue({ items: [] });
    vi.mocked(websiteAdminApi.recruitment.applications).mockResolvedValue({ items: [] });
  });

  it('opens a complete job editor matching the public job layout', async () => {
    render(<RecruitmentAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tin tuyển dụng' }));
    expect(screen.getByRole('heading', { name: 'Tạo tin tuyển dụng' })).toBeInTheDocument();
    expect(screen.getByText('Tự động tạo từ tên vị trí khi lưu')).toBeInTheDocument();
    expect(screen.getByText('Mô tả công việc')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu ứng viên')).toBeInTheDocument();
    expect(screen.getByText('Quyền lợi và đãi ngộ')).toBeInTheDocument();
    expect(screen.getByText(/SEO bài tuyển dụng/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /slug/i })).not.toBeInTheDocument();
  });
});
