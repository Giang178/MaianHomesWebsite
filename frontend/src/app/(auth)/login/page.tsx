'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth, type Role } from '@/context/AuthContext';
import { authApi } from '@/features/auth/api';
import { useRouter } from 'next/navigation';

interface LoginResult {
  email: string;
  role: Role;
  account_id: string;
  name?: string;
  avatar_url?: string;
  employee_id: string;
  employee_code?: string;
  access_token?: string;
  phone?: string;
  allowed_paths?: string[];
  permissions?: string[];
  must_change_password?: boolean;
  next_action?: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('session') === 'expired') {
        setSessionExpired(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = (await authApi.login(email, password)) as LoginResult;
      if (result.must_change_password || result.next_action === 'CHANGE_PASSWORD') {
        router.push('/change-password');
        return;
      }
      const role = result.role;
      login(
        result.email,
        role,
        result.name,
        result.avatar_url,
        result.employee_id,
        result.employee_code,
        result.access_token,
        result.account_id || result.employee_id,
        result.phone,
        result.allowed_paths,
        result.permissions
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tài khoản hoặc mật khẩu không chính xác');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#14110E] text-slate-100 flex flex-col justify-center items-center p-3 sm:p-5 relative overflow-hidden font-sans select-none">
      {/* Ambient background light: dịu nhẹ, sang trọng */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-[#D4AF37]/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-[#D4AF37]/5 rounded-full blur-[110px]" />

      {/* Khung đăng nhập: Kích thước tinh gọn, cân đối, fit hoàn hảo mọi khung hình từ Laptop đến PC */}
      <div className="w-full max-w-[350px] sm:max-w-[380px] md:max-w-[400px] lg:max-w-[410px] z-10">
        <div className="bg-[#1C1814]/90 backdrop-blur-xl border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 md:p-7 shadow-2xl shadow-black/80 transition-all duration-200">
          
          {/* Logo & Tên thương hiệu */}
          <div className="text-center mb-4 sm:mb-5">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#997B25]/10 border border-[#D4AF37]/30 p-2 mb-2 shadow-md shadow-[#D4AF37]/10">
              <Image
                src="/images/minilogo.png"
                alt="Logo Maian Homes - Đăng nhập"
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

          {/* Tiêu đề ngắn gọn */}
          <div className="mb-4 text-center">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Đăng nhập tài khoản
            </h2>
          </div>

          {/* Thông báo phiên hết hạn */}
          {sessionExpired && (
            <div className="mb-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] text-center py-2 px-3 rounded-lg animate-pulse">
              Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.
            </div>
          )}

          {/* Thông báo lỗi */}
          {error && (
            <div className="mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] text-center py-2 px-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Form đăng nhập gọn gàng */}
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-3.5">
            {/* Trường Email */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#F3E6C6]/80 uppercase tracking-wider ml-0.5">
                Tài khoản / Email
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]/80 group-focus-within:text-[#D4AF37] transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@maianhomes.com"
                  autoComplete="username"
                  className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 rounded-xl py-2.5 sm:py-2.5 pl-9 pr-3 text-white text-sm placeholder:text-white/30 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <label className="text-[11px] font-semibold text-[#F3E6C6]/80 uppercase tracking-wider">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#D4AF37] hover:underline transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]/80 group-focus-within:text-[#D4AF37] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 rounded-xl py-2.5 sm:py-2.5 pl-9 pr-10 text-white text-sm placeholder:text-white/30 focus:outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#D4AF37] p-0.5 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ghi nhớ đăng nhập */}
            <div className="flex items-center justify-between px-0.5 pt-0.5">
              <label className="flex items-center text-[11px] sm:text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 text-[#D4AF37] focus:ring-[#D4AF37]/30 accent-[#D4AF37] mr-2 cursor-pointer"
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
            </div>

            {/* Nút đăng nhập */}
            <div className="pt-1.5">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#D4AF37] via-[#DFBF58] to-[#C5A028] hover:from-[#DFBF58] hover:to-[#D4AF37] text-[#1A1612] font-black text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:transform-none shadow-md shadow-[#D4AF37]/20 cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-[#1A1612]/30 border-t-[#1A1612] rounded-full animate-spin" />
                    <span>ĐANG ĐĂNG NHẬP...</span>
                  </div>
                ) : (
                  <>
                    <span>VÀO HỆ THỐNG</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer bản quyền ngắn gọn */}
        <p className="text-center text-white/30 text-[10px] sm:text-[11px] mt-4">
          © 2026 Maian Homes Group. All rights reserved.
        </p>
      </div>
    </main>
  );
}
