'use client';

import { useState, useEffect, useCallback, useId, useMemo, useRef } from 'react';
import {
  Building2,
  Phone,
  Globe2,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileCheck,
  HelpCircle,
  Monitor,
  Smartphone,
} from 'lucide-react';
import {
  websiteAdminApi,
  type WebsiteBrandingRecord,
} from '@/features/website/admin/api';
import { CONTACT_SETTINGS_CACHE_KEY } from '@/features/contact/cache';
import {DEFAULT_ZALO_OA_ID, zaloOAUrl} from '@/features/contact/zalo';
import { usePermissions } from '@/lib/use-permissions';
import {
  LEGACY_SITE_SETTINGS_CACHE_KEY,
  SITE_SETTINGS_CACHE_KEY,
  SITE_SETTINGS_CHANNEL,
} from '@/features/website/public/site-settings';

export default function BrandingAdminPage() {
  const { can } = usePermissions();
  const canUpdate = can('website.branding.update');
  const canPublish = can('website.branding.publish');
  const [record, setRecord] = useState<WebsiteBrandingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [copyrightText, setCopyrightText] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [zaloOaId, setZaloOaId] = useState(DEFAULT_ZALO_OA_ID);
  const [zaloUrl, setZaloUrl] = useState(zaloOAUrl(DEFAULT_ZALO_OA_ID));
  const [messengerUrl, setMessengerUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const companyNameId = useId();
  const taxIdInputId = useId();
  const workingHoursId = useId();
  const copyrightTextId = useId();
  const phoneId = useId();
  const emailId = useId();
  const addressId = useId();
  const zaloOaIdInputId = useId();
  const zaloUrlId = useId();
  const messengerUrlId = useId();
  const facebookUrlId = useId();
  const instagramUrlId = useId();
  const tiktokUrlId = useId();
  const youtubeUrlId = useId();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setFormReady(false);
      const data = await websiteAdminApi.branding.get();
      setRecord(data);

      const d = data.draft || {};
      const f = d.footer || {};
      const s = d.social_links || {};

      if (f.company_name) setCompanyName(String(f.company_name));
      if (f.tax_id) setTaxId(String(f.tax_id));
      if (f.working_hours) setWorkingHours(String(f.working_hours));
      if (f.copyright_text) setCopyrightText(String(f.copyright_text));

      setPhone(String(d.phone ?? ''));
      setEmail(String(d.email ?? ''));
      setAddress(String(d.address ?? ''));
      const configuredZaloOaId = String(d.zalo_oa_id ?? DEFAULT_ZALO_OA_ID);
      setZaloOaId(configuredZaloOaId);
      setZaloUrl(String(d.zalo_oa_id ? (d.zalo_url ?? zaloOAUrl(configuredZaloOaId)) : zaloOAUrl(DEFAULT_ZALO_OA_ID)));
      setMessengerUrl(String(d.messenger_url ?? ''));

      if (s.facebook) setFacebookUrl(String(s.facebook));
      if (s.instagram) setInstagramUrl(String(s.instagram));
      if (s.tiktok) setTiktokUrl(String(s.tiktok));
      if (s.youtube) setYoutubeUrl(String(s.youtube));

      setDirty(false);
      setFormReady(true);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tải cấu hình thương hiệu.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const buildPayload = () => {
    const existingDraft = record?.draft || {};
    return {
      ...existingDraft,
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      zalo_oa_id: zaloOaId.trim(),
      zalo_url: zaloUrl.trim(),
      messenger_url: messengerUrl.trim(),
      footer: {
        ...(existingDraft.footer || {}),
        company_name: companyName.trim(),
        tax_id: taxId.trim(),
        working_hours: workingHours.trim(),
        copyright_text: copyrightText.trim(),
      },
      social_links: {
        ...(existingDraft.social_links || {}),
        facebook: facebookUrl.trim(),
        instagram: instagramUrl.trim(),
        tiktok: tiktokUrl.trim(),
        ...(youtubeUrl.trim() ? { youtube: youtubeUrl.trim() } : {}),
      },
      expected_version: record?.version,
    };
  };

  const handleSaveDraft = async () => {
    if (!record || saving || !canUpdate) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = buildPayload();
      const updated = await websiteAdminApi.branding.update(payload);
      setRecord(updated);
      setDirty(false);
      setFormReady(true);
      setMessage({ type: 'success', text: 'Đã lưu bản nháp cấu hình thương hiệu thành công.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu bản nháp cấu hình.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!record || publishing || !canPublish || (dirty && !canUpdate)) return;
    setPublishing(true);
    setMessage(null);
    try {
      // Step 1: Save current changes if dirty
      let currentVersion = record.version;
      if (dirty) {
        const payload = buildPayload();
        const updated = await websiteAdminApi.branding.update(payload);
        currentVersion = updated.version;
        setRecord(updated);
      }

      // Step 2: Publish
      const published = await websiteAdminApi.branding.publish(currentVersion);
      setRecord(published);
      setDirty(false);
      setFormReady(true);

      // Invalidate the publishing tab and notify other open public tabs. New
      // requests are also revalidated by the backend outbox event.
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SITE_SETTINGS_CACHE_KEY);
        sessionStorage.removeItem(LEGACY_SITE_SETTINGS_CACHE_KEY);
        localStorage.removeItem(CONTACT_SETTINGS_CACHE_KEY);
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel(SITE_SETTINGS_CHANNEL);
          channel.postMessage({ type: 'published', version: published.published_version });
          channel.close();
        }
      }

      setMessage({
        type: 'success',
        text: 'Xuất bản thành công! Thông tin thương hiệu & Footer đã được áp dụng toàn site.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xuất bản cấu hình.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const markDirty = () => {
    if (!canUpdate) return;
    if (!dirty) setDirty(true);
  };

  const previewSettings = useMemo(() => {
    const draft = record?.draft || {};
    const currentPhone = formReady ? phone : String(draft.phone ?? '');
    const currentEmail = formReady ? email : String(draft.email ?? '');
    const currentAddress = formReady ? address : String(draft.address ?? '');
    const currentZaloOaId = formReady ? zaloOaId : String(draft.zalo_oa_id ?? DEFAULT_ZALO_OA_ID);
    const currentZaloUrl = formReady
      ? zaloUrl
      : String(draft.zalo_oa_id ? (draft.zalo_url ?? zaloOAUrl(currentZaloOaId)) : zaloOAUrl(DEFAULT_ZALO_OA_ID));
    const currentMessengerUrl = formReady ? messengerUrl : String(draft.messenger_url ?? '');
    const footer = draft.footer || {};
    const social = draft.social_links || {};
    return {
      ...draft,
      phone: currentPhone,
      email: currentEmail,
      address: currentAddress,
      zalo_oa_id: currentZaloOaId,
      zalo_url: currentZaloUrl,
      messenger_url: currentMessengerUrl,
      footer: {
        ...footer,
        company_name: formReady ? companyName : String(footer.company_name ?? ''),
        tax_id: formReady ? taxId : String(footer.tax_id ?? ''),
        working_hours: formReady ? workingHours : String(footer.working_hours ?? ''),
        copyright_text: formReady ? copyrightText : String(footer.copyright_text ?? ''),
      },
      social_links: {
        ...social,
        facebook: formReady ? facebookUrl : String(social.facebook ?? ''),
        instagram: formReady ? instagramUrl : String(social.instagram ?? ''),
        tiktok: formReady ? tiktokUrl : String(social.tiktok ?? ''),
        youtube: formReady ? youtubeUrl : String(social.youtube ?? ''),
      },
    };
  }, [
    record?.draft, formReady, phone, email, address, zaloOaId, zaloUrl, messengerUrl,
    companyName, taxId, workingHours, copyrightText,
    facebookUrl, instagramUrl, tiktokUrl, youtubeUrl,
  ]);
  const previewContact = useMemo(() => ({
    phone: previewSettings.phone || null,
    phone_href: previewSettings.phone ? `tel:${String(previewSettings.phone).replace(/\D/g, '')}` : null,
    email: previewSettings.email || null,
    email_href: previewSettings.email ? `mailto:${previewSettings.email}` : null,
    zalo_oa_id: previewSettings.zalo_oa_id || null,
    zalo_url: previewSettings.zalo_url || null,
    messenger_url: previewSettings.messenger_url || null,
  }), [previewSettings]);
  const previewDataRef = useRef({ contact: previewContact, siteSettings: previewSettings });
  previewDataRef.current = { contact: previewContact, siteSettings: previewSettings };

  const sendPreviewData = useCallback(() => {
    const previewData = previewDataRef.current;
    previewFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'branding-footer-preview',
        ...previewData,
      },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    sendPreviewData();
  }, [previewContact, previewSettings, sendPreviewData]);

  useEffect(() => {
    const handlePreviewReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin
        || event.source !== previewFrameRef.current?.contentWindow
        || !event.data
        || typeof event.data !== 'object'
        || (event.data as { type?: string }).type !== 'branding-footer-preview-ready'
      ) return;
      sendPreviewData();
    };

    window.addEventListener('message', handlePreviewReady);
    return () => window.removeEventListener('message', handlePreviewReady);
  }, [sendPreviewData]);
  if (loading) {
    return (
      <main className="admin-module-page admin-module-page--branding p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-16 bg-white rounded-2xl border border-[#E8E0D8] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-7 h-[600px] bg-white rounded-2xl border border-[#E8E0D8] animate-pulse" />
          <div className="lg:col-span-5 h-[500px] bg-white rounded-2xl border border-[#E8E0D8] animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="admin-module-page admin-module-page--branding min-h-screen bg-[#FDFBF7] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-[#2D1B14]">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E8E0D8] px-5 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8] shadow-2xs">
            <Building2 className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#2D1B14] leading-none">
                Thương hiệu & Thông tin liên hệ
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30 uppercase tracking-wide">
                BRANDING & FOOTER
              </span>
              {record?.status === 'PUBLISHED' && !dirty && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đang xuất bản (v{record.published_version || record.version})
                </span>
              )}
              {dirty && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                  <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                  Có thay đổi chưa xuất bản
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Quản trị thông tin pháp nhân công ty, mã số thuế, hotline, email, địa chỉ và các kênh liên kết hiển thị cố định tại Footer và chân trang toàn website.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          {!canUpdate && (
            <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              Chế độ chỉ xem
            </span>
          )}
          {canUpdate && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="inline-flex items-center gap-1.5 xl:gap-2 px-3 py-2 xl:px-4 xl:py-2 rounded-xl border border-[#E8E0D8] bg-white text-stone-700 text-xs xl:text-sm font-semibold hover:bg-[#FAF8F5] hover:text-[#2D1B14] active:scale-95 transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-stone-500" />
              <span>{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</span>
            </button>
          )}
          {canPublish && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving || publishing}
              className="inline-flex items-center gap-1.5 xl:gap-2 px-4 py-2 xl:px-5 xl:py-2 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#B38E46] text-white text-xs xl:text-sm font-bold shadow-md shadow-[#C5A059]/25 hover:from-[#B38E46] hover:to-[#996515] active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
              <span>{publishing ? 'Đang xuất bản...' : 'Xuất bản Footer'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Notice */}
      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-2xl border text-sm animate-in fade-in duration-200 ${
            message.type === 'success'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/90 border-rose-200 text-rose-950'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{message.text}</div>
        </div>
      )}

      {/* Form Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
        {/* Left Form: Edit Fields (7 cols) */}
        <div className="lg:col-span-12 space-y-6">
          {/* Section 1: Thông tin Pháp nhân & Bản quyền */}
          <div className="bg-white rounded-2xl border border-[#E8E0D8] p-5 xl:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div className="p-2 rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8]">
                <Building2 className="w-4 h-4 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#2D1B14]">1. Thông tin pháp nhân & Chân trang</h2>
                <p className="text-xs text-stone-500">Hiển thị tại Cột 4 của Footer và thanh bản quyền Sub-footer</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="sm:col-span-2">
                <label htmlFor={companyNameId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Tên pháp nhân công ty <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canUpdate}
                  id={companyNameId}
                  type="text"
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); markDirty(); }}
                  placeholder="CÔNG TY TNHH MAIAN HOMES"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={taxIdInputId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Mã số thuế (MST) <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canUpdate}
                  id={taxIdInputId}
                  type="text"
                  value={taxId}
                  onChange={(e) => { setTaxId(e.target.value); markDirty(); }}
                  placeholder="0319287798"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={workingHoursId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Thời gian làm việc <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canUpdate}
                  id={workingHoursId}
                  type="text"
                  value={workingHours}
                  onChange={(e) => { setWorkingHours(e.target.value); markDirty(); }}
                  placeholder="Thứ 2 – Thứ 7: 08:30 – 17:30"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor={copyrightTextId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Dòng chữ bản quyền Sub-footer
                </label>
                <input
                  disabled={!canUpdate}
                  id={copyrightTextId}
                  type="text"
                  value={copyrightText}
                  onChange={(e) => { setCopyrightText(e.target.value); markDirty(); }}
                  placeholder="© 2026 CÔNG TY TNHH MAIAN HOMES. All Rights Reserved."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Thông tin liên hệ chính thức */}
          <div className="bg-white rounded-2xl border border-[#E8E0D8] p-5 xl:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div className="p-2 rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8]">
                <Phone className="w-4 h-4 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#2D1B14]">2. Thông tin liên hệ chính thức</h2>
                <p className="text-xs text-stone-500">Được dùng tại nút hành động nhanh, Hotline Footer và liên kết tel/mailto</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label htmlFor={phoneId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Số Hotline hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canUpdate}
                  id={phoneId}
                  type="text"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                  placeholder="0969 10 50 59"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={emailId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Email chính thức <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canUpdate}
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); markDirty(); }}
                  placeholder="maianhomes.vn@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor={addressId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Địa chỉ trụ sở văn phòng <span className="text-rose-500">*</span>
                </label>
                <textarea
                  disabled={!canUpdate}
                  id={addressId}
                  rows={2}
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); markDirty(); }}
                  placeholder="Số 606/62 đường 3 Tháng 2, Phường Diên Hồng, TP. Hồ Chí Minh"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Kênh nhắn tin nhanh & Mạng xã hội */}
          <div className="bg-white rounded-2xl border border-[#E8E0D8] p-5 xl:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div className="p-2 rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8]">
                <Globe2 className="w-4 h-4 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#2D1B14]">3. Tin nhắn nhanh & Mạng xã hội</h2>
                <p className="text-xs text-stone-500">Các nút biểu tượng mạng xã hội và kênh chat trực tiếp</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label htmlFor={zaloOaIdInputId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Zalo Official Account ID
                </label>
                <input
                  disabled={!canUpdate}
                  id={zaloOaIdInputId}
                  type="text"
                  inputMode="numeric"
                  maxLength={30}
                  value={zaloOaId}
                  onChange={(e) => {
                    const nextId = e.target.value.replace(/\D/g, '');
                    setZaloOaId(nextId);
                    if (nextId) setZaloUrl(zaloOAUrl(nextId));
                    markDirty();
                  }}
                  placeholder="4085613041166590560"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">
                  ID dùng cho cửa sổ chat trực tiếp; nhân viên trả lời trong Zalo OA Manager.
                </p>
              </div>

              <div>
                <label htmlFor={zaloUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Đường dẫn Zalo OA (dự phòng)
                </label>
                <input
                  disabled={!canUpdate}
                  id={zaloUrlId}
                  type="url"
                  value={zaloUrl}
                  onChange={(e) => { setZaloUrl(e.target.value); markDirty(); }}
                  placeholder="https://zalo.me/4085613041166590560"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={messengerUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Facebook Messenger
                </label>
                <input
                  disabled={!canUpdate}
                  id={messengerUrlId}
                  type="url"
                  value={messengerUrl}
                  onChange={(e) => { setMessengerUrl(e.target.value); markDirty(); }}
                  placeholder="https://m.me/MaianHomes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={facebookUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Fanpage Facebook
                </label>
                <input
                  disabled={!canUpdate}
                  id={facebookUrlId}
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => { setFacebookUrl(e.target.value); markDirty(); }}
                  placeholder="https://www.facebook.com/MaianHomes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={instagramUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Trang Instagram
                </label>
                <input
                  disabled={!canUpdate}
                  id={instagramUrlId}
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => { setInstagramUrl(e.target.value); markDirty(); }}
                  placeholder="https://www.instagram.com/maianhomes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={tiktokUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Kênh TikTok
                </label>
                <input
                  disabled={!canUpdate}
                  id={tiktokUrlId}
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => { setTiktokUrl(e.target.value); markDirty(); }}
                  placeholder="https://www.tiktok.com/@maianhomes.vn"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label htmlFor={youtubeUrlId} className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Kênh YouTube (tùy chọn)
                </label>
                <input
                  disabled={!canUpdate}
                  id={youtubeUrlId}
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); markDirty(); }}
                  placeholder="https://youtube.com/@maianhomes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] text-stone-800 text-xs sm:text-sm outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview Box (5 cols) */}
        <div className="lg:col-span-12 space-y-6">
          <div className="sticky top-6 space-y-6">
            {/* Live Preview uses the exact public Footer component. */}
            <div className="overflow-hidden rounded-2xl border border-[#C5A059]/40 bg-white shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E0D8] bg-[#FAF8F5] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#2D1B14]">
                    <Eye className="h-4 w-4 text-[#C5A059]" />
                    Mô phỏng Footer thực tế
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    Dùng trực tiếp component đang hiển thị trên website và dữ liệu bản nháp hiện tại.
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-[#E8E0D8] bg-white p-1" role="group" aria-label="Kích thước mô phỏng">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    aria-pressed={previewMode === 'desktop'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${previewMode === 'desktop' ? 'bg-[#2D1B14] text-white' : 'text-stone-600 hover:bg-stone-50'}`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    aria-pressed={previewMode === 'mobile'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${previewMode === 'mobile' ? 'bg-[#2D1B14] text-white' : 'text-stone-600 hover:bg-stone-50'}`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Mobile
                  </button>
                </div>
              </div>

              <div className="overflow-auto bg-[linear-gradient(135deg,#ece7df_25%,transparent_25%),linear-gradient(225deg,#ece7df_25%,transparent_25%),linear-gradient(45deg,#ece7df_25%,transparent_25%),linear-gradient(315deg,#ece7df_25%,#f8f6f2_25%)] bg-[length:20px_20px] p-4 sm:p-6">
                <iframe
                  ref={previewFrameRef}
                  src="/branding-footer-preview"
                  title={`Mô phỏng Footer ${previewMode}`}
                  data-testid="branding-footer-preview"
                  data-preview-mode={previewMode}
                  onLoad={sendPreviewData}
                  className={`mx-auto block rounded-xl border-0 bg-[#14110E] shadow-2xl transition-[width,height] duration-300 ${previewMode === 'desktop' ? 'h-[720px] w-[1280px] min-w-[1100px]' : 'h-[920px] w-[390px] max-w-full'}`}
                />
              </div>
            </div>
            {/* Quick Tips */}
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#EADBCA] p-5 space-y-3 text-xs text-stone-600 shadow-2xs">
              <h3 className="font-bold text-[#2D1B14] flex items-center gap-2 text-sm">
                <HelpCircle className="w-4 h-4 text-[#C5A059]" />
                Lưu ý quan trọng
              </h3>
              <ul className="space-y-2 list-disc list-inside leading-relaxed text-stone-600">
                <li>
                  Khi bấm <strong>&quot;Lưu bản nháp&quot;</strong>, dữ liệu chỉ được lưu trữ tạm thời trong hệ thống quản trị.
                </li>
                <li>
                  Bấm <strong>&quot;Xuất bản Footer&quot;</strong> sẽ cập nhật trực tiếp ra toàn bộ trang web công khai (bao gồm cả Header, Footer và các nút gọi nhanh).
                </li>
                <li>
                  Sau khi xuất bản, nếu trình duyệt người dùng có lưu cache tạm thì sẽ tự động làm mới khi hết hạn hoặc tải lại trang.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
