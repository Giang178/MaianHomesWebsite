# Maian Homes Website

Monorepo cho website công khai, hệ thống quản trị nội bộ và các dịch vụ vận hành của Maian Homes.

## Bắt đầu nhanh

- Cài đặt & Khởi chạy cục bộ: [`docs/getting-started/LOCAL_SETUP.md`](docs/getting-started/LOCAL_SETUP.md)
- Kiến trúc hệ thống: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Đặc tả nghiệp vụ toàn diện: [`docs/TAI_LIEU_NGHIEP_VU_MAIAN_HOMES.md`](docs/TAI_LIEU_NGHIEP_VU_MAIAN_HOMES.md)
- Cấu trúc thư mục runtime: [`docs/architecture/PROJECT_STRUCTURE.md`](docs/architecture/PROJECT_STRUCTURE.md)

## Các khu vực chính

| Thư mục | Trách nhiệm |
| --- | --- |
| `backend/` | FastAPI, nghiệp vụ, worker, migration và test backend |
| `frontend/` | Next.js, giao diện công khai, trang quản trị và test frontend |
| `infrastructure/` | Nginx, cấu hình upstream và tự động hóa Google Cloud |
| `scripts/deployment/` | Script build, kiểm tra, phát hành, rollback và DR |
| `docs/` | Tài liệu kiến trúc, vận hành, phát hành và báo cáo kiểm tra |
| `.github/workflows/` | Các cổng kiểm tra CI theo miền chức năng |

Các file `docker-compose*.yml` và `.env*.example` được giữ tại root vì đây là điểm vào chung của toàn monorepo.

## Nguyên tắc bảo trì

- Mã nghiệp vụ backend mới đặt trong `backend/app/modules/<domain>/`.
- Giao diện theo chức năng đặt trong `frontend/src/features/<domain>/`; `frontend/src/app/` chỉ giữ route và layout theo quy ước Next.js.
- Không commit secret, dữ liệu upload, kết quả test hoặc artifact phát hành.
- Mọi thay đổi đường dẫn phải cập nhật CI, Compose, tài liệu và được xác minh bằng test/build.
