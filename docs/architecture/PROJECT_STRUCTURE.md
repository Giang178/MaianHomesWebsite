# Cấu trúc project hiện tại

Đây là cây runtime hiện tại của website; các báo cáo lịch sử được tách riêng
trong `docs/project-audit` và không phải mã chạy production.

```text
maian-homes-website/
├── backend/
│   ├── app/
│   │   ├── api/             # adapter HTTP/WebSocket
│   │   ├── core/            # config, security, logging
│   │   ├── db/              # MongoDB lifecycle
│   │   ├── infrastructure/  # email, storage, AI
│   │   ├── modules/         # domain modules
│   │   ├── models/          # shared models
│   │   └── services/        # shared base only
│   ├── scripts/              # bootstrap, migration, maintenance
│   └── tests/                # unit, integration, system, load
├── frontend/
│   ├── src/app/              # Next.js routes
│   ├── src/features/         # feature UI and API clients
│   ├── src/components/       # shared UI
│   └── tests/e2e/             # Playwright
├── infrastructure/           # Nginx and GCP
├── scripts/deployment/        # release, rollback and DR
└── docs/                     # architecture, operation and release
```

Quy tắc duy trì: API chỉ nhận request và gọi service; service xử lý nghiệp vụ;
repository/service domain truy cập dữ liệu; frontend không chứa business rule.
Không tạo lại module attendance, shifts hoặc Sales CRM nội bộ.