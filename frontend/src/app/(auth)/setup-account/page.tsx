'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';

import { authApi } from '@/features/auth/api';
import { PasswordRequirements } from '@/components/system/PasswordRequirements';
import {
  DEFAULT_PASSWORD_POLICY,
  passwordPolicyDescription,
  passwordPolicyError,
  type PasswordPolicy,
} from '@/lib/password-policy';

function SetupAccountForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyUnavailable, setPolicyUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const passwordValid = !passwordPolicyError(password, policy);

  useEffect(() => {
    let active = true;
    authApi.passwordPolicy()
      .then((value) => {
        if (!active) return;
        setPolicy(value as PasswordPolicy);
        setPolicyLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setPolicyLoading(false);
        setPolicyUnavailable(true);
        setError('Không thể tải chính sách mật khẩu. Vui lòng tải lại trang.');
      });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('Liên kết cấp tài khoản không hợp lệ hoặc thiếu token.');
      return;
    }
    if (policyLoading || policyUnavailable) {
      setError('Chính sách mật khẩu chưa sẵn sàng. Vui lòng tải lại trang.');
      return;
    }
    const policyMessage = passwordPolicyError(password, policy);
    if (policyMessage) {
      setError(policyMessage);
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.setupAccount(token, password);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể kích hoạt tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Tài khoản đã được kích hoạt</h1>
        <p className="text-sm leading-6 text-white/60">
          Mật khẩu đã được thiết lập. Bạn có thể đăng nhập vào khu vực quản trị website.
        </p>
        <Link href="/login" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] py-4 font-black text-[#1A1612]">
          ĐĂNG NHẬP <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <KeyRound className="mx-auto mb-4 h-12 w-12 text-[#D4AF37]" />
      <h1 className="text-center text-2xl font-bold text-white">Thiết lập tài khoản</h1>
      <p className="mb-6 mt-2 text-center text-sm leading-6 text-white/60">
        Tạo mật khẩu cho tài khoản quản trị website. Liên kết chỉ sử dụng được một lần và có hiệu lực trong 48 giờ.
      </p>
      <p className="mb-6 text-center text-xs text-[#F3E6C6]/70">
        {policyLoading ? 'Đang tải chính sách mật khẩu…' : `Yêu cầu: ${passwordPolicyDescription(policy)}.`}
      </p>
      {!token && (
        <p className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-300">
          Liên kết không chứa token cấp tài khoản.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-bold text-red-300">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <PasswordRequirements password={password} policy={policy} />
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase text-[#F3E6C6]/70">Mật khẩu mới</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D4AF37]" />
            <input
              aria-label="Mật khẩu mới"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={policy.password_min_length}
              required
              disabled={!token || policyUnavailable}
              className="w-full rounded-2xl border border-white/10 bg-white/10 py-4 pl-12 pr-12 text-white outline-none focus:border-[#D4AF37]"
            />
            <button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase text-[#F3E6C6]/70">Nhập lại mật khẩu</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D4AF37]" />
            <input
              aria-label="Nhập lại mật khẩu"
              type={showPassword ? 'text' : 'password'}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              disabled={!token || policyUnavailable}
              className="w-full rounded-2xl border border-white/10 bg-white/10 py-4 pl-12 pr-4 text-white outline-none focus:border-[#D4AF37]"
            />
          </span>
        </label>
        <button type="submit" disabled={submitting || !token || policyLoading || policyUnavailable || !passwordValid} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] py-4 font-black text-[#1A1612] disabled:opacity-50">
          {submitting ? 'ĐANG KÍCH HOẠT…' : 'KÍCH HOẠT TÀI KHOẢN'}
          {!submitting && <ArrowRight className="h-5 w-5" />}
        </button>
      </form>
    </>
  );
}

export default function SetupAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A1612] p-4">
      <div className="w-full max-w-[450px]">
        <div className="mb-8 text-center">
          <p className="text-4xl font-black tracking-tighter text-[#D4AF37]">MAIAN HOMES</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#F3E6C6]/50">Website Management</p>
        </div>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <Suspense fallback={<p className="py-8 text-center text-sm text-white/60">Đang tải…</p>}>
            <SetupAccountForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
