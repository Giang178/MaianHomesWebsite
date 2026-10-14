'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { submitPublicLead } from '@/features/inquiries/api';
import { usePublicContactSettings } from '@/features/contact/usePublicContactSettings';
import { resolveZaloOAUrl } from '@/features/contact/zalo';
import { usePublicSiteSettings } from '@/features/website/public/site-settings';
import {
  Phone,
  Mail,
  CheckCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
  MapPin,
  Clock,
  Navigation,
  Send,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const INPUT_BASE_CLASS =
  'w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl px-4 py-3.5 text-xs sm:text-sm md:text-base text-[#1A1612] placeholder-gray-400 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 focus:bg-white transition-all shadow-sm';

export default function ContactLayout({
  title = 'LIÊN HỆ MAIAN HOMES',
  description = 'Chúng tôi luôn sẵn sàng lắng nghe và giải đáp mọi thắc mắc của Quý khách về các dự án bất động sản cao cấp, dịch vụ ký gửi và quản lý tài sản.',
  interestOptions = [],
  faqs = [],
}: { title?: string; description?: string; interestOptions?: string[]; faqs?: Array<{ question: string; answer: string }> }) {
  const { contact } = usePublicContactSettings();
  const siteSettings = usePublicSiteSettings();
  const phoneDisplay = contact.phone || siteSettings.phone || '';
  const emailDisplay = contact.email || siteSettings.email || '';
  const addressDisplay = siteSettings.address || '';
  const workingHoursDisplay = siteSettings.footer?.working_hours || '';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedInterest, setSelectedInterest] = useState<string>(interestOptions[0] || '');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    const phoneTrimmed = phone.trim();
    if (!/^[0-9]+$/.test(phoneTrimmed) || phoneTrimmed.length < 9 || phoneTrimmed.length > 11) {
      setErrorMessage('Số điện thoại không hợp lệ (phải từ 9 đến 11 chữ số)');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedNote = `[LIÊN HỆ WEBSITE]
- Nhu cầu: ${selectedInterest}
- Nội dung: ${message.trim()}`;

      await submitPublicLead({
        customer_name: name.trim(),
        phone: phone.trim(),
        email: trimmedEmail || undefined,
        source: 'WEBSITE',
        interest_project_id: undefined,
        notes: [formattedNote],
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      console.error('Submit contact lead error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại. Vui lòng kiểm tra lại kết nối.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#1E1A16] pt-16 sm:pt-20 lg:pt-22 pb-16 sm:pb-20 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">

        {/* HERO SECTION */}
        <div className="text-center space-y-3 sm:space-y-4 max-w-3xl mx-auto pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#8C6D23] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em]">
            <Sparkles className="size-3 text-[#B88A29]" />
            <span>Kênh liên hệ chính thức</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight uppercase leading-tight text-[#1A1612]">
            {title}
          </h1>

          <p className="text-slate-600 font-light text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            {description}
          </p>

          {/* Standalone Definition Block (GEO / AEO Snippet Optimization) */}
          <div className="mt-4 p-4 sm:p-5 bg-white border border-[#EBE5DA] text-left max-w-2xl mx-auto rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <p className="text-[11px] sm:text-xs text-[#2C241E] leading-relaxed font-normal">
              <strong className="text-[#8C6D23] font-semibold">Về Maian Homes:</strong> Thông tin giới thiệu, dịch vụ và khu vực hoạt động chính thức được công bố tại trang Giới thiệu. Mọi thông tin liên hệ trên trang này được lấy từ cấu hình hệ thống website chính thức.
            </p>
          </div>
        </div>

        {/* MAIN CONTENT: 2 COLUMNS (5 COLS GRID: 2 LEFT, 3 RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start">

          {/* CỘT TRÁI: THÔNG TIN TRỤ SỞ & ĐA KÊNH LIÊN HỆ (5 COLS) */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-0.5 w-5 rounded-full bg-[#D4AF37]" />
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-[#B88A29]">
                    Trụ sở thực tế
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-serif text-[#1A1612] uppercase tracking-tight">
                  Văn phòng Maian Homes tại TP. Hồ Chí Minh
                </h2>
              </div>

              {/* HÌNH ẢNH TRỤ SỞ SẮC NÉT VỚI BO GÓC SANG TRỌNG */}
              <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-[#EBE5DA] group shadow-md bg-slate-900">
                <Image
                  src="/images/truso.jpg"
                  alt="Văn phòng tư vấn bất động sản cao cấp Maian Homes tại TP.HCM"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 500px"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out brightness-95 hover:brightness-100 [image-rendering:-webkit-optimize-contrast]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                <div className="absolute bottom-3.5 left-4 right-4 sm:bottom-4 sm:left-5 text-white">
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-[#F1CB65] tracking-[1.5px] uppercase font-bold">
                    <MapPin className="size-3 text-[#D4AF37]" />
                    Trụ sở tư vấn Bất động sản
                  </span>
                  <p className="text-xs sm:text-sm text-white/95 font-medium mt-0.5">
                    {addressDisplay}
                  </p>
                </div>
              </div>

              {/* THẺ ĐỊA CHỈ & CHỈ ĐƯỜNG GOOGLE MAPS */}
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#FBF8F0] text-[#B88A29] shrink-0">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1612] text-xs sm:text-sm uppercase tracking-wider">
                      Địa chỉ văn phòng
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      {addressDisplay}
                    </p>
                    <a
                      href={addressDisplay ? `https://maps.google.com/?q=${encodeURIComponent(addressDisplay)}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#8C6D23] hover:text-[#B88A29] transition-colors group cursor-pointer"
                    >
                      <Navigation className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      <span>Xem chỉ đường Google Maps</span>
                    </a>
                  </div>
                </div>

                {/* THỜI GIAN PHỤC VỤ */}
                <div className="pt-3 border-t border-[#EBE5DA]/70 flex items-start gap-3.5 text-xs text-slate-600">
                  <Clock className="size-4 text-[#B88A29] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#1A1612]">Thời gian làm việc & tư vấn:</p>
                    <p className="text-slate-500 mt-0.5">{workingHoursDisplay}</p>
                  </div>
                </div>
              </div>

              {/* KHUNG THÔNG TIN DOANH NGHIỆP */}
              <div className="rounded-2xl bg-gradient-to-br from-[#F7F2E7] via-[#FAF6EE] to-[#FFF] border border-[#D4AF37]/30 p-5 sm:p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 size-24 bg-gradient-to-br from-[#D4AF37]/15 to-transparent rounded-bl-full pointer-events-none" />
                <p className="text-[#8C6D23] font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#B88A29]" />
                  <span>Thông tin doanh nghiệp</span>
                </p>
                <div className="text-xs sm:text-sm text-[#2C241E] space-y-2 leading-relaxed">
                  <p><strong className="text-[#1A1612] font-semibold">Doanh nghiệp:</strong> Maian Homes</p>
                  <p><strong className="text-[#1A1612] font-semibold">Hotline:</strong> {phoneDisplay}</p>
                  <p><strong className="text-[#1A1612] font-semibold">Email:</strong> {emailDisplay}</p>
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: FORM TƯ VẤN CRO (7 COLS) */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#EBE5DA] rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_12px_40px_rgba(26,22,18,0.06)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

              <div className="mb-6 sm:mb-8">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#B88A29] block mb-1">
                  Biểu mẫu tiếp nhận
                </span>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-serif text-[#1A1612] uppercase tracking-tight">
                  Liên hệ Tư vấn Bất động sản TP.HCM
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 font-light leading-relaxed">
                  Để lại thông tin, chuyên viên tư vấn cao cấp của Maian Homes sẽ liên hệ trực tiếp với Quý khách trong thời gian sớm nhất.
                </p>
              </div>

              {isSuccess ? (
                <div className="text-center py-12 space-y-4 animate-in zoom-in-95 duration-300 min-h-[460px] flex flex-col justify-center items-center">
                  <div className="size-16 sm:size-20 bg-[#D4AF37]/15 rounded-full flex items-center justify-center mx-auto border border-[#D4AF37]/40 shadow-sm">
                    <CheckCircle className="size-8 sm:size-10 text-[#8C6D23]" />
                  </div>
                  <h3 className="text-xl font-bold font-serif text-[#8C6D23] uppercase tracking-wide">
                    Đã gửi thành công!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-light max-w-sm mx-auto leading-relaxed">
                    Cảm ơn Quý khách. Yêu cầu tư vấn đã được ghi nhận vào hệ thống để đội ngũ chuyên viên Maian Homes liên hệ sớm nhất.
                  </p>
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="mt-4 px-6 py-2.5 rounded-full border border-[#D4AF37]/50 text-xs font-bold text-[#8C6D23] hover:bg-[#D4AF37]/10 transition-colors cursor-pointer"
                    id="contact-btn-reset"
                  >
                    Gửi yêu cầu tư vấn khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" id="contact-consult-form">
                  {/* TAGS CHỌN NHANH NHU CẦU */}
                  <div className="space-y-2">
                    <label className="text-[11px] sm:text-xs text-[#4A433C] font-bold uppercase tracking-wider block">
                      Nhu cầu quan tâm
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                      {interestOptions.map((option) => {
                        const isSelected = selectedInterest === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedInterest(option)}
                            className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-[#FBF8F0] border-[#D4AF37] text-[#8C6D23] shadow-sm ring-1 ring-[#D4AF37]'
                                : 'bg-[#FCFAF6] border-[#EBE5DA] text-slate-600 hover:border-[#D4AF37]/50 hover:bg-white'
                            }`}
                          >
                            <span className="block truncate">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HỌ VÀ TÊN */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="contact-form-name"
                      className="text-[11px] sm:text-xs text-[#4A433C] font-bold flex items-center gap-1 uppercase tracking-wider"
                    >
                      Họ và tên *
                    </label>
                    <input
                      id="contact-form-name"
                      className={INPUT_BASE_CLASS}
                      type="text"
                      required
                      aria-required="true"
                      placeholder="Nhập họ và tên của Quý khách..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {/* SỐ ĐIỆN THOẠI VÀ EMAIL TRÊN 2 CỘT */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-form-phone"
                        className="text-[11px] sm:text-xs text-[#4A433C] font-bold flex items-center gap-1 uppercase tracking-wider"
                      >
                        Số điện thoại *
                      </label>
                      <input
                        id="contact-form-phone"
                        className={`${INPUT_BASE_CLASS} font-mono`}
                        type="tel"
                        required
                        aria-required="true"
                        placeholder="VD: 0969105059"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-form-email"
                        className="text-[11px] sm:text-xs text-[#4A433C] font-bold flex items-center gap-1 uppercase tracking-wider"
                      >
                        Email (Không bắt buộc)
                      </label>
                      <input
                        id="contact-form-email"
                        className={`${INPUT_BASE_CLASS} font-mono`}
                        type="email"
                        placeholder="example@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* NỘI DUNG YÊU CẦU */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="contact-form-message"
                      className="text-[11px] sm:text-xs text-[#4A433C] font-bold flex items-center gap-1 uppercase tracking-wider"
                    >
                      Nội dung cần hỗ trợ *
                    </label>
                    <textarea
                      id="contact-form-message"
                      rows={4}
                      required
                      aria-required="true"
                      placeholder="Quý khách cần tìm hiểu dự án nào, mức giá dự kiến hoặc câu hỏi cần giải đáp..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={`${INPUT_BASE_CLASS} resize-none`}
                    />
                  </div>

                  {errorMessage && (
                    <div
                      className="text-red-700 text-xs font-semibold py-3 px-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2"
                      role="alert"
                      id="contact-form-error"
                    >
                      <AlertCircle className="size-4 shrink-0 text-red-500" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      id="contact-form-submit-btn"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-12 sm:min-h-14 flex items-center justify-center gap-2.5 px-8 py-3.5 sm:py-4 rounded-2xl text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider bg-gradient-to-r from-[#8C6D23] via-[#D4AF37] to-[#8C6D23] text-[#07182b] hover:text-black hover:shadow-[0_8px_30px_rgba(212,175,55,0.35)] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer shadow-md"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin text-[#07182b]" />
                          <span>Đang gửi thông tin...</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          <span>Gửi yêu cầu tư vấn ngay</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-slate-400 mt-3 text-center flex items-center justify-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                      <span>Thông tin của Quý khách được cam kết bảo mật 100%.</span>
                    </p>
                  </div>
                </form>
              )}

              {/* PHƯƠNG ÁN LIÊN HỆ NHANH TRỰC TIẾP DÀNH CHO KHÁCH HÀNG (HOTLINE, EMAIL, ZALO) */}
              <div className="mt-8 pt-6 border-t border-[#EBE5DA]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3.5">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#8C6D23] flex items-center gap-1.5">
                    <Sparkles className="size-3 text-[#B88A29]" />
                    Hoặc liên hệ nhanh không cần điền biểu mẫu:
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    Hỗ trợ phản hồi tức thì
                  </span>
                </div>

                <address className="not-italic grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-[#4A433C]">
                  {/* Hotline */}
                  <a
                    href={contact.phone_href || (contact.phone ? `tel:${contact.phone}` : '#')}
                    id="contact-link-phone"
                    className="flex items-center sm:flex-col justify-start sm:justify-center text-left sm:text-center gap-3 sm:gap-1.5 p-3 sm:p-3.5 rounded-2xl bg-[#FBF8F0] border border-[#EBE5DA] hover:border-[#D4AF37] hover:bg-white hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="size-9 rounded-xl bg-[#8C6D23]/10 text-[#8C6D23] flex items-center justify-center shrink-0 group-hover:bg-[#D4AF37] group-hover:text-white transition-colors">
                      <Phone className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#1A1612] text-[10px] sm:text-[11px] uppercase tracking-wider whitespace-nowrap">
                        Hotline tư vấn
                      </p>
                      <p className="font-semibold text-xs text-[#8C6D23] group-hover:text-[#B88A29] transition-colors whitespace-nowrap mt-0.5">
                        {phoneDisplay}
                      </p>
                    </div>
                  </a>

                  {/* Email */}
                  <a
                    href={contact.email_href || (contact.email ? `mailto:${contact.email}` : '#')}
                    id="contact-link-email"
                    className="flex items-center sm:flex-col justify-start sm:justify-center text-left sm:text-center gap-3 sm:gap-1.5 p-3 sm:p-3.5 rounded-2xl bg-[#FBF8F0] border border-[#EBE5DA] hover:border-[#D4AF37] hover:bg-white hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="size-9 rounded-xl bg-[#8C6D23]/10 text-[#8C6D23] flex items-center justify-center shrink-0 group-hover:bg-[#D4AF37] group-hover:text-white transition-colors">
                      <Mail className="size-4" />
                    </div>
                    <div className="min-w-0 w-full px-0.5">
                      <p className="font-bold text-[#1A1612] text-[10px] sm:text-[11px] uppercase tracking-wider whitespace-nowrap">
                        Email hỗ trợ
                      </p>
                      <p className="font-semibold text-[11px] text-slate-700 group-hover:text-[#8C6D23] transition-colors break-all leading-tight mt-0.5">
                        {emailDisplay}
                      </p>
                    </div>
                  </a>

                  {/* Zalo Quick Chat */}
                  <a
                    href={resolveZaloOAUrl(contact.zalo_oa_id || siteSettings.zalo_oa_id, contact.zalo_url || siteSettings.zalo_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center sm:flex-col justify-start sm:justify-center text-left sm:text-center gap-3 sm:gap-1.5 p-3 sm:p-3.5 rounded-2xl bg-[#0068FF]/5 border border-[#0068FF]/20 hover:border-[#0068FF] hover:bg-white hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="size-9 rounded-xl bg-[#0068FF] text-white flex items-center justify-center shrink-0 font-bold text-[11px] tracking-tight shadow-sm">
                      Zalo
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#0068FF] text-[10px] sm:text-[11px] uppercase tracking-wider whitespace-nowrap">
                        Chat Zalo trực tiếp
                      </p>
                      <p className="text-[11px] text-slate-600 whitespace-nowrap mt-0.5">
                        Nhận báo giá ngay
                      </p>
                    </div>
                  </a>
                </address>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ SECTION (AI Search & SEO QA Accordion) */}
        <div className="pt-12 sm:pt-16 border-t border-[#EBE5DA] space-y-6 sm:space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#8C6D23] text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Giải đáp nhanh</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-serif uppercase tracking-tight text-[#1A1612]">
              Câu hỏi thường gặp
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-light">
              Những giải đáp chi tiết cho các thắc mắc phổ biến về dịch vụ và thông tin liên hệ của Maian Homes.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3 px-2 sm:px-0">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#EBE5DA] hover:border-[#D4AF37]/40 rounded-2xl transition-all duration-300 shadow-sm overflow-hidden"
                >
                  <button
                    id={`faq-btn-${idx}`}
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex justify-between items-center px-5 py-4 sm:px-6 sm:py-5 text-left text-xs sm:text-sm lg:text-base font-bold text-[#1A1612] hover:text-[#8C6D23] transition-colors focus:outline-none cursor-pointer"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                  >
                    <span>{faq.question}</span>
                    <span className="shrink-0 ml-4">
                      <ChevronDown
                        className={`size-4 text-[#8C6D23] transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </button>

                  <div
                    id={`faq-panel-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? 'max-h-80 border-t border-[#EBE5DA]' : 'max-h-0'
                    }`}
                  >
                    <div className="px-5 py-4 sm:px-6 sm:py-4.5 text-xs sm:text-sm text-slate-600 font-light leading-relaxed bg-[#FCFAF6]/50">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
