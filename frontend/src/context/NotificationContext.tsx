'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { notificationsApi } from '@/features/system/notifications/api';
import {
  NOTIFICATION_FALLBACK_POLL_MS,
  notificationReconnectDelay,
  notificationRefreshDue,
} from './notification-polling';
import { useAuth } from './AuthContext';

interface NotificationPayload {
  id?: string;
  _id?: string;
  event_id?: string;
  type?: 'notification';
  title: string;
  message: string;
  module?: string;
  link?: string;
  created_at?: string;
  is_read?: boolean;
}

interface NotificationContextType {
  notifications: NotificationPayload[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const isDev = process.env.NODE_ENV === 'development';

function notificationKey(notification: NotificationPayload): string {
  return notification.id || notification._id || notification.event_id || `${notification.created_at}:${notification.title}`;
}

function mergeNotifications(current: NotificationPayload[], incoming: NotificationPayload[]): NotificationPayload[] {
  const merged = new Map<string, NotificationPayload>();
  [...current, ...incoming].forEach((notification) => {
    const key = notificationKey(notification);
    const previous = merged.get(key);
    merged.set(key, previous
      ? { ...previous, ...notification, is_read: Boolean(previous.is_read || notification.is_read) }
      : notification
    );
  });
  return Array.from(merged.values())
    .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
    .slice(0, 200);
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdminRoute = Boolean(pathname?.startsWith('/admin'));
  const userIdentity = !isAuthLoading && isAdminRoute ? (user?.id || user?.employee_id || user?.email || '') : '';
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);
  const pongTimer = useRef<number | null>(null);
  const reconnectAttempt = useRef(0);
  const reconcileOnOpen = useRef(false);
  const activeUserIdentity = useRef(userIdentity);
  const lastSuccessfulRefresh = useRef(0);
  const refreshInFlight = useRef<{ owner: string; promise: Promise<void> } | null>(null);

  useEffect(() => {
    activeUserIdentity.current = userIdentity;
  }, [userIdentity]);

  const refreshNotifications = useCallback(async () => {
    if (!userIdentity) return;
    const existing = refreshInFlight.current;
    if (existing?.owner === userIdentity) {
      await existing.promise;
      return;
    }

    const promise = (async () => {
      try {
        const requestOwner = userIdentity;
        const data = await notificationsApi.list();
        if (requestOwner !== activeUserIdentity.current) return;
        if (Array.isArray(data)) {
          setNotifications((current) => mergeNotifications(current, data as NotificationPayload[]));
          lastSuccessfulRefresh.current = Date.now();
        }
      } catch (error) {
        if (isDev) console.warn('Unable to refresh notifications', error);
      }
    })();
    const entry = { owner: userIdentity, promise };
    refreshInFlight.current = entry;
    try {
      await promise;
    } finally {
      if (refreshInFlight.current === entry) refreshInFlight.current = null;
    }
  }, [userIdentity]);

  useEffect(() => {
    if (!userIdentity) {
      lastSuccessfulRefresh.current = 0;
      reconcileOnOpen.current = false;
      reconnectAttempt.current = 0;
      const clearTimer = window.setTimeout(() => setNotifications([]), 0);
      ws.current?.close(1000, 'Signed out');
      ws.current = null;
      return () => window.clearTimeout(clearTimer);
    }

    let disposed = false;

    const clearSocketTimers = () => {
      if (heartbeatTimer.current !== null) window.clearInterval(heartbeatTimer.current);
      if (pongTimer.current !== null) window.clearTimeout(pongTimer.current);
      heartbeatTimer.current = null;
      pongTimer.current = null;
    };

    const scheduleReconnect = (connect: () => void) => {
      if (disposed || !navigator.onLine || reconnectTimer.current !== null) return;
      if (reconnectAttempt.current >= 5) {
        if (isDev) console.warn('Max WebSocket reconnect attempts reached. Waiting for next session refresh.');
        return;
      }
      const delay = notificationReconnectDelay(reconnectAttempt.current);
      reconnectAttempt.current += 1;
      reconnectTimer.current = window.setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, delay);
    };

    const connectWebSocket = () => {
      if (disposed || !navigator.onLine || ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws/notifications`);
      ws.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        heartbeatTimer.current = window.setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(JSON.stringify({ type: 'ping' }));
          if (pongTimer.current !== null) window.clearTimeout(pongTimer.current);
          pongTimer.current = window.setTimeout(() => socket.close(4000, 'Heartbeat timeout'), 10_000);
        }, 25_000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as NotificationPayload | { type?: string };
          if (payload.type === 'ready') {
            reconnectAttempt.current = 0;
            const forceReconcile = reconcileOnOpen.current;
            reconcileOnOpen.current = false;
            if (forceReconcile || notificationRefreshDue(true, lastSuccessfulRefresh.current, Date.now())) {
              void refreshNotifications();
            }
            return;
          }
          if (payload.type === 'pong') {
            if (pongTimer.current !== null) window.clearTimeout(pongTimer.current);
            pongTimer.current = null;
            return;
          }
          if (payload.type === 'notification' && 'title' in payload) {
            setNotifications((current) => mergeNotifications(current, [{ ...payload, is_read: false }]));
          }
        } catch (error) {
          if (isDev) console.warn('Invalid WebSocket notification payload', error);
        }
      };

      socket.onerror = () => {
        // Browsers intentionally hide WebSocket error details; onclose has the useful code.
      };

      socket.onclose = (event) => {
        clearSocketTimers();
        if (ws.current === socket) ws.current = null;
        if (isDev && !disposed) console.warn('WebSocket closed', { code: event.code, reason: event.reason });
        if (!disposed && event.code !== 1000) reconcileOnOpen.current = true;
        // Do not reconnect on Normal Closure (1000) or Policy Violation / Unauthorized (1008 / 4001)
        if (!disposed && event.code !== 1000 && event.code !== 1008 && event.code !== 4001) {
          scheduleReconnect(connectWebSocket);
        }
      };
    };

    const handleOnline = () => connectWebSocket();
    const handleOffline = () => ws.current?.close(1000, 'Offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const initialRefreshTimer = window.setTimeout(() => {
      const websocketOpen = ws.current?.readyState === WebSocket.OPEN;
      if (notificationRefreshDue(websocketOpen, lastSuccessfulRefresh.current, Date.now())) {
        void refreshNotifications();
      }
    }, 0);
    const pollTimer = window.setInterval(() => {
      const websocketOpen = ws.current?.readyState === WebSocket.OPEN;
      if (notificationRefreshDue(websocketOpen, lastSuccessfulRefresh.current, Date.now())) {
        void refreshNotifications();
      }
    }, NOTIFICATION_FALLBACK_POLL_MS);
    connectWebSocket();

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearTimeout(initialRefreshTimer);
      window.clearInterval(pollTimer);
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
      clearSocketTimers();
      ws.current?.close(1000, 'Provider disposed');
      ws.current = null;
    };
  }, [refreshNotifications, userIdentity]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((current) => current.map((item) =>
        (item.id === id || item._id === id) ? { ...item, is_read: true } : item
      ));
    } catch (error) {
      if (isDev) console.warn('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      if (isDev) console.warn('Failed to mark all notifications as read:', error);
    }
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
