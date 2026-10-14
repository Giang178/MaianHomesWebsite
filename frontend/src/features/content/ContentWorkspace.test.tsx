import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import ContentWorkspace from './ContentWorkspace';
import {adminConfirm} from '@/components/admin/admin-dialog-service';
import {projectsApi} from '@/features/content/api/projects';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: 'MARKETING_MANAGER',
      permissions: ['website.projects.read', 'website.projects.create', 'website.projects.update'],
    },
  }),
}));

vi.mock('@/components/admin/admin-dialog-service', () => ({
  adminConfirm: vi.fn(),
  adminPrompt: vi.fn(),
}));

vi.mock('@/features/content/api/projects', () => ({
  projectsApi: {list: vi.fn().mockResolvedValue([])},
}));

vi.mock('@/features/content/api/workflow', () => ({
  createIdempotencyKey: () => 'test-key',
}));

vi.mock('./projects/ProjectEditor', () => ({
  DEFAULT_FORM: {},
  default: ({onClose, onDirtyChange}: {onClose: () => void; onDirtyChange: (dirty: boolean) => void}) => (
    <div>
      <button onClick={() => onDirtyChange(true)}>Nhập thông tin dự án</button>
      <button onClick={() => onDirtyChange(false)}>Xóa hết thông tin dự án</button>
      <button onClick={onClose}>Thoát form dự án</button>
    </div>
  ),
}));

describe('Content project creation close flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes an untouched new project without asking to save a draft', async () => {
    render(<ContentWorkspace/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Thêm dự án mới'}));
    await userEvent.click(screen.getByRole('button', {name: 'Thoát form dự án'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminConfirm).not.toHaveBeenCalled();
  });

  it('asks only once before discarding entered project information', async () => {
    vi.mocked(adminConfirm).mockResolvedValue(true);
    render(<ContentWorkspace/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Thêm dự án mới'}));
    await userEvent.click(screen.getByRole('button', {name: 'Nhập thông tin dự án'}));
    await userEvent.click(screen.getByRole('button', {name: 'Thoát form dự án'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes without confirmation after all newly entered information is removed', async () => {
    render(<ContentWorkspace/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Thêm dự án mới'}));
    await userEvent.click(screen.getByRole('button', {name: 'Nhập thông tin dự án'}));
    await userEvent.click(screen.getByRole('button', {name: 'Xóa hết thông tin dự án'}));
    await userEvent.click(screen.getByRole('button', {name: 'Thoát form dự án'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminConfirm).not.toHaveBeenCalled();
  });
});

describe('Content project filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows every loaded project after clicking the all-projects card', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue({
      items: [
        {
          id: 'project-1',
          name: 'The Privé',
          slug: 'the-prive',
          location: 'Thành phố Hồ Chí Minh',
          price_range: '7 - 12 tỷ',
          status: 'AVAILABLE',
          workflow_status: 'DRAFT',
          publication_status: 'PUBLISHED',
          is_published: true,
          version: 1,
        },
      ],
      next_cursor: null,
      total: 1,
    });

    render(<ContentWorkspace/>);
    expect(await screen.findAllByText('The Privé')).toHaveLength(2);

    await userEvent.type(
      screen.getByPlaceholderText('Tìm dự án theo tên hoặc vị trí...'),
      'không tồn tại',
    );
    await userEvent.selectOptions(screen.getByLabelText('Loc tinh trang du an'), 'HANDING_OVER');
    expect(screen.queryByText('The Privé')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Tất cả dự án (nhấp để bỏ lọc)'));

    expect(await screen.findAllByText('The Privé')).toHaveLength(2);
    expect(screen.getByPlaceholderText('Tìm dự án theo tên hoặc vị trí...')).toHaveValue('');
    expect(screen.getByLabelText('Loc tinh trang du an')).toHaveValue('');
  });
});
