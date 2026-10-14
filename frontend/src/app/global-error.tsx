'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application rendering failed', { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, background: '#FAF9F6', color: '#2D1B14', fontFamily: 'Arial, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <h1>Hệ thống tạm thời chưa khả dụng</h1>
            <p>Vui lòng thử tải lại trang. Nếu lỗi tiếp diễn, hãy liên hệ bộ phận hỗ trợ.</p>
            {error.digest && <p style={{ fontSize: 12, opacity: 0.7 }}>Mã lỗi: {error.digest}</p>}
            <button type="button" onClick={reset} style={{ marginTop: 16, padding: '12px 24px', cursor: 'pointer' }}>
              Thử lại
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
