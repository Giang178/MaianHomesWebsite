# Infrastructure

- `nginx.conf`: reverse proxy cho môi trường Compose mặc định.
- `nginx.production.conf`: reverse proxy TLS/blue-green cho production và staging.
- `upstreams/`: upstream active/blue/green.
- `gcp/`: bootstrap VM và triển khai staging Google Cloud.
- `gcp/switch-ollama-model.sh`: tải và chuyển model Ollama staging, rồi kiểm tra readiness của API.
- Ollama chạy qua Compose profile `ollama`, chỉ nối mạng `data` nội bộ và lưu model trong volume `ollama_data`; không công khai cổng 11434.

Các file Compose vẫn nằm ở root để giữ một project directory thống nhất cho build context, volume và `.env`.
