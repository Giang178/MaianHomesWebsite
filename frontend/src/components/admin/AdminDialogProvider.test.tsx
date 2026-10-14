import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminDialogProvider } from './AdminDialogProvider';
import {
  confirmAdminDialog,
  reasonAdminDialog,
} from './admin-dialog-service';


function Harness() {
  const [result, setResult] = useState('none');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const value = await reasonAdminDialog({ title: 'Nhập lý do' });
          setResult(String(value));
        }}
      >
        Mở lý do
      </button>
      <button
        type="button"
        onClick={async () => {
          const first = confirmAdminDialog({ title: 'Xác nhận đầu tiên' });
          const second = reasonAdminDialog({ title: 'Lý do thứ hai' });
          const values = await Promise.all([first, second]);
          setResult(values.join(':'));
        }}
      >
        Mở hàng đợi
      </button>
      <output aria-label="Kết quả">{result}</output>
    </>
  );
}


describe('AdminDialogProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps textarea focus while typing and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(
      <AdminDialogProvider>
        <Harness />
      </AdminDialogProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Mở lý do' });
    await user.click(trigger);
    const textarea = screen.getByRole('textbox', { name: /Lý do/ });

    await user.type(textarea, 'abcdef');

    expect(textarea).toHaveValue('abcdef');
    expect(textarea).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kết quả')).toHaveTextContent('null');
    expect(trigger).toHaveFocus();
  });

  it('serializes concurrent dialog requests without losing either promise', async () => {
    const user = userEvent.setup();
    render(
      <AdminDialogProvider>
        <Harness />
      </AdminDialogProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Mở hàng đợi' }));

    expect(screen.getByRole('dialog', { name: 'Xác nhận đầu tiên' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(screen.getByRole('dialog', { name: 'Lý do thứ hai' })).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: /Lý do/ }), 'abcdef');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(screen.getByLabelText('Kết quả')).toHaveTextContent('true:abcdef');
  });

  it('does not let an old toast timer clear a newer toast', () => {
    vi.useFakeTimers();
    render(
      <AdminDialogProvider>
        <Harness />
      </AdminDialogProvider>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('admin:notice', {
        detail: { tone: 'error', message: 'Toast A' },
      }));
    });
    act(() => vi.advanceTimersByTime(4000));
    act(() => {
      window.dispatchEvent(new CustomEvent('admin:notice', {
        detail: { tone: 'error', message: 'Toast B' },
      }));
    });
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText('Toast B')).toBeVisible();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Toast B')).not.toBeInTheDocument();
  });

  it('close button cancels the active reason dialog', async () => {
    const user = userEvent.setup();
    render(
      <AdminDialogProvider>
        <Harness />
      </AdminDialogProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Mở lý do' }));
    await user.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Kết quả')).toHaveTextContent('null');
    });
  });
  it('keeps keyboard focus inside the modal', async () => {
    const user = userEvent.setup();
    render(
      <AdminDialogProvider>
        <Harness />
      </AdminDialogProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Mở hàng đợi' }));
    const close = screen.getByRole('button', { name: 'Đóng' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
