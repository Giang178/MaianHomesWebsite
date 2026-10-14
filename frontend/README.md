# Maian Homes frontend

Ứng dụng Next.js 16 phục vụ website công khai và các workspace quản trị nội dung, đội ngũ, tuyển dụng, lead và vận hành hệ thống.

## Chạy local

```bash
npm ci
npm run dev
```

Mặc định frontend mở tại `http://127.0.0.1:3000`. Các request `/api/*` được route handler chuyển tiếp tới backend theo `BACKEND_URL`, sau đó mới dùng `NEXT_PUBLIC_API_URL` hoặc giá trị local mặc định.

## Release gates

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm audit --audit-level=high
```

Playwright mặc định tự mở Next dev server tại cổng 3100. Khi đã có server khác đang chạy, có thể tái sử dụng nó:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
$env:PLAYWRIGHT_BROWSER_CHANNEL='chrome' # tùy chọn: dùng Chrome hệ thống
npm run test:e2e
```

CI không đặt các biến này nên vẫn tự mở server cô lập và dùng Chromium do Playwright quản lý.

## Production

Frontend được build bằng `frontend/Dockerfile` và chạy sau khi hai API replica đạt readiness trong Docker Compose. Production deployment phải dùng cả `docker-compose.yml` và `docker-compose.production.yml`; xem báo cáo và checklist tại [`docs/project-audit/2026-08-19-production-audit.md`](../docs/project-audit/2026-08-19-production-audit.md).

## Cấu trúc mã nguồn

- `src/app/` chỉ chứa route, layout, metadata và route handler.
- `src/features/` chứa UI, API client, type và test theo domain: `content`, `inquiries`, `recruitment`, `team`, `workspaces`, `website`, `accounts` và `system`.
- Các page admin lớn được đặt trong `features/<domain>/admin/`; route trong `app/(admin)/admin/` chỉ là entry point.
- `src/components/` chỉ chứa component dùng chung; `src/lib/` chứa transport, permission, cache và utility dùng chung.
- API public/protected phải đi qua API client của feature; không đặt business logic trong route page.

Tên URL, API và namespace dữ liệu cũ chỉ được giữ khi đó là hợp đồng runtime; tên component/API client nội bộ phải phản ánh domain hiện tại.