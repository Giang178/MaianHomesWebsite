import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import type {PublicContactSettings} from '@/features/contact/types';
import FloatingContactWidget from './FloatingContactWidget';

const contact: PublicContactSettings = {
  phone: '0969105059',
  phone_href: 'tel:0969105059',
  zalo_oa_id: '4085613041166590560',
  zalo_url: 'https://zalo.me/4085613041166590560',
  messenger_url: 'https://m.me/MaianHomes',
  email: 'contact@maianhomes.vn',
  email_href: 'mailto:contact@maianhomes.vn',
};

describe('FloatingContactWidget', () => {
  it('preloads the official Zalo launcher inside the single support menu', async () => {
    render(
      <FloatingContactWidget
        contact={contact}
        isVisible
        onOpenChat={vi.fn()}
        zaloWidget={<div data-testid='zalo-oa-chat-widget' />}
      />,
    );

    const toggle = screen.getByRole('button', {name: 'Mở menu hỗ trợ'});
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('support-channel-menu')).toHaveAttribute('hidden');
    expect(screen.getByTestId('zalo-oa-chat-widget')).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByRole('button', {name: 'Đóng menu hỗ trợ'})).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Maian Homes hỗ trợ bạn')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Nhắn Zalo với nhân viên'})).toHaveAttribute('href', 'https://zalo.me/4085613041166590560');
    expect(screen.getByRole('button', {name: 'Hỏi trợ lý Mái Đỏ'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Gọi điện tư vấn'})).toHaveAttribute('href', 'tel:0969105059');
    expect(screen.getByRole('link', {name: 'Gửi email'})).toHaveAttribute('href', 'mailto:contact@maianhomes.vn');
    expect(screen.getByRole('link', {name: 'Liên hệ qua Messenger'})).toHaveAttribute('href', 'https://m.me/MaianHomes');
    expect(screen.getByRole('link', {name: 'Nhắn tin Zalo OA'})).toHaveAttribute('href', 'https://zalo.me/4085613041166590560');

    expect(screen.getByTestId('support-channel-menu')).not.toHaveAttribute('hidden');
  });

  it('triggers onOpenZaloChat and closes menu when clicking Nhắn Zalo với nhân viên', async () => {
    const onOpenZaloChat = vi.fn();
    render(
      <FloatingContactWidget
        contact={contact}
        isVisible
        onOpenChat={vi.fn()}
        onOpenZaloChat={onOpenZaloChat}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    await userEvent.click(screen.getByRole('link', {name: 'Nhắn Zalo với nhân viên'}));

    expect(onOpenZaloChat).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', {name: 'Mở menu hỗ trợ'})).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses the managed Zalo URL as a fallback when no embedded opener is available', async () => {
    render(<FloatingContactWidget contact={contact} isVisible onOpenChat={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    expect(screen.getByRole('link', {name: 'Nhắn Zalo với nhân viên'})).toHaveAttribute(
      'href',
      'https://zalo.me/4085613041166590560',
    );
    expect(screen.getByRole('link', {name: 'Nhắn Zalo với nhân viên'})).toHaveAttribute('target', '_blank');
  });

  it('keeps Mái Đỏ available when public contact settings are empty', async () => {
    const onOpenChat = vi.fn();
    const empty = {
      phone: null,
      phone_href: null,
      zalo_url: null,
      messenger_url: null,
      email: null,
      email_href: null,
    };
    render(<FloatingContactWidget contact={empty} isVisible onOpenChat={onOpenChat} />);

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Hỏi trợ lý Mái Đỏ'}));

    expect(onOpenChat).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', {name: 'Mở menu hỗ trợ'})).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on escape or an outside pointer interaction and hides while chat is open', async () => {
    const {rerender} = render(
      <div>
        <button type='button'>Bên ngoài</button>
        <FloatingContactWidget contact={contact} isVisible onOpenChat={vi.fn()} />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.getByRole('button', {name: 'Mở menu hỗ trợ'})).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByRole('button', {name: 'Mở menu hỗ trợ'}));
    fireEvent.pointerDown(screen.getByRole('button', {name: 'Bên ngoài'}));
    expect(screen.getByRole('button', {name: 'Mở menu hỗ trợ'})).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <div>
        <button type='button'>Bên ngoài</button>
        <FloatingContactWidget contact={contact} isVisible={false} onOpenChat={vi.fn()} />
      </div>,
    );
    expect(screen.queryByTestId('floating-contact-widget')).not.toBeInTheDocument();
  });
});
