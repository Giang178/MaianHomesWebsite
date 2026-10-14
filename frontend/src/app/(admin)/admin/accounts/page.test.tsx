import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccountsPage from './page';
import { accountsApi } from '@/features/accounts/api';
import type { AccountUser } from '@/features/accounts/types';

vi.mock('@/features/accounts/api', () => ({
  accountsApi: {
    list: vi.fn(), create: vi.fn(), update: vi.fn(),
    revokeSessions: vi.fn(), issue: vi.fn(), permissions: vi.fn(),
  },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ceo@maianhomes.vn', role: 'CEO', name: 'CEO', permissions: ['*'] },
  }),
}));

const accounts: AccountUser[] = [
  { id: 'ceo-1', email: 'ceo@maianhomes.vn', full_name: 'Tổng Giám đốc',
    role: 'CEO', permissions: ['*'], status: 'ACTIVE', is_active: true, must_change_password: false },
  { id: 'marketing-1', email: 'marketing@maianhomes.vn', full_name: 'Marketing mới',
    role: 'MARKETING', permissions: ['website.pages.read'], status: 'PENDING_SETUP',
    is_active: false, must_change_password: false },
];

describe('AdminAccountsPage website-only permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(accountsApi.list).mockResolvedValue(accounts);
    vi.mocked(accountsApi.permissions).mockResolvedValue({
      items: ['website.pages.read'],
      presets: { ADMIN: ['website.pages.read'], MARKETING: ['website.pages.read'] },
      dependencies: {},
    });
  });

  it('loads accounts and permission metadata together', async () => {
    render(<AdminAccountsPage />);
    expect(await screen.findByRole('heading', { name: 'Tài khoản & Phân quyền' })).toBeInTheDocument();
    expect(screen.getAllByText('Tổng Giám đốc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marketing mới').length).toBeGreaterThan(0);
    expect(screen.getByText('1 Chờ cấp')).toBeInTheDocument();
    expect(accountsApi.permissions).toHaveBeenCalledOnce();
  });

  it('only exposes the current CEO, Admin and Marketing role model', async () => {
    render(<AdminAccountsPage />);
    expect((await screen.findAllByText('Marketing mới')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/SALES|CUSTOMER_MANAGER/)).not.toBeInTheDocument();
  });
  it('keeps the desktop table hidden on mobile while cards remain available', async () => {
    const { container } = render(<AdminAccountsPage />);
    await screen.findAllByText('Marketing mới');
    expect(container.querySelector('table')?.parentElement).toHaveClass('hidden', 'md:block');
    expect(container.querySelector('.md\\:hidden')).toBeInTheDocument();
  });

  it('reports invitation delivery as queued instead of already sent', async () => {
    vi.mocked(accountsApi.issue).mockResolvedValue({
      success: true,
      delivery_queued: true,
      status: 'PENDING_SETUP',
    });
    const user = userEvent.setup();
    render(<AdminAccountsPage />);

    const issueButtons = await screen.findAllByRole('button', { name: 'Cấp TK' });
    await user.click(issueButtons[0]);

    expect(accountsApi.issue).toHaveBeenCalledWith('marketing-1');
    expect(await screen.findByText(/Đã xếp hàng gửi thư kích hoạt/)).toBeInTheDocument();
  });
});
