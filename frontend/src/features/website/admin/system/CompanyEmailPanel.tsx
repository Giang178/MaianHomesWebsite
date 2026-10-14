'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw, Save, Send, ShieldCheck, AlertCircle } from 'lucide-react';

import { get, mutate } from '@/features/system/shared/http';
import { usePermissions } from '@/lib/use-permissions';

type EmailSettings = {
  host: string;
  port: number;
  username: string;
  from_name: string;
  from_email: string;
  start_tls: boolean;
  password_configured: boolean;
  verified_at?: string | null;
  version: number;
};

const api = {
  get: () => get<EmailSettings>('/website/system/email'),
  update: (body: unknown) => mutate<EmailSettings>('/website/system/email', 'PATCH', body),
  test: (recipient: string, expectedVersion: number, reason: string) =>
    mutate<{ sent: boolean; email_settings: EmailSettings }>('/website/system/email/test', 'POST', {
      recipient,
      expected_version: expectedVersion,
      reason,
    }),
};

export function CompanyEmailPanel() {
  const { can } = usePermissions();
  const canUpdate = can('website.system.email.update');
  const canTest = can('website.system.email.test');
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    username: '',
    app_password: '',
    from_name: 'Maian Homes',
    from_email: '',
    start_tls: true,
    reason: '',
  });
  const [recipient, setRecipient] = useState('');
  const [testReason, setTestReason] = useState('Kiểm tra SMTP Authentication sau cấu hình');
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | null>('load');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setBusy('load');
      const value = await api.get();
      setSettings(value);
      setForm((current) => ({
        ...current,
        host: value.host,
        port: value.port,
        username: value.username,
        from_name: value.from_name,
        from_email: value.from_email,
        start_tls: value.start_tls,
        app_password: '',
        reason: '',
      }));
      setRecipient((current) => current || value.from_email || value.username);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tải cấu hình SMTP.',
      });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !canUpdate) return;
    try {
      setBusy('save');
      setMessage(null);
      const updated = await api.update({
        ...form,
        expected_version: settings.version,
        app_password: form.app_password || null,
      });
      setSettings(updated);
      setForm((current) => ({ ...current, app_password: '', reason: '' }));
      setMessage({
        type: 'success',
        text: 'Đã lưu cấu hình SMTP. Hãy gửi email thử để xác nhận Authentication.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể lưu cấu hình SMTP.',
      });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!settings || !canTest || !recipient.trim() || !testReason.trim()) return;
    try {
      setBusy('test');
      setMessage(null);
      const result = await api.test(recipient.trim(), settings.version, testReason.trim());
      setSettings(result.email_settings);
      setMessage({
        type: result.sent ? 'success' : 'error',
        text: result.sent
          ? 'SMTP Authentication thành công và email thử đã được gửi.'
          : 'Không thể gửi email thử. Kiểm tra máy chủ, tài khoản và App Password.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Kiểm tra SMTP thất bại.',
      });
    } finally {
      setBusy(null);
    }
  };

  if (busy === 'load' && !settings) {
    return (
      <div className="rounded-2xl border border-[#E8E0D8] bg-white p-12 text-center shadow-2xs">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#C5A059]" />
        <p className="mt-2 text-xs text-[#8A7A6E]">Đang tải cấu hình email công ty...</p>
      </div>
    );
  }

  return (
    <section className="space-y-3.5 sm:space-y-4 rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs">
      {/* Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E8E0D8] pb-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-7.5 w-7.5 lg:h-8 lg:w-8 items-center justify-center rounded-lg bg-[#FAF8F5] border border-[#E8E0D8] text-[#C5A059] shrink-0">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm lg:text-[15px] 2xl:text-base font-serif font-bold text-[#2D1B14]">
              Cấu Hình Email Công Ty (SMTP)
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#6B5E55] font-light">
              Cấu hình SMTP Authentication phục vụ cấp tài khoản, đặt lại mật khẩu và gửi thông báo hệ thống.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] lg:text-[11px] font-bold border self-start sm:self-auto shrink-0 ${
            settings?.verified_at
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{settings?.verified_at ? 'Đã xác minh' : 'Chưa xác minh'}</span>
        </span>
      </div>

      {!canUpdate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[11px] font-semibold text-blue-800 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <span>Chế độ chỉ xem cấu hình email. Tài khoản không có quyền chỉnh sửa.</span>
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg border p-2.5 text-[11px] font-medium flex items-center gap-2 ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 2-Column Responsive Body: Form (Left) & Live Test/Guidance (Right) */}
      <div className="grid gap-4 lg:gap-5 xl:grid-cols-12">
        {/* Main Settings Form (7 Columns on large screens) */}
        <div className="xl:col-span-7">
          <form onSubmit={save} className="space-y-3">
            <fieldset disabled={!canUpdate} className="space-y-3 disabled:opacity-75">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Máy chủ SMTP *</span>
                  <input
                    required
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                    placeholder="smtp.gmail.com"
                  />
                </label>

                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Cổng kết nối *</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Tài khoản SMTP *</span>
                  <input
                    required
                    type="email"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                    placeholder="info@maianhomes.vn"
                  />
                </label>

                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Mật khẩu ứng dụng (App Password) {settings?.password_configured ? '' : '*'}</span>
                  <input
                    required={!settings?.password_configured}
                    type="password"
                    autoComplete="new-password"
                    value={form.app_password}
                    onChange={(e) => setForm({ ...form, app_password: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                    placeholder={settings?.password_configured ? '•••••••••••• (Đã cấu hình)' : 'Nhập App Password'}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Tên hiển thị *</span>
                  <input
                    required
                    value={form.from_name}
                    onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                  />
                </label>

                <label className="text-[11px] font-bold text-[#2D1B14] block">
                  <span>Email người gửi (From Email) *</span>
                  <input
                    required
                    type="email"
                    value={form.from_email}
                    onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                  />
                </label>
              </div>

              <label className="text-[11px] font-bold text-[#2D1B14] block">
                <span>Lý do thay đổi cấu hình *</span>
                <input
                  required
                  minLength={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#E8E0D8] bg-[#FAF8F5]/60 px-3 py-1.5 text-xs text-[#2D1B14] placeholder-[#8A7A6E] outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
                  placeholder="Ví dụ: Cập nhật thông số SMTP gửi email hệ thống"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-[11px] text-[#2D1B14] font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.start_tls}
                    onChange={(e) => setForm({ ...form, start_tls: e.target.checked })}
                    className="rounded border-[#E8E0D8] text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span>Bật STARTTLS (khuyến nghị cho cổng 587)</span>
                </label>

                {canUpdate && (
                  <button
                    type="submit"
                    disabled={busy === 'save'}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2D1B14] hover:bg-[#1A100B] px-4 text-xs font-bold text-[#D4AF37] transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{busy === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}</span>
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        </div>

        {/* Right Column: Live Test SMTP & Guidance (5 Columns on large screens) */}
        <div className="xl:col-span-5 flex flex-col justify-between border-t xl:border-t-0 xl:border-l border-[#E8E0D8] pt-3.5 xl:pt-0 xl:pl-5 space-y-3">
          {/* Test Email Box */}
          {canTest && (
            <div className="rounded-xl border border-[#E8E0D8] bg-[#FAF8F5]/70 p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs lg:text-[13px] font-bold font-serif text-[#2D1B14] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Kiểm Tra SMTP & Gửi Thử</span>
                </h3>
                {settings?.verified_at && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Đã kiểm thử
                  </span>
                )}
              </div>
              <p className="text-[10px] lg:text-[11px] text-[#6B5E55] font-light">
                Gửi email kiểm thử trực tiếp đến hộp thư cá nhân để xác minh chứng thực.
              </p>

              <div className="space-y-2">
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Email nhận thử (vd: admin@gmail.com)"
                  className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C5A059] transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    value={testReason}
                    onChange={(e) => setTestReason(e.target.value)}
                    placeholder="Lý do kiểm tra"
                    className="flex-1 rounded-lg border border-[#E8E0D8] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C5A059] transition-colors"
                  />
                  <button
                    type="button"
                    disabled={busy === 'test' || !settings}
                    onClick={() => void test()}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#2D1B14] hover:bg-[#1A100B] px-3.5 text-xs font-bold text-[#D4AF37] transition-all cursor-pointer disabled:opacity-60 shadow-2xs shrink-0"
                  >
                    {busy === 'test' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    <span>Gửi thử</span>
                  </button>
                </div>
              </div>

              {settings?.verified_at && (
                <p className="text-[10px] text-[#8A7A6E]">
                  Xác minh gần nhất: <strong>{new Date(settings.verified_at).toLocaleString('vi-VN')}</strong>
                </p>
              )}
            </div>
          )}

          {/* Quick Security & Setup Tip */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-[10px] lg:text-[11px] text-amber-900 leading-relaxed space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-950">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Lưu ý bảo mật SMTP:
            </p>
            <p>
              Đối với Gmail/Google Workspace, bạn cần kích hoạt <strong>Xác minh 2 bước</strong> và tạo <strong>Mật khẩu ứng dụng (App Password)</strong> 16 ký tự, không dùng mật khẩu tài khoản chính.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
