'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PublicDataUnavailableProps = {
  title?: string;
  description?: string;
  requestId?: string;
  status?: number;
  compact?: boolean;
};

export default function PublicDataUnavailable({
  title = 'Dữ liệu tạm thời chưa khả dụng',
  description = 'Hệ thống chưa thể tải nội dung này. Vui lòng thử lại sau ít phút.',
  requestId,
  status,
  compact = false,
}: PublicDataUnavailableProps) {
  const router = useRouter();

  return (
    <div
      data-public-data-status="unavailable"
      className={compact
        ? 'rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950'
        : 'mx-auto my-12 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-950 shadow-sm'}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className={compact ? 'mb-2 h-5 w-5' : 'mx-auto mb-4 h-8 w-8'} aria-hidden="true" />
      <h2 className={compact ? 'font-semibold' : 'text-xl font-semibold'}>{title}</h2>
      <p className="mt-2 text-sm text-amber-900/80">{description}</p>
      {(requestId || status) && (
        <p className="mt-2 text-xs text-amber-900/65">
          {status ? `Mã trạng thái: ${status}` : ''}
          {status && requestId ? ' · ' : ''}
          {requestId ? `Mã yêu cầu: ${requestId}` : ''}
        </p>
      )}
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2D1B14] px-5 py-2.5 text-sm font-semibold text-[#D4AF37] transition-colors hover:bg-[#3D2B24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D1B14]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}
