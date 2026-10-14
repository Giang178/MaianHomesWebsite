'use client';

import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { workspacesApi } from '../api';

interface WorkspaceConsultationFormProps {
  source: 'COWORKING' | 'OFFICE';
  badge?: string;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  isEmbedded?: boolean;
  type?: 'DAT_LICH' | 'BAO_GIA';
  pricingPlans?: any[];
  initialBuilding?: string;
  initialPlan?: string;
  prefillPlanCode?: string;
  prefillPlanName?: string;
  prefillBuildingName?: string;
  prefillUnitCode?: string;
  onSuccess?: () => void;
  theme?: 'light' | 'dark';
}

export default function WorkspaceConsultationForm({
  source,
  badge,
  title,
  subtitle,
  hideHeader = false,
  isEmbedded = false,
  type = 'BAO_GIA',
  initialBuilding,
  initialPlan,
  prefillPlanCode,
  prefillPlanName = initialPlan,
  prefillBuildingName = initialBuilding,
  prefillUnitCode,
  onSuccess,
  theme = 'dark',
}: WorkspaceConsultationFormProps) {
  const isCoworking = source === 'COWORKING';
  const isLight = theme === 'light';

  const inputClass = isLight
    ? 'w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors'
    : 'w-full pl-9 pr-3 py-2 rounded-lg bg-[#1A1612] border border-white/15 focus:border-[#D4AF37] focus:outline-none text-xs sm:text-sm text-white placeholder:text-white/30 transition-colors';

  const labelClass = isLight
    ? 'text-[11px] uppercase tracking-wider text-zinc-700 font-semibold block'
    : 'text-[11px] uppercase tracking-wider text-[#F3E6C6]/70 font-semibold block';

  const resolvedTitle = title?.trim() || '';
  const resolvedSubtitle = subtitle?.trim() || '';
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    company_name: '',
    seat_type_interest: prefillPlanName || '',
    seat_count: '1',
    expected_date: '',
    budget: '',
    note: '',
    consent: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successReference, setSuccessReference] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.customer_name.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên');
      return;
    }

    const cleanPhone = formData.phone.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      setErrorMessage('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    setIsLoading(true);

    try {
      // Build structured note content
      const noteLines: string[] = [];
      if (isCoworking) {
        if (prefillPlanCode) noteLines.push(`[GÓI THUÊ QUAN TÂM: ${prefillPlanCode}]`);
        if (formData.seat_type_interest) noteLines.push(`Hình thức chỗ ngồi: ${formData.seat_type_interest}`);
        if (formData.seat_count) noteLines.push(`Số lượng chỗ ngồi dự kiến: ${formData.seat_count}`);
        if (formData.expected_date) noteLines.push(`Thời điểm dự kiến bắt đầu: ${formData.expected_date}`);
      } else {
        if (prefillBuildingName) noteLines.push(`[TÒA NHÀ QUAN TÂM: ${prefillBuildingName}]`);
        if (prefillUnitCode) noteLines.push(`[DIỆN TÍCH / MÃ SÀN: ${prefillUnitCode}]`);
        if (formData.company_name) noteLines.push(`Tên doanh nghiệp: ${formData.company_name}`);
        if (formData.budget) noteLines.push(`Ngân sách dự kiến: ${formData.budget}`);
        if (formData.expected_date) noteLines.push(`Thời điểm thuê dự kiến: ${formData.expected_date}`);
      }
      if (formData.note.trim()) {
        noteLines.push(`Yêu cầu bổ sung: ${formData.note.trim()}`);
      }

      const res = await workspacesApi.submitLead({
        customer_name: formData.customer_name.trim(),
        phone: cleanPhone,
        email: formData.email.trim() || undefined,
        source,
        form_id: isCoworking ? 'coworking-inquiry' : 'office-inquiry',
        page_url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        note: noteLines.join('\n'),
        consent: formData.consent,
      });

      setSuccessReference((res as { reference_id?: string })?.reference_id || 'OK');
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="consultation-form"
      className={`relative transition-all ${
        isEmbedded
          ? ''
          : `rounded-3xl p-6 sm:p-10 shadow-xl ${
              isLight
                ? 'bg-white border border-zinc-200 text-zinc-900 shadow-zinc-200/50'
                : 'bg-[#221B14] border-[#D4AF37]/30 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
            }`
      }`}
    >
      {/* Golden top border shimmer */}
      {!isEmbedded && (
        <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />
      )}

      {successReference ? (
        <div className="py-12 text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37] flex items-center justify-center mx-auto text-[#D4AF37]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className={`text-2xl font-bold font-serif ${isLight ? 'text-zinc-900' : 'text-[#F3E6C6]'}`}>
              Tiếp Nhận Thành Công!
            </h3>
            <p className={`text-sm font-light max-w-md mx-auto ${isLight ? 'text-zinc-600' : 'text-[#F3E6C6]/80'}`}>
              Yêu cầu của bạn đã được tiếp nhận. Chuyên viên sẽ liên hệ lại qua số điện thoại của bạn sớm nhất.
            </p>
            <p className="text-xs text-[#AA820A] font-mono pt-2">
              Mã hồ sơ: #{successReference}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccessReference(null);
              setFormData({
                customer_name: '',
                phone: '',
                email: '',
                company_name: '',
                seat_type_interest: '',
                seat_count: '1',
                expected_date: '',
                budget: '',
                note: '',
                consent: true,
              });
            }}
            className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/15 transition-colors cursor-pointer"
          >
            Gửi yêu cầu khác
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!hideHeader && (badge || resolvedTitle || resolvedSubtitle) && (
            <div className="text-center space-y-1.5 pb-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-widest text-[#AA820A]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{badge}</span>
              </div>
              <h3 className={`text-lg sm:text-2xl font-bold font-serif tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                {resolvedTitle}
              </h3>
              <p className={`text-xs sm:text-sm ${isLight ? 'text-zinc-600' : 'text-white/65'}`}>
                {resolvedSubtitle}
              </p>

              {/* Selected tags */}
              {(prefillPlanName || prefillBuildingName) && (
                <div className="pt-1 flex flex-wrap justify-center gap-1.5">
                  {prefillPlanName && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30">
                      Đang chọn: {prefillPlanName}
                    </span>
                  )}
                  {prefillBuildingName && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30">
                      Tòa nhà: {prefillBuildingName}
                    </span>
                  )}
                  {prefillUnitCode && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                      Mã sàn: {prefillUnitCode}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-500 text-xs text-center font-medium">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Họ và tên */}
            <div className="space-y-1">
              <label className={labelClass}>
                Họ và tên *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className={inputClass}
                />
                <User className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Số điện thoại */}
            <div className="space-y-1">
              <label className={labelClass}>
                Số điện thoại *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="0901 234 567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClass}
                />
                <Phone className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className={labelClass}>
                {type === 'DAT_LICH' ? 'Email liên hệ' : 'Email nhận báo giá'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="email@company.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                />
                <Mail className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field specific to Office vs Coworking */}
            {isCoworking ? (
              <div className="space-y-1">
                <label className={labelClass}>
                  Số lượng chỗ ngồi cần thuê
                </label>
                <div className="relative">
                  <select
                    value={formData.seat_count}
                    onChange={(e) => setFormData({ ...formData, seat_count: e.target.value })}
                    className={inputClass}
                  >
                    <option value="1">1 chỗ</option>
                    <option value="2-5">2 - 5 chỗ</option>
                    <option value="6-10">6 - 10 chỗ</option>
                    <option value=">10">Trên 10 chỗ</option>
                  </select>
                  <User className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className={labelClass}>
                  Tên doanh nghiệp
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Công ty TNHH..."
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className={inputClass}
                  />
                  <Building2 className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Thời điểm dự kiến thuê / xem */}
            <div className="space-y-1">
              <label className={labelClass}>
                {type === 'DAT_LICH' ? 'Thời gian đến xem dự kiến' : 'Thời điểm dự kiến bắt đầu'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ví dụ: Bắt đầu ngay, tháng sau..."
                  value={formData.expected_date}
                  onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                  className={inputClass}
                />
                <Calendar className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Office Budget if office */}
            {!isCoworking && (
              <div className="space-y-1">
                <label className={labelClass}>
                  Ngân sách dự kiến (tháng)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: 30 - 50 triệu/tháng..."
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className={inputClass}
                  />
                  <Clock className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Ghi chú / Yêu cầu thêm */}
          <div className="space-y-1">
            <label className={labelClass}>
              Ghi chú hoặc yêu cầu chi tiết
            </label>
            <textarea
              rows={2}
              placeholder="Nhập yêu cầu cụ thể (giờ tham quan mong muốn, tiện ích đặc thù...)"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className={`w-full p-2.5 rounded-lg border focus:border-[#D4AF37] focus:outline-none text-xs sm:text-sm transition-colors resize-none ${
                isLight
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white'
                  : 'bg-[#1A1612] border-white/15 text-white placeholder:text-white/30'
              }`}
            />
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-2 pt-0.5">
            <input
              type="checkbox"
              id="privacy-consent"
              checked={formData.consent}
              onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
              className="mt-0.5 rounded border-zinc-300 text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
            />
            <label
              htmlFor="privacy-consent"
              className={`text-[11px] leading-relaxed cursor-pointer ${
                isLight ? 'text-zinc-600' : 'text-[#F3E6C6]/60'
              }`}
            >
              Tôi đồng ý để Maian Homes liên hệ tư vấn và xử lý thông tin theo{' '}
              <a href="/chinh-sach-bao-mat" target="_blank" className="text-[#AA820A] underline">
                Chính sách bảo mật thông tin
              </a>.
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-1.5">
            <button
              type="submit"
              disabled={isLoading || !formData.consent}
              className="w-full py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wider uppercase bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-white hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ĐANG GỬI THÔNG TIN...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {isCoworking 
                      ? 'GỬI YÊU CẦU TƯ VẤN' 
                      : (type === 'DAT_LICH' ? 'XÁC NHẬN ĐẶT LỊCH XEM' : 'GỬI YÊU CẦU BÁO GIÁ VĂN PHÒNG')}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
