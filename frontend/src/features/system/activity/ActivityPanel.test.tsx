import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {activityApi} from './api';
import {ActivityPanel} from './ActivityPanel';
import type {ActivityEvent} from './types';

vi.mock('./api', () => ({
  activityApi: {
    list: vi.fn(),
    detail: vi.fn(),
    metadata: vi.fn(),
    purgePreview: vi.fn(),
    purge: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

const metadata = {
  modules: [{value: 'SYSTEM', label: 'Hệ thống'}],
  categories: [{value: 'DATA_CHANGE', label: 'Thay đổi dữ liệu'}],
  results: [{value: 'SUCCESS', label: 'Thành công'}],
  severities: [{value: 'INFO', label: 'Thông tin'}],
  event_types: [{value: 'LOGIN_SUCCESS', label: 'Đăng nhập thành công'}],
};

const event = (id: string, email: string): ActivityEvent => ({
  id, occurred_at: '2026-08-01T00:00:00Z', module: 'SYSTEM', category: 'DATA_CHANGE',
  event_type: 'LOGIN_SUCCESS', result: 'SUCCESS', severity: 'INFO', actor_email: email,
});

describe('ActivityPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(activityApi.metadata).mockResolvedValue(metadata);
    vi.mocked(activityApi.detail).mockImplementation(async value => event(value, 'detail@example.com'));
  });

  it('loads opaque cursor pages without duplicate rows', async () => {
    vi.mocked(activityApi.list)
      .mockResolvedValueOnce({items: [event('1', 'first@example.com')], next_cursor: 'signed-cursor', count: 1})
      .mockResolvedValueOnce({items: [event('2', 'second@example.com')], next_cursor: null, count: 1});
    render(<ActivityPanel/>);
    expect(await screen.findByText('first@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Tải thêm nhật ký'}));
    expect(await screen.findByText('second@example.com')).toBeInTheDocument();
    expect(activityApi.list).toHaveBeenLastCalledWith(expect.objectContaining({cursor: 'signed-cursor'}));
  });

  it('sends registry filters and Bangkok timestamps as UTC values', async () => {
    vi.mocked(activityApi.list).mockResolvedValue({items: [], next_cursor: null, count: 0});
    render(<ActivityPanel/>);
    await userEvent.selectOptions(await screen.findByLabelText('Phân hệ'), 'SYSTEM');
    await userEvent.click(screen.getByRole('button', {name: 'Tùy chọn'}));
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-08-01T08:00');
    await waitFor(() => expect(activityApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({module: 'SYSTEM', start: '2026-08-01T01:00:00.000Z'}), expect.any(AbortSignal),
    ));
  });

  it('keeps technical filters closed and never displays a target id as its name', async () => {
    vi.mocked(activityApi.list).mockResolvedValue({
      items: [{...event('1', 'it@example.com'), target: {type: 'LEAD', id: '507f1f77bcf86cd799439011'}}],
      next_cursor: null, count: 1,
    });
    render(<ActivityPanel/>);
    expect(await screen.findByText('Đối tượng chưa xác định')).toBeInTheDocument();
    expect(screen.queryByLabelText('Request ID')).not.toBeInTheDocument();
    expect(screen.queryByText('507f1f77bcf86cd799439011')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /Tra cứu kỹ thuật/}));
    expect(screen.getByLabelText('Request ID')).toBeInTheDocument();
  });

  it('requires preview, reason and confirmation before purging', async () => {
    vi.mocked(activityApi.list).mockResolvedValue({items: [], next_cursor: null, count: 0});
    vi.mocked(activityApi.purgePreview).mockResolvedValue({
      cutoff: '2026-02-01T00:00:00Z', eligible_count: 12, modules: {SYSTEM: 12},
      preview_token: 'signed-preview-token', confirmation_text: 'XOA NHAT KY TREN 180 NGAY',
    });
    vi.mocked(activityApi.purge).mockResolvedValue({deleted_count: 12, cutoff: '2026-02-01T00:00:00Z', message: 'Đã xóa 12 nhật ký.'});
    render(<ActivityPanel/>);
    await userEvent.click(await screen.findByRole('button', {name: 'Xóa log cũ'}));
    await userEvent.type(await screen.findByLabelText('Lý do (tối thiểu 10 ký tự)'), 'Dọn dữ liệu theo chính sách');
    await userEvent.type(screen.getByLabelText(/Nhập chính xác/), 'XOA NHAT KY TREN 180 NGAY');
    await userEvent.click(screen.getByRole('button', {name: 'Xóa 12 bản ghi'}));
    await waitFor(() => expect(activityApi.purge).toHaveBeenCalledWith({
      preview_token: 'signed-preview-token', reason: 'Dọn dữ liệu theo chính sách', confirmation: 'XOA NHAT KY TREN 180 NGAY',
    }));
  });
});
