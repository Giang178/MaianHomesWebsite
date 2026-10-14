'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/features/auth/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = (await authApi.forgotPassword(email)) as { message: string };
      setMessage(
        res.message || 'Yêu cầu gửi liên kết đặt lại mật khẩu thành công. Vui lòng kiểm tra hộp thư email của bạn.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#14110E] text-slate-100 flex flex-col justify-center items-center p-3 sm:p-5 relative overflow-hidden font-sans select-none">
      {/* Ambient background light: dịu nhẹ, sang trọng */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-[#D4AF37]/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-[#D4AF37]/5 rounded-full blur-[110px]" />

      {/* Khung quên mật khẩu: Kích thước tinh gọn, đồng bộ hoàn hảo với trang đăng nhập */}
      <div className="w-full max-w-[350px] sm:max-w-[380px] md:max-w-[400px] lg:max-w-[410px] z-10">
        <div className="bg-[#1C1814]/90 backdrop-blur-xl border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 md:p-7 shadow-2xl shadow-black/80 transition-all duration-200">
          
          {/* Logo & Tên thương hiệu */}
          <div className="text-center mb-4 sm:mb-5">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#997B25]/10 border border-[#D4AF37]/30 p-2 mb-2 shadow-md shadow-[#D4AF37]/10">
              <Image
                src="/images/minilogo.png"
                alt="Logo Maian Homes - Khôi phục mật khẩu"
                width={26}
                height={26}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-[#D4AF37] tracking-wider leading-tight">
              MAIAN HOMES
            </h1>
            <p className="text-[10px] sm:text-[11px] text-[#F3E6C6]/60 uppercase tracking-widest mt-0.5">
              Hệ thống quản trị
            </p>
          </div>

          {/* Tiêu đề phần quên mật khẩu */}
          <div className="mb-4 text-center">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Khôi phục mật khẩu
            </h2>
            <p className="text-[11px] sm:text-xs text-white/50 mt-1 leading-relaxed">
              Nhập email tài khoản nhân sự để nhận liên kết bảo mật đặt lại mật khẩu mới.
            </p>
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <div className="mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] text-center py-2 px-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Thông báo thành công */}
          {message && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
              <p className="text-emerald-300 text-[11px] sm:text-xs font-medium leading-relaxed">
                {message}
              </p>
            </div>
          )}

          {/* Form khôi phục */}
          {!message && (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#F3E6C6]/80 uppercase tracking-wider ml-0.5">
                  Địa chỉ Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]/80 group-focus-within:text-[#D4AF37] transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten.nv@maianhomes.com"
                    autoComplete="email"
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 rounded-xl py-2.5 sm:py-2.5 pl-9 pr-3 text-white text-sm placeholder:text-white/30 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-[#D4AF37] via-[#DFBF58] to-[#C5A028] hover:from-[#DFBF58] hover:to-[#D4AF37] text-[#1A1612] font-black text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:transform-none shadow-md shadow-[#D4AF37]/20 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#1A1612]/30 border-t-[#1A1612] rounded-full animate-spin" />
                      <span>ĐANG XỬ LÝ...</span>
                    </div>
                  ) : (
                    <>
                      <span>GỬI LIÊN KẾT BẢO MẬT</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Liên kết quay lại đăng nhập */}
          <div className="mt-4 pt-3.5 border-t border-white/10 text-center">
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 text-[11px] sm:text-xs text-[#D4AF37] hover:underline transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang đăng nhập</span>
            </Link>
          </div>
        </div>

        {/* Footer bản quyền ngắn gọn */}
        <p className="text-center text-white/30 text-[10px] sm:text-[11px] mt-4">
          © 2026 Maian Homes Group. All rights reserved.
        </p>
      </div>
    </main>
  );
}
