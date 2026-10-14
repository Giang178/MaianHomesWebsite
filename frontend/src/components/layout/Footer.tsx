// src/components/layout/Footer.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Phone,
  MapPin,
  Mail,
  Clock,
  ArrowUp,
  ChevronDown,
  Building2,
  Layers,
} from 'lucide-react';
import { usePublicContactSettings } from '@/features/contact/usePublicContactSettings';
import type { PublicContactSettings } from '@/features/contact/types';
import {
  mediaUrl,
  usePublicSiteSettings,
  type PublicSiteSettings,
} from '@/features/website/public/site-settings';

type FooterViewProps = {
  forceShow?: boolean;
  contact: PublicContactSettings;
  siteSettings: PublicSiteSettings;
};

export function FooterView({
  forceShow = false,
  contact,
  siteSettings,
}: FooterViewProps) {
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({
    services: false,
    discover: false,
    contact: false,
  });

  const toggleSection = (section: string) => {
    setMobileExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const phoneDisplay = contact.phone || siteSettings.phone || '';
  const phoneClean = phoneDisplay.replace(/\D/g, '');
  const emailDisplay = contact.email || siteSettings.email || '';
  const addressDisplay = siteSettings.address || '';
  const companyName =
    siteSettings.footer?.company_name || 'CÔNG TY TNHH MAIAN HOMES';
  const taxId = siteSettings.footer?.tax_id || '';
  const workingHours = siteSettings.footer?.working_hours || '';
  const copyrightText =
    siteSettings.footer?.copyright_text ||
    `© ${new Date().getFullYear()} ${companyName}. All Rights Reserved.`;
  const facebookUrl =
    siteSettings.social_links?.facebook || 'https://www.facebook.com/maianhomes';
  const instagramUrl =
    siteSettings.social_links?.instagram || 'https://www.instagram.com/maianhomes';
  const tiktokUrl =
    siteSettings.social_links?.tiktok || 'https://www.tiktok.com/@maianhomes';
  const youtubeUrl =
    siteSettings.social_links?.youtube || 'https://www.youtube.com/@maianhomes';

  return (
    <footer
      data-force-show={forceShow || undefined}
      className="relative bg-gradient-to-b from-[#14110E] via-[#1A1612] to-[#241D16] text-[#F3E6C6] border-t border-[#D4AF37]/25 overflow-hidden transition-all duration-300"
    >
      {/* Subtle Top Ambient Gold Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent pointer-events-none" />

      {/* Main Content Area */}
      <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-12 pb-10 lg:pt-16 lg:pb-12">
        {/* DESKTOP & LAPTOP GRID (Hidden on mobile < md, visible md+) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-10">

          {/* CỘT 1: THƯƠNG HIỆU & GIỚI THIỆU (md:col-span-2 lg:col-span-4 xl:col-span-4) */}
          <div className="space-y-4 lg:col-span-4 xl:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 group"
              aria-label="Maian Homes - Trang chủ công ty tư vấn bất động sản"
            >
              {siteSettings.logo_footer_media_id ? (
                <Image
                  src={mediaUrl(siteSettings.logo_footer_media_id, '/images/logo_maian.png')}
                  alt="Logo công ty Maian Homes - Chân trang"
                  width={180}
                  height={52}
                  className="h-10 w-auto object-contain brightness-110"
                />
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl xl:text-3xl font-bold tracking-[0.12em] text-[#F3E6C6] font-serif group-hover:text-white transition-colors">
                    MAIAN
                  </span>
                  <span className="text-lg xl:text-xl tracking-widest text-[#D4AF37] font-semibold group-hover:text-[#F3E6C6] transition-colors">
                    HOMES
                  </span>
                </div>
              )}
            </Link>

            <p className="text-[#F3E6C6]/75 text-xs sm:text-sm leading-relaxed font-light max-w-md text-pretty">
              Tư vấn đúng giá trị, chọn đúng bất động sản. Maian Homes — Không bán điều chúng tôi có, tư vấn điều khách hàng thực sự cần.
            </p>

            {/* Quick Contact Action Pills */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {phoneClean && (
                <a
                  href={`tel:${phoneClean}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37]/15 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#1A1612] border border-[#D4AF37]/35 transition-all shadow-sm"
                  aria-label={`Hotline tư vấn: ${phoneDisplay}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Gọi hotline: {phoneDisplay}</span>
                </a>
              )}
              {emailDisplay && (
                <a
                  href={`mailto:${emailDisplay}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 text-[#F3E6C6]/80 hover:text-white border border-white/10 transition-all"
                  aria-label={`Gửi email: ${emailDisplay}`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Gửi email: {emailDisplay}</span>
                </a>
              )}
            </div>

            {/* Social Network Links */}
            {(facebookUrl || instagramUrl || tiktokUrl || youtubeUrl) && (
              <div className="pt-2">
                <span className="text-[11px] uppercase tracking-wider text-[#F3E6C6]/50 font-medium block mb-2">
                  Kết nối với chúng tôi
                </span>
                <div className="flex items-center gap-2.5">
                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-[#1A1612] hover:scale-105 transition-all duration-200"
                      title="Facebook Maian Homes"
                      aria-label="Theo dõi Maian Homes trên Facebook"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </a>
                  )}
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-[#1A1612] hover:scale-105 transition-all duration-200"
                      title="Instagram Maian Homes"
                      aria-label="Trang Instagram chính thức của Maian Homes"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                    </a>
                  )}
                  {tiktokUrl && (
                    <a
                      href={tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-[#1A1612] hover:scale-105 transition-all duration-200"
                      title="TikTok Maian Homes"
                      aria-label="Kênh TikTok chính thức của Maian Homes"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
                    </a>
                  )}
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-[#1A1612] hover:scale-105 transition-all duration-200"
                      title="YouTube Maian Homes"
                      aria-label="Kênh YouTube chính thức của Maian Homes"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5a3 3 0 0 1 2.1-2.1C6.5 5 9.2 5 12 5s5.5 0 7.4.4a3 3 0 0 1 2.1 2.1c.5 1.8.5 4.5.5 4.5s0 2.7-.5 4.5a3 3 0 0 1-2.1 2.1c-1.9.4-4.6.4-7.4.4s-5.5 0-7.4-.4a3 3 0 0 1-2.1-2.1C2 14.7 2 12 2 12s0-2.7.5-4.5z"/><path d="m10 9 5 3-5 3z"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CỘT 2: DỊCH VỤ (lg:col-span-2 xl:col-span-2) */}
          <div className="lg:col-span-2 xl:col-span-2">
            <p className="text-white font-bold text-xs sm:text-sm tracking-widest uppercase mb-3.5 flex items-center gap-2">
              Dịch vụ
              <span className="h-px bg-gradient-to-r from-[#D4AF37] to-transparent flex-1" />
            </p>
            <ul className="flex flex-col gap-2.5 text-xs sm:text-sm font-light text-[#F3E6C6]/75">
              <li>
                <Link
                  href="/dich-vu-cho-thue/office"
                  aria-label="Dịch vụ cho thuê văn phòng trọn gói Maian Office"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Cho thuê văn phòng Maian Office</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/dich-vu-cho-thue/coworking"
                  aria-label="Không gian làm việc chung Co-working Space hiện đại"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Không gian làm việc Co-working</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/ky-gui"
                  aria-label="Dịch vụ ký gửi nhà đất và căn hộ chuyên nghiệp"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Ký gửi nhà đất</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/du_an"
                  aria-label="Xem danh mục dự án bất động sản cao cấp nổi bật"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Dự án nổi bật</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* CỘT 3: KHÁM PHÁ (lg:col-span-3 xl:col-span-3) */}
          <div className="lg:col-span-3 xl:col-span-3">
            <p className="text-white font-bold text-xs sm:text-sm tracking-widest uppercase mb-3.5 flex items-center gap-2">
              Khám phá
              <span className="h-px bg-gradient-to-r from-[#D4AF37] to-transparent flex-1" />
            </p>
            <ul className="flex flex-col gap-2.5 text-xs sm:text-sm font-light text-[#F3E6C6]/75">
              <li>
                <Link
                  href="/gioi-thieu"
                  aria-label="Tìm hiểu câu chuyện thương hiệu và tầm nhìn Maian Homes"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Về Maian Homes</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/doi-ngu"
                  aria-label="Gặp gỡ đội ngũ chuyên gia tư vấn bất động sản giàu kinh nghiệm"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Đội ngũ chuyên gia</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/tuyen-dung"
                  aria-label="Cơ hội việc làm và tuyển dụng nhân tài tại Maian Homes"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Tuyển dụng nhân tài</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/tin_tuc"
                  aria-label="Cập nhật tin tức và phân tích thị trường bất động sản mới nhất"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Tin tức & Thị trường</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/lien-he"
                  aria-label="Gửi yêu cầu liên hệ và nhận tư vấn chuyên sâu"
                  className="hover:text-[#D4AF37] hover:translate-x-1 transition-all duration-200 flex items-center gap-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60 shrink-0" />
                  <span>Liên hệ & Tư vấn</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* CỘT 4: TRỤ SỞ & LIÊN HỆ (lg:col-span-3 xl:col-span-3) */}
          <div className="lg:col-span-3 xl:col-span-3">
            <p className="text-white font-bold text-xs sm:text-sm tracking-widest uppercase mb-3.5 flex items-center gap-2">
              Trụ sở & Liên hệ
              <span className="h-px bg-gradient-to-r from-[#D4AF37] to-transparent flex-1" />
            </p>
            <div className="space-y-3 text-xs sm:text-sm text-[#F3E6C6]/75 font-light">
              <div>
                <p className="font-semibold text-[#D4AF37] mb-1 uppercase tracking-wider text-[11px]">
                  {companyName}
                </p>
                <div className="flex gap-2.5 items-start">
                  <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{addressDisplay}</p>
                </div>
              </div>

              {phoneDisplay && (
                <div className="flex gap-2.5 items-center">
                  <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <p>
                    Hotline:{' '}
                    {phoneClean ? (
                      <a
                        href={`tel:${phoneClean}`}
                        aria-label={`Hotline văn phòng đại diện Maian Homes: ${phoneDisplay}`}
                        className="hover:text-[#D4AF37] font-semibold text-white transition-colors"
                      >
                        {phoneDisplay}
                      </a>
                    ) : (
                      <span className="font-semibold text-white">{phoneDisplay}</span>
                    )}
                  </p>
                </div>
              )}

              {emailDisplay && (
                <div className="flex gap-2.5 items-center">
                  <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <p>
                    Email:{' '}
                    <a
                      href={`mailto:${emailDisplay}`}
                      className="hover:text-[#D4AF37] transition-colors"
                    >
                      {emailDisplay}
                    </a>
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 items-center text-xs text-[#F3E6C6]/60 pt-1">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{workingHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE VIEW (Visible on mobile < md, hidden md+) */}
        <div className="block md:hidden space-y-6">
          {/* Mobile Brand & Fast Action Bar */}
          <div className="text-center space-y-3 pb-2 border-b border-white/10">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 group"
              aria-label="Về trang chủ Maian Homes từ chân trang di động"
            >
              {siteSettings.logo_footer_media_id ? (
                <Image
                  src={mediaUrl(siteSettings.logo_footer_media_id, '/images/logo_maian.png')}
                  alt="Logo công ty Maian Homes - Chân trang di động"
                  width={160}
                  height={46}
                  className="h-9 w-auto object-contain brightness-110"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-[0.12em] text-[#F3E6C6] font-serif">
                    MAIAN HOMES VIỆT NAM
                  </span>
                </div>
              )}
            </Link>

            <p className="text-xs text-[#F3E6C6]/70 font-light leading-relaxed px-2">
              Tư vấn đúng giá trị, chọn đúng bất động sản. Maian Homes đồng hành cùng quý khách hàng trong mọi quyết định an cư và đầu tư.
            </p>

            {/* Quick Mobile Touch Targets */}
            <div className="grid grid-cols-2 gap-2 pt-1 max-w-xs mx-auto">
              {phoneClean ? (
                <a
                  href={`tel:${phoneClean}`}
                  aria-label={`Gọi điện trực tiếp đến hotline tư vấn: ${phoneDisplay}`}
                  className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-[#1A1612] font-bold text-xs shadow-md active:scale-95 transition-transform"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Gọi Hotline</span>
                </a>
              ) : (
                <div className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-xs">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Tư Vấn</span>
                </div>
              )}
              <Link
                href="/lien-he"
                className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white font-medium text-xs border border-white/15 active:scale-95 transition-transform"
              >
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Gửi Liên Hệ</span>
              </Link>
            </div>
          </div>

          {/* Mobile Collapsible Sections / Compact Link Hub */}
          <div className="space-y-2">
            {/* Section 1: Dịch vụ */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('services')}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold uppercase tracking-wider text-white hover:text-[#D4AF37] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>Dịch Vụ Bất Động Sản</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#D4AF37] transition-transform duration-200 ${
                    mobileExpanded.services ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {mobileExpanded.services && (
                <ul className="px-4 pb-3 space-y-2 text-xs text-[#F3E6C6]/80 font-light border-t border-white/5 pt-2">
                  <li>
                    <Link
                      href="/dich-vu-cho-thue/office"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Maian Office (Hạng A, B, C)
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dich-vu-cho-thue/coworking"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Co-working Space (Chỗ ngồi làm việc)
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/ky-gui"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Dịch vụ Ký gửi nhà đất & căn hộ
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/du_an"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Danh mục dự án bất động sản nổi bật
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            {/* Section 2: Khám phá & Pháp lý */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('discover')}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold uppercase tracking-wider text-white hover:text-[#D4AF37] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D4AF37]" />
                  <span>Khám Phá & Công Ty</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#D4AF37] transition-transform duration-200 ${
                    mobileExpanded.discover ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {mobileExpanded.discover && (
                <ul className="px-4 pb-3 space-y-2 text-xs text-[#F3E6C6]/80 font-light border-t border-white/5 pt-2">
                  <li>
                    <Link
                      href="/gioi-thieu"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Về Maian Homes
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/doi-ngu"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Đội ngũ chuyên gia tư vấn
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/tuyen-dung"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Tuyển dụng & Cơ hội hợp tác
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/tin_tuc"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Tin tức thị trường bất động sản
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/lien-he"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Liên hệ & Tư vấn
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/chinh-sach-bao-mat"
                      className="block py-1 hover:text-[#D4AF37] transition-colors"
                    >
                      • Chính sách bảo mật thông tin
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            {/* Section 3: Trụ sở & Mạng xã hội */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5 text-xs text-[#F3E6C6]/80 font-light">
              <p className="font-semibold text-[#D4AF37] uppercase tracking-wider text-[11px]">
                {companyName}
              </p>
              <div className="flex gap-2 items-start">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <p className="leading-relaxed">{addressDisplay}</p>
              </div>
              {phoneDisplay && (
                <div className="flex gap-2 items-center">
                  <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <p>
                    Hotline:{' '}
                    {phoneClean ? (
                      <a
                        href={`tel:${phoneClean}`}
                        aria-label={`Hotline hỗ trợ khách hàng di động: ${phoneDisplay}`}
                        className="text-white font-semibold"
                      >
                        {phoneDisplay}
                      </a>
                    ) : (
                      <span className="text-white font-semibold">{phoneDisplay}</span>
                    )}
                  </p>
                </div>
              )}
              {emailDisplay && (
                <div className="flex gap-2 items-center">
                  <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <p>
                    Email:{' '}
                    <a href={`mailto:${emailDisplay}`} className="text-white">
                      {emailDisplay}
                    </a>
                  </p>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{workingHours}</span>
              </div>

              {/* Mobile Social Buttons */}
              {(facebookUrl || instagramUrl || tiktokUrl || youtubeUrl) && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/5">
                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors"
                      aria-label="Facebook"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </a>
                  )}
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors"
                      aria-label="Instagram"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                    </a>
                  )}
                  {tiktokUrl && (
                    <a
                      href={tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors"
                      aria-label="TikTok"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
                    </a>
                  )}
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors"
                      aria-label="YouTube"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5a3 3 0 0 1 2.1-2.1C6.5 5 9.2 5 12 5s5.5 0 7.4.4a3 3 0 0 1 2.1 2.1c.5 1.8.5 4.5.5 4.5s0 2.7-.5 4.5a3 3 0 0 1-2.1 2.1c-1.9.4-4.6.4-7.4.4s-5.5 0-7.4-.4a3 3 0 0 1-2.1-2.1C2 14.7 2 12 2 12s0-2.7.5-4.5z"/><path d="m10 9 5 3-5 3z"/></svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUB-FOOTER / LEGAL BOTTOM BAR (Optimized for all viewports) */}
      <div className="border-t border-white/10 bg-[#0E0C0A]/80 backdrop-blur-sm py-4 px-4 sm:px-6 lg:px-8 xl:px-12 text-xs text-[#F3E6C6]/60">
        <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">

          {/* Copyright & Tax Number */}
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 leading-relaxed">
            <span>{copyrightText}</span>
            <span className="hidden sm:inline-block h-3 w-px bg-white/15" />
            <span className="text-[#F3E6C6]/50">
              Mã số thuế: <strong className="text-[#F3E6C6]/80 font-normal">{taxId}</strong>
            </span>
          </div>

          {/* Quick Legal Links & Back To Top Button */}
          <div className="flex items-center gap-4">
            <Link
              href="/chinh-sach-bao-mat"
              className="hover:text-[#D4AF37] transition-colors"
            >
              Chính sách bảo mật
            </Link>
            <span className="h-3 w-px bg-white/15" />
            <Link
              href="/so-do-trang-web"
              className="hover:text-[#D4AF37] transition-colors"
            >
              Sơ đồ trang web
            </Link>
            <span className="h-3 w-px bg-white/15" />
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-[#F3E6C6]/70 hover:text-[#D4AF37] transition-colors cursor-pointer py-1 px-1.5"
              aria-label="Cuộn lên đầu trang"
            >
              <span>Đầu trang</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Footer({ forceShow = false }: { forceShow?: boolean }) {
  const { contact } = usePublicContactSettings();
  const siteSettings = usePublicSiteSettings();

  return (
    <FooterView
      forceShow={forceShow}
      contact={contact}
      siteSettings={siteSettings}
    />
  );
}
