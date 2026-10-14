# Kiến trúc website Maian Homes 2.0

## Nguyên tắc

- Backend là nguồn sự thật duy nhất cho nghiệp vụ, trạng thái publish và phân quyền.
- Frontend chỉ điều phối route, hiển thị UI và gọi API; không quyết định nghiệp vụ.
- Mỗi nghiệp vụ có một domain sở hữu rõ ràng và một service/use case chính.
- Nội dung website được lưu trong CMS/database, không hard-code trong component.
- Không có approval workflow cho thay đổi CMS của CEO/ADMIN.
- Chi tiết nghiệp vụ hoàn chỉnh xem tại: [Tài liệu Đặc tả Nghiệp vụ Maian Homes 2.0](./TAI_LIEU_NGHIEP_VU_MAIAN_HOMES.md).

## Backend

```text
backend/app/
├── api/             # adapter HTTP/WebSocket dùng chung, middleware, dependencies
├── core/            # config, security, logging, runtime
├── db/              # vòng đời MongoDB, base_service
├── infrastructure/  # email, storage, AI runtime
├── modules/         # domain modules chính
│   ├── website/     # CMS, pages, branding, team, recruitment, inquiries, workspace
│   ├── content/     # projects, articles, media, SEO, company knowledge, assistant
│   ├── identity/    # accounts, auth, sessions, permissions, invitations
│   ├── activity/    # audit/activity và outbox
│   ├── notifications/ # realtime notifications
│   └── system/      # settings, monitoring, idempotency, workers
├── models/          # model dùng chung
└── services/        # base persistence interface
```

## Frontend

```text
frontend/src/
├── app/              # route Next.js (client), (admin), (auth), (preview)
├── features/         # FDD modules: projects, news, workspaces, website, team, recruitment, accounts, contact
├── components/       # layout (client, admin), ui components, chat, home
├── context/          # session và notification context
└── lib/              # API transport, permissions, cache và utilities
```

Attendance, shifts, timekeeping, internal Sales CRM và các workflow nội bộ không thuộc runtime hiện tại.