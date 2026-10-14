'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AdminModal,
  AdminReasonDialog,
  AdminToast,
  type AdminToastValue,
} from './AdminFeedbackPrimitives';
import type { AdminDialogRequest } from './admin-dialog-service';

type PendingDialog = {
  request: AdminDialogRequest;
  resolve: (value: boolean | string | null) => void;
  returnFocus?: HTMLElement | null;
};

type ActiveNotice = {
  id: number;
  value: AdminToastValue;
};

export function AdminDialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PendingDialog[]>([]);
  const [notice, setNotice] = useState<ActiveNotice | null>(null);
  const queueRef = useRef(queue);
  const noticeSequence = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const closeNotice = useCallback(() => {
    if (noticeTimer.current !== null) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNotice(null);
  }, []);

  useEffect(() => {
    const dialogHandler = (event: Event) => {
      const pending = (event as CustomEvent<PendingDialog>).detail;
      setQueue((current) => [
        ...current,
        { ...pending, returnFocus: document.activeElement as HTMLElement | null },
      ]);
    };
    const noticeHandler = (event: Event) => {
      const value = (event as CustomEvent<AdminToastValue>).detail;
      const id = ++noticeSequence.current;
      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }
      setNotice({ id, value });
      noticeTimer.current = value.persistent
        ? null
        : window.setTimeout(() => {
            setNotice((current) => (current?.id === id ? null : current));
            noticeTimer.current = null;
          }, 5000);
    };

    window.addEventListener('admin:dialog', dialogHandler);
    window.addEventListener('admin:notice', noticeHandler);
    return () => {
      window.removeEventListener('admin:dialog', dialogHandler);
      window.removeEventListener('admin:notice', noticeHandler);
      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }
      for (const pending of queueRef.current) {
        pending.resolve(pending.request.type === 'confirm' ? false : null);
      }
    };
  }, []);

  const closeCurrent = useCallback((value: boolean | string | null) => {
    const current = queueRef.current[0];
    if (!current) return;
    current.resolve(value);
    setQueue((items) => (items[0] === current ? items.slice(1) : items));
  }, []);

  const updateReason = useCallback((value: string) => {
    setQueue((items) => {
      if (items[0]?.request.type !== 'reason') return items;
      const first = {
        ...items[0],
        request: { ...items[0].request, initialValue: value },
      };
      return [first, ...items.slice(1)];
    });
  }, []);

  const pending = queue[0];

  return (
    <>
      {children}
      {notice && <AdminToast value={notice.value} onClose={closeNotice} />}
      {pending?.request.type === 'reason' ? (
        <AdminReasonDialog
          title={pending.request.title}
          description={pending.request.description}
          value={pending.request.initialValue || ''}
          onChange={updateReason}
          onCancel={() => closeCurrent(null)}
          onSubmit={() => closeCurrent(pending.request.initialValue || '')}
          required={pending.request.required !== false}
          submitLabel={pending.request.confirmLabel || 'Xác nhận'}
          returnFocus={pending.returnFocus}
        />
      ) : pending ? (
        <AdminModal
          title={pending.request.title}
          onClose={() => closeCurrent(false)}
          returnFocus={pending.returnFocus}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {pending.request.description || 'Bạn có chắc muốn tiếp tục thao tác này?'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeCurrent(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => closeCurrent(true)}
                className="rounded-xl bg-[#2D1B14] px-4 py-2 text-sm font-semibold text-white"
              >
                {pending.request.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </AdminModal>
      ) : null}
    </>
  );
}
