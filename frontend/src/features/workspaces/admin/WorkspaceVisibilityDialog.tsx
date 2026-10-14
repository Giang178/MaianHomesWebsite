'use client';

import { Eye, EyeOff, X } from 'lucide-react';

type Props = {
  open: boolean;
  pageName: string;
  isPublished: boolean;
  loading?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WorkspaceVisibilityDialog({ open, pageName, isPublished, loading = false, description, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onCancel();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="workspace-visibility-dialog-title" className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isPublished ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isPublished ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </div>
          <button type="button" onClick={onCancel} disabled={loading} aria-label="Đóng bảng xác nhận" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 id="workspace-visibility-dialog-title" className="mt-4 text-lg font-bold text-zinc-900">
          {isPublished ? `Gỡ trang ${pageName} khỏi website?` : `Hiển thị lại trang ${pageName}?`}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${isPublished ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {loading ? 'Đang xử lý...' : isPublished ? 'Xác nhận gỡ trang' : 'Xác nhận hiển thị'}
          </button>
        </div>
      </div>
    </div>
  );
}