'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/features/auth/api';
import { PasswordRequirements } from '@/components/system/PasswordRequirements';
import {
  DEFAULT_PASSWORD_POLICY,
  passwordPolicyDescription,
  passwordPolicyError,
  type PasswordPolicy,
} from '@/lib/password-policy';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyUnavailable, setPolicyUnavailable] = useState(false);
  const passwordValid = !passwordPolicyError(password, policy);

  useEffect(() => {
    let active = true;
    authApi.passwordPolicy()
      .then((value) => {
        if (active) {
          setPolicy(value as PasswordPolicy);
          setPolicyLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setPolicyLoading(false);
          setPolicyUnavailable(true);
          setError('Không thể tải chính sách mật khẩu hiện hành. Vui lòng tải lại trang.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (policyLoading || policyUnavailable) {
      setError('Không thể tải chính sách mật khẩu hiện hành. Vui lòng tải lại trang.');
      return;
    }

    if (!token) {
      setError('Mã xác thực (token) không hợp lệ hoặc thiếu. Vui lòng kiểm tra lại liên kết từ email.');
      return;
    }

    const policyMessage = passwordPolicyError(password, policy);
    if (policyMessage) {
      setError(policyMessage);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại. Token có thể đã hết hạn.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
        </div>
        <h2 className="text-2xl font-bold text-white">Đổi mật khẩu thành công!</h2>
        <p className="text-white/60 text-sm leading-relaxed">
          Mật khẩu mới của bạn đã được cập nhật thành công vào hệ thống. Bạn có thể quay lại trang đăng nhập ngay bây giờ.
        </p>
        <Link 
          href="/login" 
          className="w-full bg-[#D4AF37] hover:bg-[#C5A028] text-[#1A1612] font-black py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all"
        >
          <span>ĐĂNG NHẬP NGAY</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-4 text-center">Đặt lại mật khẩu</h2>
      <p className="text-white/60 text-sm text-center mb-8">
        Nhập mật khẩu mới cho tài khoản nội bộ của bạn.
      </p>
      <p className="mb-6 text-center text-xs text-[#F3E6C6]/70">
        {policyLoading ? 'Đang tải chính sách mật khẩu…' : `Yêu cầu hiện tại: ${passwordPolicyDescription(policy)}.`}
      </p>

      {error && (
        <p className="text-red-400 text-xs text-center mb-4 font-bold bg-red-500/10 border border-red-500/20 py-2.5 rounded-2xl">
          {error}
        </p>
      )}

      {!token && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl mb-6 text-center">
          <p className="text-amber-400 text-xs font-bold leading-relaxed">
            Cảnh báo: Không phát hiện token đặt lại mật khẩu hợp lệ trên đường dẫn này.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <PasswordRequirements password={password} policy={policy} />
        <div className="space-y-2">
          <label htmlFor="reset-new-password" className="text-xs font-bold text-[#F3E6C6] uppercase opacity-70 ml-1">Mật khẩu mới</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37]" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              id="reset-new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Tối thiểu ${policy.password_min_length} ký tự`}
              minLength={policy.password_min_length}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37] transition-all"
              required
              disabled={!token}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#D4AF37]"
              disabled={!token}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="reset-confirm-password" className="text-xs font-bold text-[#F3E6C6] uppercase opacity-70 ml-1">Xác nhận mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37]" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              id="reset-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37] transition-all"
              required
              disabled={!token}
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={isLoading || !token || policyLoading || policyUnavailable || !passwordValid || password !== confirmPassword}
          className="w-full bg-[#D4AF37] hover:bg-[#C5A028] text-[#1A1612] font-black py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-4 border-[#1A1612]/20 border-t-[#1A1612] rounded-full animate-spin"></div>
          ) : (
            <>
              <span>CẬP NHẬT MẬT KHẨU</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <Link 
          href="/login" 
          className="inline-flex items-center text-xs text-[#D4AF37] hover:underline space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại đăng nhập</span>
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1612] p-4 font-sans">
      <div className="w-full max-w-[450px]">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-[#D4AF37] tracking-tighter mb-2">MAIAN HOMES</h1>
          <p className="text-[#F3E6C6] opacity-60 text-sm uppercase tracking-widest">Management System</p>
        </div>

        {/* Reset Password Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/60 text-sm">Đang tải...</p>
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-8">
          © 2026 Maian Homes Group. All rights reserved.
        </p>
      </div>
    </div>
  );
}
