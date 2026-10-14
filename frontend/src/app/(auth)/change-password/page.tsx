'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { authApi } from '@/features/auth/api';
import { PasswordRequirements } from '@/components/system/PasswordRequirements';
import {
  DEFAULT_PASSWORD_POLICY,
  passwordPolicyDescription,
  passwordPolicyError,
  type PasswordPolicy,
} from '@/lib/password-policy';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (policyLoading || policyUnavailable) return;
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    const policyMessage = passwordPolicyError(password, policy);
    if (policyMessage) {
      setError(policyMessage);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authApi.completeFirstLogin(password);
      router.replace('/login?password=changed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#1A1612] p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl">
        <Lock className="mx-auto mb-4 h-10 w-10 text-[#D4AF37]" />
        <h1 className="text-center text-2xl font-bold">Đổi mật khẩu lần đầu</h1>
        <p className="mt-2 text-center text-sm text-white/60">Mật khẩu tạm chỉ dùng một lần và sẽ bị vô hiệu hóa sau khi hoàn tất.</p>
        <p className="mb-6 mt-2 text-center text-xs text-[#F3E6C6]/70">
          {policyLoading ? 'Đang tải chính sách mật khẩu…' : `Yêu cầu hiện tại: ${passwordPolicyDescription(policy)}.`}
        </p>
        {error && <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <label htmlFor="new-password" className="mb-2 block text-xs font-bold uppercase text-white/70">Mật khẩu mới</label>
        <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
          minLength={policy.password_min_length}
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-[#D4AF37]" required />
        <PasswordRequirements password={password} policy={policy} />
        <label htmlFor="confirm-password" className="mb-2 block text-xs font-bold uppercase text-white/70">Nhập lại mật khẩu</label>
        <input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
          className="mb-6 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-[#D4AF37]" required />
        <button disabled={saving || policyLoading || policyUnavailable || !passwordValid || password !== confirmation} className="w-full rounded-xl bg-[#D4AF37] py-3 font-bold text-[#1A1612] disabled:opacity-50">
          {saving ? 'Đang cập nhật...' : 'Hoàn tất đổi mật khẩu'}
        </button>
      </form>
    </main>
  );
}
