# HƯỚNG DẪN CÀI ĐẶT MÔI TRƯỜNG & CHUYỂN DỰ ÁN SANG MÁY MỚI (SETUP & MIGRATION GUIDE)

> **Dự án**: Maian Homes 2.0 (Modern Real Estate Platform)  
> **Kiến trúc**: Next.js App Router (Frontend) + FastAPI Enterprise (Backend) + MongoDB Replica Set + Redis  
> **Đối tượng**: Lập trình viên thiết lập môi trường mới hoặc chuyển mã nguồn từ máy tính cũ sang máy tính mới.

---

## 1. NHỮNG LƯU Ý QUAN TRỌNG KHI CHUYỂN DỰ ÁN TỪ MÁY CŨ

Khi sao chép mã nguồn từ máy tính cũ sang máy tính mới (qua USB, ổ cứng di động, Google Drive hoặc nén file `.zip`), hãy tuân thủ nguyên tắc sau để tránh làm nặng dung lượng và tránh lỗi xung đột hệ điều hành:

### ❌ CÁC THƯ MỤC TUYỆT ĐỐI KHÔNG COPY:
* `frontend/node_modules/` (Dung lượng hàng trăm MB, chứa các thư viện native compiled của máy cũ).
* `frontend/.next/` và `.next/` (Cache build của Next.js, sẽ tự tạo lại trên máy mới).
* `backend/venv/` hoặc `.venv/` (Môi trường Python ảo gắn cứng với đường dẫn và phiên bản Python của máy cũ).
* `backend/**/__pycache__/` và các file `*.pyc`.
* `.dev-logs/` (File log tạm thời khi chạy script).

