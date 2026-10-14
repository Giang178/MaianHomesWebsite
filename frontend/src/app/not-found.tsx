import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-6 text-center">
      <div className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B38B2D]">404</p>
        <h1 className="mt-4 font-serif text-4xl font-bold text-[#2D1B14]">Không tìm thấy trang</h1>
        <p className="mt-4 text-gray-600">Đường dẫn có thể đã thay đổi hoặc nội dung không còn tồn tại.</p>
        <Link href="/" aria-label="Quay về trang chủ Maian Homes" className="mt-8 inline-flex rounded-full bg-[#2D1B14] px-7 py-3 font-semibold text-[#D4AF37]">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
