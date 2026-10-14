import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  confirm: vi.fn(async () => true),
  prompt: vi.fn(),
  notice: vi.fn(),
  user: { role: 'MARKETING', permissions: ['website.pages.read', 'website.pages.update', 'website.pages.publish'] },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock('@/features/content/api', () => ({
  companyKnowledgeApi: {
    get: mocks.get,
    update: mocks.update,
    transition: mocks.transition,
  },
}));
vi.mock('@/components/admin/admin-dialog-service', () => ({
  adminConfirm: mocks.confirm,
  adminPrompt: mocks.prompt,
  noticeAdmin: mocks.notice,
}));

import CompanyKnowledgePanel from './CompanyKnowledgePanel';

const draft = {
  company_name: 'Maian Homes',
  overview: 'Thông tin đã xác minh',
  services: [],
  service_areas: [],
  working_hours: '',
  consultation_process: [],
  policies: [],
  faqs: [],
  effective_date: '',
};

describe('CompanyKnowledgePanel workflow safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.permissions = ['website.pages.read', 'website.pages.update', 'website.pages.publish'];
  });

  it('renders a retry state instead of an empty editable form when loading fails', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Không thể tải dữ liệu'));
    render(<CompanyKnowledgePanel />);
    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tên công ty')).not.toBeInTheDocument();
  });

  it('renders read-only controls from permissions instead of the role name', async () => {
    mocks.user.permissions = ['website.pages.read'];
    mocks.get.mockResolvedValueOnce({
      version: 1, workflow_status: 'DRAFT', publication_status: 'NEVER_PUBLISHED', draft,
    });

    render(<CompanyKnowledgePanel />);

    expect(await screen.findByText(/Chế độ chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Giới thiệu')).toBeDisabled();
  });
  it('publishes local edits after saving them through the API', async () => {
    const savedDraft = { ...draft, overview: 'Nội dung vừa sửa' };
    mocks.get.mockResolvedValueOnce({ version: 4, workflow_status: 'PUBLISHED', publication_status: 'UNPUBLISHED', draft });
    mocks.update.mockResolvedValueOnce({ version: 5, workflow_status: 'PUBLISHED', publication_status: 'UNPUBLISHED', draft: savedDraft });
    mocks.transition.mockResolvedValueOnce({ version: 6, workflow_status: 'PUBLISHED', publication_status: 'PUBLISHED', draft: savedDraft });
    render(<CompanyKnowledgePanel />);
    const overview = await screen.findByLabelText('Giới thiệu');
    fireEvent.change(overview, { target: { value: 'Nội dung vừa sửa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(savedDraft, 4));
    expect(mocks.transition).toHaveBeenCalledWith('publish', 5);
  });

  it('saves a dirty draft before publishing the new version', async () => {
    const savedDraft = { ...draft, overview: 'Nội dung mới' };
    mocks.get.mockResolvedValueOnce({ version: 1, workflow_status: 'DRAFT', publication_status: 'NEVER_PUBLISHED', draft });
    mocks.update.mockResolvedValueOnce({ version: 2, workflow_status: 'DRAFT', publication_status: 'NEVER_PUBLISHED', draft: savedDraft });
    mocks.transition.mockResolvedValueOnce({ version: 3, workflow_status: 'PUBLISHED', publication_status: 'PUBLISHED', draft: savedDraft });
    render(<CompanyKnowledgePanel />);
    fireEvent.change(await screen.findByLabelText('Giới thiệu'), { target: { value: 'Nội dung mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith('publish', 2));
    expect(mocks.update).toHaveBeenCalledWith(savedDraft, 1);
  });

  it('publishes a CEO dirty draft directly without a special approval path', async () => {
    mocks.user.role = 'CEO';
    const savedDraft = { ...draft, overview: 'CEO cập nhật trực tiếp' };
    mocks.get.mockResolvedValueOnce({ version: 1, workflow_status: 'DRAFT', publication_status: 'NEVER_PUBLISHED', draft });
    mocks.update.mockResolvedValueOnce({ version: 2, workflow_status: 'DRAFT', publication_status: 'NEVER_PUBLISHED', draft: savedDraft });
    mocks.transition.mockResolvedValueOnce({ version: 3, workflow_status: 'PUBLISHED', publication_status: 'PUBLISHED', draft: savedDraft });
    render(<CompanyKnowledgePanel />);
    expect(await screen.findByRole('button', { name: 'Xuất bản' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Giới thiệu'), { target: { value: 'CEO cập nhật trực tiếp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith('publish', 2));
    expect(mocks.update).toHaveBeenCalledWith(savedDraft, 1);
    mocks.user.role = 'MARKETING';
  });
});
