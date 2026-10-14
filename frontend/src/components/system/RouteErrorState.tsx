'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

type RouteErrorStateProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
};

export default function RouteErrorState({
  error,
  reset,
  title = 'Trang tạm thời chưa khả dụng',
}: RouteErrorStateProps) {
  useEffect(() => {
    console.error('Route rendering failed', {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-[65vh] items-center justify-center bg-[#FAF9F6] px-6 py-24 text-center">
      <div className="max-w-xl">
        <AlertTriangle className="mx-auto mb-5 h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="font-serif text-3xl font-bold text-[#2D1B14]">{title}</h1>
        <p className="mt-3 text-gray-600">Đã có lỗi khi hiển thị nội dung. Bạn có thể thử tải lại mà không mất dữ liệu đã lưu.</p>
        {error.digest && <p className="mt-2 text-xs text-gray-500">Mã lỗi: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#2D1B14] px-6 py-3 font-semibold text-[#D4AF37]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Thử lại
        </button>
      </div>
    </main>
  );
}
