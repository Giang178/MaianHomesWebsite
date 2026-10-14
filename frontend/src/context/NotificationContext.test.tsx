import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listNotificationsInternal: vi.fn(),
}));

vi.mock('@/features/system/notifications/api', () => ({
  notificationsApi: {
    list: apiMocks.listNotificationsInternal,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    user: {
      id: 'account-1',
      email: 'person@example.com',
    },
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

import { NotificationProvider } from './NotificationContext';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = vi.fn();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  message(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

describe('NotificationProvider WebSocket recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    FakeWebSocket.instances = [];
    apiMocks.listNotificationsInternal.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('deduplicates initial reconciliation and forces one after an abnormal reconnect', async () => {
    const view = render(
      <NotificationProvider>
        <div>child</div>
      </NotificationProvider>,
    );
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      FakeWebSocket.instances[0].open();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMocks.listNotificationsInternal).toHaveBeenCalledTimes(1);

    act(() => {
      FakeWebSocket.instances[0].close(1013, 'Realtime temporarily unavailable');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    await act(async () => {
      FakeWebSocket.instances[1].open();
      await Promise.resolve();
    });
    expect(apiMocks.listNotificationsInternal).toHaveBeenCalledTimes(1);

    await act(async () => {
      FakeWebSocket.instances[1].message({ type: 'ready' });
      await Promise.resolve();
    });
    expect(apiMocks.listNotificationsInternal).toHaveBeenCalledTimes(2);

    view.unmount();
  });

  it('does not reset backoff when a socket opens but never becomes ready', async () => {
    const view = render(
      <NotificationProvider>
        <div>child</div>
      </NotificationProvider>,
    );
    await act(async () => {
      FakeWebSocket.instances[0].open();
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      FakeWebSocket.instances[0].close(1013, 'not ready');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => {
      FakeWebSocket.instances[1].open();
      FakeWebSocket.instances[1].close(1013, 'still not ready');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);

    view.unmount();
  });
});
