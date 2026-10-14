# Frontend source boundaries

- `app/`: route, layout, metadata và route handler theo quy ước Next.js.
- `features/`: UI, API client, type và logic gắn với một miền nghiệp vụ.
- `components/`: thành phần dùng chung; không chứa nghiệp vụ riêng của một miền.
- `context/`: trạng thái ứng dụng dùng xuyên nhiều miền.
- `lib/`: hạ tầng frontend và tiện ích dùng chung.
- `assets/`: font và tài nguyên được import trong mã nguồn.
- `test/`: thiết lập chung cho unit/component test.
- `types/`: kiểu dữ liệu dùng chung giữa nhiều miền.

Ưu tiên import qua alias `@/*`. Không đặt component nghiệp vụ mới trực tiếp trong `app/` hoặc `components/`.
