'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from 'lucide-react';

import type { AdminErrorInfo } from '@/lib/admin-errors';

type AdminToastTone = 'success' | 'error' | 'warning' | 'info';
export type AdminToastValue = {
  tone: AdminToastTone;
  message: string;
  title?: string;
  persistent?: boolean;
  error?: AdminErrorInfo;
};

export function AdminToast({
  value,
  onClose,
}: {
  value: AdminToastValue;
  onClose: () => void;
}) {
  const Icon =
    value.tone === 'success'
      ? CheckCircle2
      : value.tone === 'warning'
        ? AlertTriangle
        : value.tone === 'info'
          ? Info
          : AlertCircle;
  return (
    <div
      role={value.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className="fixed right-4 top-20 z-[10001] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm shadow-xl"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {value.title ||
            (value.tone === 'success'
              ? 'Đã hoàn tất'
              : value.tone === 'error'
                ? 'Không thể thực hiện'
                : 'Thông báo')}
        </p>
        <p>{value.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="rounded p-1 hover:bg-gray-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AdminModal({
  title,
  children,
  onClose,
  closeDisabled = false,
  size = 'md',
  returnFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  returnFocus?: HTMLElement | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const titleId = useId();
  const [previousFocus] = useState(() =>
    typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null,
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    closeDisabledRef.current = closeDisabled;
  }, [closeDisabled]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (!dialogRef.current?.contains(document.activeElement)) {
      closeRef.current?.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      (returnFocus || previousFocus)?.focus();
    };
  }, [previousFocus, returnFocus]);

  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-4xl' : 'max-w-xl';
  const content = (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabledRef.current) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={'max-h-[calc(100dvh-env(safe-area-inset-top))] w-full ' + width + ' overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:p-5'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-[#2D1B14]">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            disabled={closeDisabled}
            onClick={() => onCloseRef.current()}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(content, document.body);
}

export function AdminReasonDialog({
  title,
  description,
  value,
  onChange,
  onCancel,
  onSubmit,
  pending = false,
  required = true,
  submitLabel = 'Xác nhận',
  returnFocus,
}: {
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending?: boolean;
  required?: boolean;
  submitLabel?: string;
  returnFocus?: HTMLElement | null;
}) {
  const invalid = required && !value.trim();
  return (
    <AdminModal
      title={title}
      onClose={onCancel}
      closeDisabled={pending}
      returnFocus={returnFocus}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {description || 'Vui lòng nhập lý do để tiếp tục.'}
        </p>
        <label className="block text-sm font-semibold text-gray-800">
          Lý do{required ? ' *' : ''}
          <textarea
            autoFocus
            rows={4}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={pending}
            className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 font-normal outline-none focus:border-[#C5A059]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || invalid}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D1B14] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? 'Đang xử lý…' : submitLabel}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
