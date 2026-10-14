# Backend tests

- Test Python trực tiếp trong `tests/` và các thư mục `hr`, `sales`, `it`: unit/contract test, không yêu cầu full stack.
- `integration/`: kiểm tra MongoDB, Redis, MinIO hoặc dịch vụ thật trong CI/staging.
- `load/`: kịch bản k6, chỉ chạy trên staging có dữ liệu thử nghiệm.

Lệnh unit test mặc định: `python -m unittest discover -s tests -p "test*.py"`.
