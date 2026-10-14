import {adminLabel} from '@/lib/admin-labels';

const translations: Record<string, string> = {
  // Event Types
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  ROLE_CHANGED: 'Thay đổi vai trò',
  DATA_EXPORTED: 'Xuất dữ liệu',
  SESSION_REVOKED: 'Hủy phiên',
  ALL_SESSIONS_REVOKED: 'Hủy toàn bộ phiên',
  PASSWORD_CHANGE_REQUIRED: 'Yêu cầu đổi mật khẩu',
  ACCOUNT_SECURITY_LOCKED: 'Khóa bảo mật',
  ACCOUNT_DISABLED: 'Vô hiệu hóa tài khoản',
  ACCOUNT_RESTORED: 'Khôi phục tài khoản',
  IDENTITY_POLICY_UPDATED: 'Cập nhật chính sách',
  IDENTITY_EMAIL_TEMPLATE_UPDATED: 'Cập nhật mẫu email',
  IDENTITY_EMAIL_TEMPLATE_TEST_SENT: 'Gửi thử email',
  IDENTITY_EMAIL_TEMPLATE_TEST_FAILED: 'Gửi thử email lỗi',
  SMTP_SETTINGS_UPDATED: 'Cập nhật SMTP',
  SMTP_TEST_SENT: 'Gửi thử SMTP',
  SMTP_TEST_FAILED: 'Gửi thử SMTP lỗi',
  SYSTEM_HEALTH_CHECK_RUN: 'Kiểm tra sức khỏe hệ thống',

  // Results / Statuses
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  FAILURE: 'Thất bại',
  DENIED: 'Bị từ chối',
  INFO: 'Thông tin',
  NOTICE: 'Đáng chú ý',
  WARNING: 'Cảnh báo',
  CRITICAL: 'Nghiêm trọng',
  WEBSITE: 'Website',
  IDENTITY: 'Tài khoản',
  MARKETING: 'Marketing',
  CEO: 'Tổng Giám đốc',
  ADMIN: 'Quản trị viên',
  AUTH: 'Xác thực',
  PUBLIC: 'Kênh công khai',
  SYSTEM: 'Hệ thống',
  HEALTHY: 'Hoạt động tốt',
  DOWN: 'Gián đoạn',
  DEGRADED: 'Hiệu năng giảm',
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đang khóa',
  DISABLED: 'Đã vô hiệu hóa',
  REVOKED: 'Đã thu hồi',
  PENDING: 'Đang chờ',
  SENT: 'Đã gửi',
  UNKNOWN: 'Không xác định',
};

export function StatusBadge({value}: {value?: string}) {
  const normValue = value || 'UNKNOWN';
  const displayValue = translations[normValue] || adminLabel(normValue, 'status');
  const positive = ['SUCCESS', 'HEALTHY', 'ACTIVE', 'SENT'].includes(normValue);
  const negative = ['FAILED', 'FAILURE', 'DENIED', 'CRITICAL', 'DOWN', 'LOCKED', 'DISABLED', 'REVOKED', 'DEGRADED'].includes(normValue);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs ${
        positive
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
          : negative
            ? 'bg-rose-50 text-rose-800 border-rose-200/80'
            : 'bg-amber-50 text-amber-900 border-amber-200/80'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          positive
            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
            : negative
              ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
              : 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
        }`}
      />
      <span>{displayValue}</span>
    </span>
  );
}
