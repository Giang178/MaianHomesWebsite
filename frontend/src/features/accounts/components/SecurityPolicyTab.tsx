'use client';

import {
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function SecurityPolicyTab() {
  return (
    <div className="space-y-4">
      {/* 3 Core Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-xl border border-[#E8E0D8] p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-amber-700">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <KeyRound className="w-4 h-4 text-[#AA820A]" />
            </div>
            <h3 className="font-bold text-xs text-[#2D1B14]">Quy trình cấp tài khoản 2 bước</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Hồ sơ tạo mới chuyển sang trạng thái <strong>Chờ cấp (PENDING_SETUP)</strong> mà chưa gửi email
            ngay. Quản trị viên kiểm tra xong bấm <strong>“Cấp TK”</strong> để kích hoạt và gửi thư mời.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E0D8] p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200">
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-bold text-xs text-[#2D1B14]">Thu hồi phiên tức thì</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Khi thay đổi vai trò, điều chỉnh quyền hạn hoặc khóa tài khoản, toàn bộ token và phiên đăng
            nhập cũ lập tức bị vô hiệu hóa để áp dụng chính sách bảo mật mới.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E0D8] p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-bold text-xs text-[#2D1B14]">Bảo vệ tài khoản cấp cao</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Tài khoản <strong>CEO</strong> và tài khoản của chính quản trị viên đang đăng nhập được bảo
            vệ tự động (không thể tự khóa hoặc hạ quyền) nhằm loại bỏ rủi ro mất quyền kiểm soát.
          </p>
        </div>
      </div>

      {/* Role Specifications */}
      <div className="bg-white rounded-xl border border-[#E8E0D8] p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#C5A059]" />
          <h3 className="font-bold text-sm text-[#2D1B14]">
            Quy định phân quyền theo vai trò (Role Specifications)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* CEO */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                CEO (Owner)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900">
                Toàn quyền (*)
              </span>
            </div>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              Tài khoản chủ sở hữu cao nhất. Được cấp quyền wildcard toàn hệ thống, giám sát tài khoản,
              kiểm toán, tài chính và cấu hình hạ tầng. Không thể bị khóa hoặc gỡ quyền từ console.
            </p>
          </div>

          {/* ADMIN */}
          <div className="rounded-xl border border-zinc-300 bg-zinc-50/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#2D1B14] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                ADMIN (Quản trị viên)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D1B14] text-[#F3E6C6]">
                Đầy đủ quyền
              </span>
            </div>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              Quản trị toàn bộ trang web, biên tập và xuất bản dự án, quản lý danh sách khách hàng tiềm
              năng (Leads), kiểm tra sức khỏe hệ thống và thiết lập cấu hình email công ty.
            </p>
          </div>

          {/* MARKETING */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                MARKETING (Biên tập)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Quyền hạn chế
              </span>
            </div>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              Biên tập bài viết, dự án, tối ưu hóa công cụ tìm kiếm (SEO) và AI Search (GEO). Nghiêm cấm
              can thiệp cấu trúc trang tĩnh, nhận diện thương hiệu, email và quản lý tài khoản.
            </p>
          </div>
        </div>
      </div>

      {/* Password & Session Policy */}
      <div className="bg-white rounded-xl border border-[#E8E0D8] p-5 shadow-2xs flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-amber-50 text-[#AA820A] border border-amber-200 shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-[#2D1B14]">Tiêu chuẩn bảo mật phiên & Mật khẩu</h4>
          <p className="text-gray-600 leading-relaxed">
            Hệ thống xác thực thông qua HttpOnly Cookie an toàn chống tấn công XSS. Mật khẩu yêu cầu tối
            thiểu 8 ký tự bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt. Khi đăng nhập lần đầu
            hoặc sau khi quản trị viên cấp tài khoản, nhân viên bắt buộc phải đổi mật khẩu khởi tạo.
          </p>
        </div>
      </div>
    </div>
  );
}