###  CÁC DỮ LIỆU BẮT BUỘC CẦN SAO CHÉP / EXPORT:
1. **Dữ liệu Database MongoDB**: Cần xuất ra file BSON trước khi rời máy cũ (xem chi tiết tại [Mục 5: Di Chuyển Dữ Liệu](#5-quy-trình-di-chuyển-dữ-liệu-database--media-từ-máy-cũ)).
2. **Thư mục Media Uploads**: Sao chép `backend/uploads/` (chứa hình ảnh dự án, bài viết, tài liệu đã tải lên CMS).
3. **Các file cấu hình môi trường**:
   * `backend/.env`
   * `frontend/.env.local`

---

## 2. CÀI ĐẶT CÔNG CỤ NỀN TẢNG TRÊN MÁY MỚI (PREREQUISITES)

Trước khi thiết lập mã nguồn, hãy tải và cài đặt các phần mềm sau trên máy tính mới:

| Công cụ | Phiên bản khuyến nghị | Link tải chính thức | Ghi chú quan trọng |
| :--- | :--- | :--- | :--- |
| **Git** | Bản mới nhất | [git-scm.com](https://git-scm.com/) | Quản lý mã nguồn |
| **Node.js** | `>= 20.x LTS` (20.18+) | [nodejs.org](https://nodejs.org/) | Kèm theo `npm` bản mới nhất |
| **Python** | `3.10` hoặc `3.11` | [python.org](https://www.python.org/) | **Tích chọn "Add Python to PATH"** khi cài |
| **MongoDB Community** | `>= 7.0` (Khuyên dùng `8.0+`) | [mongodb.com](https://www.mongodb.com/try/download/community) | **Bắt buộc cấu hình Replica Set** |
| **MongoDB Compass** | Bản mới nhất | [mongodb.com](https://www.mongodb.com/products/tools/compass) | Giao diện đồ họa xem database |
| **Docker Desktop** *(Tùy chọn)* | Bản mới nhất | [docker.com](https://www.docker.com/) | Dành cho khởi chạy trọn gói bằng Docker |

---

## 3. CẤU HÌNH BẮT BUỘC CHO MONGODB TRÊN MÁY MỚI (REPLICA SET)

> [!CAUTION]
> **ĐIỀU KIỆN TIÊN QUYẾT**: Backend Maian Homes sử dụng mô hình **Transactional Outbox** (giao dịch ACID đa tài liệu của MongoDB).  
> Nếu MongoDB chạy ở chế độ Single Node độc lập mà chưa khởi tạo **Replica Set**, Backend sẽ báo lỗi:  
> `Transaction numbers are only allowed on a replica set member or mongos`.

### Cách 1: Cấu hình Replica Set vĩnh viễn trong file cấu hình service (Khuyên Dùng)

#### Trên Windows:
1. Mở file cấu hình MongoDB bằng Notepad với quyền Administrator:  
   `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`
2. Tìm hoặc thêm vào cuối file khối cấu hình sau:
   ```yaml
   replication:
     replSetName: rs0
   ```
3. Mở **Services** (`services.msc`), tìm dịch vụ **MongoDB Server** và chọn **Restart**.
4. Mở terminal gõ `mongosh` để vào shell MongoDB, sau đó chạy lệnh khởi tạo:
   ```javascript
   rs.initiate()
   ```
5. Kiểm tra kết quả bằng lệnh `rs.status()`. Nếu thấy trường `"ok": 1` và dấu nhắc chuyển thành `rs0 [direct: primary] test>` là đã hoàn tất thành công.

#### Trên Linux / macOS:
1. Mở file cấu hình: `/etc/mongod.conf` (Linux) hoặc `/usr/local/etc/mongod.conf` (macOS).
2. Thêm vào:
   ```yaml
   replication:
     replSetName: rs0
   ```
3. Khởi động lại dịch vụ: `sudo systemctl restart mongod` hoặc `brew services restart mongodb-community`.
4. Mở `mongosh` và chạy: `rs.initiate()`.

### Cách 2: Chạy tạm thời qua Command Line
Nếu không muốn sửa file cấu hình dịch vụ, bạn có thể tự khởi chạy MongoDB qua dòng lệnh:
```bash
mongod --replSet rs0 --dbpath "D:\mongodb-data"
# Sau đó mở cửa sổ terminal khác chạy: mongosh --eval "rs.initiate()"
```

---

## 4. QUY TRÌNH THIẾT LẬP MÃ NGUỒN TỪ A-Z TRÊN MÁY MỚI

### Bước 4.1: Cấu hình Backend (FastAPI)

1. Mở terminal, điều hướng vào thư mục backend:
   ```bash
   cd backend
   ```

2. Tạo môi trường ảo Python độc lập (Virtual Environment):
   * **Trên Windows (PowerShell):**
     ```powershell
     python -m venv venv
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     .\venv\Scripts\Activate.ps1
     ```
   * **Trên macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Nâng cấp pip và cài đặt thư viện phụ thuộc:
   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

4. Thiết lập file biến môi trường `backend/.env`:
   Tạo file `.env` bên trong thư mục `backend/` với nội dung chuẩn:
   ```ini
   # --------------------------------------------------------------------------
   # KẾT NỐI DATABASE (Bắt buộc có ?replicaSet=rs0)
   # --------------------------------------------------------------------------
   MONGODB_URL=mongodb://localhost:27017/?replicaSet=rs0
   DATABASE_NAME=maian_homes

   # --------------------------------------------------------------------------
   # BẢO MẬT JWT & PHIÊN ĐĂNG NHẬP (SECRET_KEY tối thiểu 32 ký tự ngẫu nhiên)
   # --------------------------------------------------------------------------
   SECRET_KEY=maian_super_secret_jwt_key_local_development_32chars_random
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ENVIRONMENT=development

   # --------------------------------------------------------------------------
   # TÀI KHOẢN QUẢN TRỊ TỐI CAO BAN ĐẦU (CEO BOOTSTRAP)
   # --------------------------------------------------------------------------
   CEO_EMAIL=admin@maianhomes.com
   CEO_FULL_NAME=Quản trị viên Maian Homes
   CEO_PHONE=0900000000
   CEO_BOOTSTRAP_PASSWORD=Admin@123456!

   # --------------------------------------------------------------------------
   # MẠNG & CỔNG KẾT NỐI
   # --------------------------------------------------------------------------
   API_PORT=8000
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

   # --------------------------------------------------------------------------
   # TRỢ LÝ AI (GOOGLE GEMINI - TÙY CHỌN CHO PHÁT TRIỂN CỤC BỘ)
   # --------------------------------------------------------------------------
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ```

5. Khởi tạo cơ sở dữ liệu và cấp tài khoản CEO ban đầu:
   ```bash
   python -m scripts.database_bootstrap
   ```
   *Lệnh này sẽ tự động tạo các collection, index tìm kiếm tối ưu và khởi tạo tài khoản quản trị CEO.*

6. Kiểm tra tính toàn vẹn của database:
   ```bash
   python -m scripts.database_verify
   ```

7. Khởi chạy thử Backend Server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   * Kiểm tra trên trình duyệt: Truy cập `http://localhost:8000/docs` (Swagger UI).
   * Kiểm tra Healthcheck: `http://localhost:8000/health/live`.

---

### Bước 4.2: Cấu hình Frontend (Next.js)

1. Mở một cửa sổ terminal mới, điều hướng vào thư mục frontend:
   ```bash
   cd frontend
   ```

2. Cài đặt các gói phụ thuộc (Dependencies):
   ```bash
   npm install
   ```

3. Thiết lập file biến môi trường `frontend/.env.local`:
   Tạo file `.env.local` trong thư mục `frontend/` với nội dung:
   ```ini
   # Địa chỉ kết nối Backend API
   NEXT_PUBLIC_API_URL=http://localhost:8000
   BACKEND_URL=http://localhost:8000
   ```

4. Khởi chạy Frontend ở chế độ phát triển:
   ```bash
   npm run dev
   ```
   * Website sẽ chạy tại: **`http://localhost:3000`**

---

### Bước 4.3: Khởi động tự động bằng PowerShell Script (Dành cho Windows)

Để không phải mở 2 cửa sổ terminal riêng lẻ mỗi lần làm việc, dự án cung cấp sẵn script tự động hóa:

* **Bật toàn bộ hệ thống (Kiểm tra MongoDB -> Khởi động Backend -> Khởi động Frontend):**
  ```powershell
  .\scripts\start-dev.ps1
  ```
* **Tắt sạch toàn bộ các tiến trình đang chạy ngầm:**
  ```powershell
  .\scripts\stop-dev.ps1
  ```

---

## 5. QUY TRÌNH DI CHUYỂN DỮ LIỆU DATABASE & MEDIA TỪ MÁY CŨ

Nếu trên máy cũ bạn đã nhập nhiều dự án, bài viết hoặc cấu hình website và muốn chuyển toàn bộ sang máy mới:

### Bước 5.1: Xuất dữ liệu trên máy tính cũ
1. Mở terminal trên máy cũ, dùng lệnh `mongodump`:
   ```bash
   mongodump --db maian_homes --out ./maian_backup
   ```
2. Nén 2 thư mục sau gửi sang máy mới:
   * Thư mục database: `maian_backup/maian_homes/`
   * Thư mục hình ảnh upload: `backend/uploads/`

### Bước 5.2: Phục hồi dữ liệu trên máy tính mới
1. Sao chép thư mục `uploads/` vào đúng vị trí `backend/uploads/` trên máy mới.
2. Mở terminal trên máy mới, dùng lệnh `mongorestore` để nạp lại dữ liệu:
   ```bash
   mongorestore --db maian_homes ./maian_backup/maian_homes
   ```
3. Chạy lại script cập nhật index bảo đảm hiệu năng:
   ```bash
   cd backend
   python -m scripts.database_bootstrap
   ```

---

## 6. PHƯƠNG PHÁP KHỞI CHẠY TRỌN GÓI VỚI DOCKER COMPOSE

Nếu trên máy mới bạn đã cài đặt **Docker Desktop** và muốn chạy toàn bộ hệ thống trong môi trường container chuẩn hóa:

1. Copy file mẫu môi trường ở thư mục gốc:
   ```bash
   cp .env.example .env
   ```
2. Khởi chạy toàn bộ dịch vụ (Nginx, Backend, Frontend, MongoDB Replica, Redis, MinIO):
   ```bash
   docker compose up -d
   ```
3. Truy cập hệ thống:
   * Website: **`http://localhost`** (Cổng 80)
   * Quản trị MinIO S3: **`http://localhost:9001`** (User: `minioadmin`, Pass: `minioadmin`)

---

## 7. BẢNG TRA CỨU TÀI KHOẢN VÀ CÁC ĐƯỜNG DẪN QUẢN TRỊ

Sau khi hệ thống khởi động thành công, đăng nhập vào trang quản trị:
* **Đường dẫn đăng nhập**: `http://localhost:3000/login`
* **Email**: `admin@maianhomes.com`
* **Mật khẩu**: `Admin@123456!`

### Các phân hệ quản trị chính:
| Phân hệ | Đường dẫn URL | Mô tả chức năng |
| :--- | :--- | :--- |
| **Quản trị Dự án** | `/admin/projects` | Thêm, sửa, đăng tải dự án BĐS, mặt bằng, tiện ích |
| **Quản trị Tin tức** | `/admin/articles` | Biên tập tin tức thị trường, cẩm nang, SEO tự động |
| **Quản trị Văn phòng** | `/admin/workspaces/offices` | Quản lý toà nhà văn phòng cho thuê (Hạng A, B, C) |
| **Quản trị Co-working** | `/admin/workspaces/coworking` | Quản lý không gian làm việc chia sẻ |
| **Quản trị Ký gửi & Lead** | `/admin/consignments` & `/admin/leads` | Xử lý yêu cầu ký gửi nhà đất và khách hàng tư vấn |
| **Quản trị Tài khoản** | `/admin/accounts` | Quản lý thành viên ban giám trị, marketing và phân quyền |
| **Giám sát Hệ thống** | `/admin/monitoring` | Giám sát tình trạng database, memory, Redis và services |

---

## 8. BỘ LỆNH KIỂM THỬ ĐẢM BẢO CHẤT LƯỢNG (QUALITY GATES)

Sau khi cài đặt xong trên máy mới, hãy chạy các bộ kiểm tra tự động để đảm bảo môi trường hoạt động 100% hoàn hảo:

### 1. Kiểm tra Backend (FastAPI):
```bash
cd backend
# Chạy 354+ bài test tự động:
pytest tests/

# Kiểm tra cú pháp và imports:
ruff check app/ --select F
```

### 2. Kiểm tra Frontend (Next.js):
```bash
cd frontend
# Chạy 237+ bài test giao diện và logic:
npm test -- --run

# Kiểm tra an toàn kiểu dữ liệu TypeScript (Phải 0 lỗi):
npx tsc --noEmit

# Kiểm tra chuẩn mã nguồn:
npm run lint
```

---

## 9. XỬ LÝ CÁC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Lỗi: `Transaction numbers are only allowed on a replica set member or mongos`
* **Nguyên nhân**: MongoDB trên máy mới chưa được bật tính năng Replica Set.
* **Cách sửa**: Thực hiện đúng các bước trong [Mục 3: Cấu hình bắt buộc cho MongoDB](#3-cấu-hình-bắt-buộc-cho-mongodb-trên-máy-mới-replica-set), chạy `rs.initiate()` trong `mongosh`.

### 2. Lỗi PowerShell: `cannot be loaded because running scripts is disabled on this system`
* **Nguyên nhân**: Windows mặc định chặn chạy script `.ps1`.
* **Cách sửa**: Mở PowerShell với quyền Administrator và gõ:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### 3. Lỗi: Trùng cổng `8000` hoặc `3000` (`Address already in use`)
* **Nguyên nhân**: Có tiến trình cũ hoặc ứng dụng khác đang chiếm cổng.
* **Cách sửa**:
  * Tìm tiến trình đang chiếm cổng (Windows):
    ```powershell
    netstat -ano | findstr :8000
    netstat -ano | findstr :3000
    ```
  * Tắt tiến trình bằng PID: `taskkill /PID <PID_NUMBER> /F`.
  * Hoặc chạy script dừng dự án: `.\scripts\stop-dev.ps1`.

### 4. Lỗi Next.js Gateway Proxy 500 khi gọi API
* **Nguyên nhân**: Frontend khởi động trước khi Backend kịp sẵn sàng.
* **Cách sửa**: Đảm bảo Backend đang chạy ổn định tại `http://localhost:8000/health/live` trước khi mở trang web Frontend.
