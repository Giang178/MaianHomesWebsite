import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {contactApi} from '@/features/contact/api';
import MayaAssistant from './MayaAssistant';

vi.mock('@/features/contact/api', () => ({
  contactApi: {publicSettings: vi.fn()},
}));

describe('MayaAssistant', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(contactApi.publicSettings).mockRejectedValue(new Error('offline'));
  });

  it('uses one existing chat window and restores the widget after closing it', async () => {
    render(<MayaAssistant />);

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    await userEvent.click(screen.getByRole('button', {name: 'Hỏi trợ lý Mái Đỏ'}));

    expect(screen.getByText('Mái Đỏ · Maian Homes')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-contact-widget')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Đóng chat'}));
    expect(screen.getByTestId('floating-contact-widget')).toBeInTheDocument();
    expect(screen.queryByText('Mái Đỏ · Maian Homes')).not.toBeInTheDocument();
  });
});
