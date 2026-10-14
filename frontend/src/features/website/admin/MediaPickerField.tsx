'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are returned dynamically by the protected upload API. */

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { type MediaAssetItem, websiteAdminApi } from './api';

type MediaRequirement = {
  min_width: number;
  min_height: number;
  aspect_ratio?: number | null;
};

export default function MediaPickerField({
  label,
  fieldPath,
  value,
  required,
  requirement,
  onChange,
}: {
  label: string;
  fieldPath: string;
  value: string;
  required?: boolean;
  requirement?: MediaRequirement;
  onChange: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const compatible = (item: MediaAssetItem) => {
    if (!requirement || !item.width || !item.height) return true;
    if (item.width < requirement.min_width || item.height < requirement.min_height) return false;
    if (!requirement.aspect_ratio) return true;
    return Math.abs(item.width / item.height - requirement.aspect_ratio) / requirement.aspect_ratio <= 0.08;
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Vui lòng chọn một tệp ảnh mới để tải lên.');
      return;
    }
    if (altText.trim().length < 10) {
      setError('Alt text phải mô tả ảnh và có ít nhất 10 ký tự.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('alt_text', altText.trim());
      const item = await websiteAdminApi.media.upload(body) as MediaAssetItem;

      if (!compatible(item)) {
        setError('Ảnh đã tải lên nhưng không đạt kích thước hoặc tỷ lệ của vị trí này. Vui lòng chọn ảnh khác.');
        return;
      }

      onChange(item.id);
      setFile(null);
      setAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải ảnh lên.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-field={fieldPath} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-sm font-bold text-slate-800">
            {label}{required && <span className="text-red-500"> *</span>}
          </span>
          {requirement && (
            <p className="text-xs text-slate-500">
              Tối thiểu {requirement.min_width}×{requirement.min_height}px
              {requirement.aspect_ratio ? ` · tỷ lệ ${requirement.aspect_ratio.toFixed(2)}` : ''}
            </p>
          )}
        </div>
        {value && !required && (
          <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-rose-700">
            Xóa ảnh
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
        {value ? (
          <img
            src={`/api/public/marketing-media/${encodeURIComponent(value)}`}
            alt={label}
            className="h-20 w-28 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-200">
            <ImageIcon className="text-slate-500" />
          </span>
        )}
        <div className="min-w-0 text-xs text-slate-600">
          <strong className="block text-sm text-slate-800">
            {value ? 'Ảnh hiện tại' : 'Chưa tải ảnh'}
          </strong>
          <span>
            {value
              ? 'Muốn thay đổi, hãy chọn và tải lên một tệp ảnh mới.'
              : 'Mỗi vị trí ảnh yêu cầu tải lên một tệp mới.'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setError('');
          }}
          className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
          aria-label={value ? `Chọn ảnh mới thay cho ${label}` : `Chọn ảnh mới cho ${label}`}
        />
        <input
          value={altText}
          disabled={busy}
          onChange={(event) => {
            setAltText(event.target.value);
            setError('');
          }}
          placeholder="Alt text mô tả ảnh"
          className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
        />
        <button
          type="button"
          disabled={busy || !file}
          onClick={() => void uploadFile()}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {value ? 'Tải ảnh thay thế' : 'Tải ảnh mới'}
        </button>
      </div>

      {file && <p className="text-xs text-slate-500">Tệp mới: <strong>{file.name}</strong></p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
