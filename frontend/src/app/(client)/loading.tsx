export default function ClientRouteLoading() {
  return (
    <main className="min-h-[65vh] bg-[#FAF9F6] px-6 py-32" aria-busy="true" aria-label="Đang tải nội dung">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-9 w-2/3 rounded bg-stone-200" />
        <div className="h-5 w-1/2 rounded bg-stone-200" />
        <div className="grid gap-6 pt-8 md:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-64 rounded-2xl bg-stone-200" />)}
        </div>
      </div>
    </main>
  );
}
