import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/features/auth/api';
import SetupAccountPage from './page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid-invitation-token'),
}));
vi.mock('@/features/auth/api', () => ({
  authApi: {
    passwordPolicy: vi.fn(),
    setupAccount: vi.fn(),
  },
}));

describe('SetupAccountPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.passwordPolicy).mockResolvedValue({
      password_min_length: 8,
      require_uppercase: true,
      require_lowercase: true,
      require_digit: true,
      require_special: true,
    });
  });

  it('activates an invited account with the one-time token', async () => {
    vi.mocked(authApi.setupAccount).mockResolvedValue({
      success: true,
      message: 'Tài khoản đã được kích hoạt',
    });
    render(<SetupAccountPage />);

    await userEvent.type(await screen.findByLabelText('Mật khẩu mới'), 'SafePass1!');
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu'), 'SafePass1!');
    await userEvent.click(screen.getByRole('button', { name: /Kích hoạt tài khoản/i }));

    await waitFor(() => {
      expect(authApi.setupAccount).toHaveBeenCalledWith('valid-invitation-token', 'SafePass1!');
    });
    expect(await screen.findByRole('heading', { name: 'Tài khoản đã được kích hoạt' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Đăng nhập/i })).toHaveAttribute('href', '/login');
  });

  it('rejects mismatched passwords before calling the API', async () => {
    render(<SetupAccountPage />);
    await userEvent.type(await screen.findByLabelText('Mật khẩu mới'), 'SafePass1!');
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: /Kích hoạt tài khoản/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu nhập lại không khớp');
    expect(authApi.setupAccount).not.toHaveBeenCalled();
  });
});
