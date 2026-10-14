import {act, createRef} from 'react';
import {render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import ZaloOAChatWidget, {type ZaloOAChatWidgetHandle} from './ZaloOAChatWidget';

const OA_ID = '4085613041166590560';
const FALLBACK_URL = `https://zalo.me/${OA_ID}`;

function appendWidgetFrame(height: number) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('height', String(height));
  screen.getByTestId('zalo-oa-chat-widget').appendChild(iframe);
  return iframe;
}

describe('ZaloOAChatWidget', () => {
  beforeEach(() => {
    window.ZaloSocialSDK = {
      reload: vi.fn(),
      openChatWidget: vi.fn(),
      closeChatWidget: vi.fn(),
    };
  });

  afterEach(() => {
    delete window.ZaloSocialSDK;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows chat only after the official iframe has expanded beyond its launcher size', () => {
    vi.useFakeTimers();
    const ref = createRef<ZaloOAChatWidgetHandle>();
    const onOpenChange = vi.fn();
    render(
      <ZaloOAChatWidget
        ref={ref}
        oaId={OA_ID}
        fallbackUrl={FALLBACK_URL}
        onOpenChange={onOpenChange}
      />,
    );

    const widget = screen.getByTestId('zalo-oa-chat-widget');
    const iframe = appendWidgetFrame(46);
    expect(widget).toHaveAttribute('data-oaid', OA_ID);
    expect(widget).toHaveAttribute('data-state', 'closed');

    act(() => {
      expect(ref.current?.open()).toBe(true);
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://page.widget.zalo.me',
        data: {cmd: 'zchat_widget_open_chat_box', width: 70, height: 46},
      }));
      vi.advanceTimersByTime(0);
    });

    expect(widget).toHaveAttribute('data-state', 'closed');
    expect(onOpenChange).not.toHaveBeenCalledWith(true);

    iframe.setAttribute('height', '420');
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://page.widget.zalo.me',
        data: {cmd: 'zchat_widget_open_chat_box', width: 350, height: 420},
      }));
      vi.advanceTimersByTime(0);
    });

    expect(widget).toHaveAttribute('data-state', 'open');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://page.widget.zalo.me',
        data: {cmd: 'zchat_widget_close_chat_box', width: 70, height: 70},
      }));
    });

    expect(widget).toHaveAttribute('data-state', 'closed');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('retries opening after the Zalo iframe announces that it is ready', () => {
    vi.useFakeTimers();
    const ref = createRef<ZaloOAChatWidgetHandle>();
    render(<ZaloOAChatWidget ref={ref} oaId={OA_ID} fallbackUrl={FALLBACK_URL} />);

    act(() => {
      ref.current?.open();
    });
    const callsBeforeReady = vi.mocked(window.ZaloSocialSDK.openChatWidget!).mock.calls.length;

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://page.widget.zalo.me',
        data: {cmd: 'zchat_widget_close_chat_box', width: 70, height: 70},
      }));
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId('zalo-oa-chat-widget')).toHaveAttribute('data-state', 'closed');
    expect(vi.mocked(window.ZaloSocialSDK.openChatWidget!).mock.calls.length).toBeGreaterThan(callsBeforeReady);
  });

  it('ignores forged close messages from other origins', () => {
    vi.useFakeTimers();
    const ref = createRef<ZaloOAChatWidgetHandle>();
    render(<ZaloOAChatWidget ref={ref} oaId={OA_ID} fallbackUrl={FALLBACK_URL} />);
    appendWidgetFrame(420);

    act(() => {
      ref.current?.open();
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://page.widget.zalo.me',
        data: {cmd: 'zchat_widget_open_chat_box'},
      }));
      vi.advanceTimersByTime(0);
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://example.com',
        data: {cmd: 'zchat_widget_close_chat_box'},
      }));
    });

    expect(screen.getByTestId('zalo-oa-chat-widget')).toHaveAttribute('data-state', 'open');
  });

  it('falls back to the managed OA URL when the SDK is unavailable', () => {
    delete window.ZaloSocialSDK;
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const ref = createRef<ZaloOAChatWidgetHandle>();
    render(<ZaloOAChatWidget ref={ref} oaId={OA_ID} fallbackUrl={FALLBACK_URL} />);

    act(() => {
      expect(ref.current?.open()).toBe(false);
    });

    expect(open).toHaveBeenCalledWith(FALLBACK_URL, '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('zalo-oa-chat-widget')).toHaveAttribute('data-state', 'closed');
  });
});
