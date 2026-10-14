import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NewsWorkspace from './NewsWorkspace';

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  update: vi.fn(),
  listMyArticles: vi.fn(),
  listReviewInbox: vi.fn(),
  listProjectsInternal: vi.fn(),
  adminConfirm: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'manager-1',
      role: 'MARKETING_MANAGER',
      permissions: [
        'website.articles.read',
        'website.articles.create',
        'website.articles.update',
        'website.articles.publish',
        'website.articles.delete',
      ],
    },
  }),
}));

vi.mock('@/components/admin/admin-dialog-service', () => ({
  adminConfirm: mocks.adminConfirm,
  noticeAdmin: vi.fn(),
}));

vi.mock('@/features/content/api', () => ({
  contentApi: { listProjectsInternal: mocks.listProjectsInternal },
  articleApi: {
    createDraft: mocks.createDraft,
    update: mocks.update,
    listMyArticles: mocks.listMyArticles,
    listReviewInbox: mocks.listReviewInbox,
    transitionStatus: vi.fn(),
    deletePermanently: vi.fn(),
    getRevisions: vi.fn(),
    getAuditLogs: vi.fn(),
  },
}));

vi.mock('./ArticleEditor', () => ({
  default: ({ onDraftChange, onDirtyChange, onClose }: {
    onDraftChange: (data: unknown) => void;
    onDirtyChange: (dirty: boolean) => void;
    onClose: () => void;
  }) => (
    <div data-testid='article-editor'>
      <button
        onClick={() => {
          onDraftChange({
            title: 'Bài viết đang soạn',
            slug: 'bai-viet-dang-soan',
            category: 'market',
            sapo: 'Sapo',
            content: '<h2>Nội dung</h2>',
            gallery: [],
            seo: {},
            geo: { key_facts: [], faqs: [], sources: [], internal_links: [] },
          });
          onDirtyChange(true);
        }}
      >
        Nhập nội dung bài
      </button>
      <button onClick={onClose}>Đóng trình soạn</button>
    </div>
  ),
}));

describe('NewsWorkspace autosave integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    mocks.createDraft.mockResolvedValue({ id: '66b700000000000000000001', version: 1 });
    mocks.update.mockResolvedValue({ id: '66b700000000000000000001', version: 2 });
    mocks.listMyArticles.mockResolvedValue({ items: [], total: 0 });
    mocks.listReviewInbox.mockResolvedValue({ items: [], total: 0 });
    mocks.listProjectsInternal.mockResolvedValue([]);
    mocks.adminConfirm.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a provisional draft and autosaves editor changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NewsWorkspace />);

    await user.click(await screen.findByRole('button', { name: /Viết Bài Mới/i }));
    await screen.findByRole('button', { name: 'Nhập nội dung bài' });
    expect(mocks.createDraft).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Nhập nội dung bài' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenLastCalledWith(
      '66b700000000000000000001',
      expect.objectContaining({
        title: 'Bài viết đang soạn',
        slug: 'bai-viet-dang-soan',
        version: 1,
      }),
    );
  });
  it('uses cards on mobile and hides the desktop table', async () => {
    const { container } = render(<NewsWorkspace />);
    await screen.findByRole('button', { name: /Viết Bài Mới/i });
    expect(container.querySelector('table')?.parentElement).toHaveClass('hidden', 'md:block');
    expect(container.querySelector('.md\\:hidden')).toBeInTheDocument();
  });

  it('does not reload continuously when the API returns a next cursor', async () => {
    mocks.listMyArticles.mockResolvedValue({ items: [], total: 20, next_cursor: 'page-2' });

    render(<NewsWorkspace />);

    await waitFor(() => expect(mocks.listMyArticles).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mocks.listMyArticles).toHaveBeenCalledTimes(1);
    expect(mocks.listProjectsInternal).toHaveBeenCalledTimes(1);
  });

  it('renders the article editor directly under document body', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<NewsWorkspace />);

    await waitFor(() => expect(container.querySelector('.lucide-plus')).toBeInTheDocument());
    const createButton = container.querySelector('.lucide-plus')?.closest('button');
    expect(createButton).not.toBeNull();
    await user.click(createButton!);

    const editor = await screen.findByTestId('article-editor');
    expect(editor.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
