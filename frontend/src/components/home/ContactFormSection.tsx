'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { submitPublicLead } from '@/features/inquiries/api';
import { PhoneCall, Mail, Clock, CheckCircle2, AlertCircle, ArrowRight, UserCheck, MapPin } from 'lucide-react';
import { usePublicContactSettings } from '@/features/contact/usePublicContactSettings';

interface ProjectOption {
  id?: string;
  name: string;
  slug: string;
}

interface ContactFormSectionProps {
  projects: ProjectOption[];
  backgroundImage?: string;
}

export default function ContactFormSection({
  projects = [],
  backgroundImage = '/images/banner_sec.png',
}: ContactFormSectionProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contact } = usePublicContactSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    setLoading(true);
    setError(null);

    try {
      await submitPublicLead({
        customer_name: name.trim(),
        phone: phone.trim(),
        email: trimmedEmail || undefined,
        source: 'WEBSITE',
        interest_project_id: selectedProjectId || null,
        note: note.trim() || null,
      });
      setSent(true);
    } catch (err: unknown) {
      console.error('Error submitting homepage lead:', err);
      setError(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại. Vui lòng kiểm tra lại kết nối hoặc gọi Hotline.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setSelectedProjectId('');
    setNote('');
    setSent(false);
    setError(null);
  };

  return (
    <section className="py-10 sm:py-12 lg:py-8 xl:py-10 2xl:py-14 text-white font-sans relative overflow-hidden bg-zinc-950">
      {/* Background Image Layer */}
      <Image
        src={backgroundImage}
        alt="Không gian tư vấn và hỗ trợ khách hàng Maian Homes"
        fill
        sizes="100vw"
        quality={75}
        className="pointer-events-none object-cover object-center transition-transform duration-1000 scale-105"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:max-w-[1240px] 2xl:max-w-[1400px] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-center">

          {/* Left Column: Brand & Contact Info */}
          <div className="md:col-span-12 lg:col-span-6 space-y-5 lg:space-y-3.5 xl:space-y-4.5">
            <div>
              <div className="text-[#D4AF37] text-xs font-semibold uppercase tracking-[0.1em] mb-1.5 lg:mb-1 xl:mb-2">
                Đồng hành cùng chuyên gia
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-2xl xl:text-[1.75rem] min-[1440px]:text-3xl font-serif font-bold text-white drop-shadow-md mb-2.5 lg:mb-2 xl:mb-2.5 leading-snug">
                Hãy chia sẻ điều bạn đang tìm kiếm.{' '}<br className="hidden lg:block mb-0.5" />
                <span className="text-[#D4AF37]">Maian Homes</span> sẽ cùng bạn tìm ra lựa chọn phù hợp.
              </h2>
              <div className="h-0.5 w-14 lg:w-12 xl:w-16 bg-[#D4AF37] mb-2.5 lg:mb-2 xl:mb-3" />
              <p className="text-xs sm:text-sm lg:text-xs xl:text-xs min-[1440px]:text-sm text-[#F3E6C6]/80 leading-relaxed font-light">
                Mỗi quyết định bất động sản đều là một dấu mốc quan trọng. Hãy để đội ngũ chuyên gia của Maian Homes giúp bạn phân tích, lựa chọn và bảo vệ quyền lợi tối đa trong mọi giao dịch.
              </p>
            </div>

            {/* Quick Stats / Highlights */}
            <div className="grid grid-cols-2 gap-3 py-2.5 lg:py-2 xl:py-2.5 border-y border-white/10">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 lg:w-6.5 lg:h-6.5 xl:w-7.5 xl:h-7.5 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
                  <UserCheck className="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5" />
                </div>
                <div>
                  <p className="text-white font-semibold text-xs lg:text-[11px] xl:text-xs">Tư vấn 1:1</p>
                  <p className="text-white/70 text-[10px] lg:text-[9.5px] xl:text-[10px]">Chuyên sâu & Bảo mật</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 lg:w-6.5 lg:h-6.5 xl:w-7.5 xl:h-7.5 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5" />
                </div>
                <div>
                  <p className="text-white font-semibold text-xs lg:text-[11px] xl:text-xs">Phản hồi nhanh</p>
                  <p className="text-white/70 text-[10px] lg:text-[9.5px] xl:text-[10px]">Trong vòng 30 phút</p>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2.5 lg:space-y-1.5 xl:space-y-2 pt-0.5">
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 lg:w-7.5 lg:h-7.5 xl:w-8.5 xl:h-8.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all duration-300 flex-shrink-0">
                  <PhoneCall className="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-white/50 mb-0.5">Hotline tư vấn</p>
                  {contact.phone ? <a href={`tel:${contact.phone.replace(/\D/g, "")}`} className="text-xs sm:text-sm lg:text-xs xl:text-sm min-[1440px]:text-base font-bold text-white hover:text-[#D4AF37] transition-colors" aria-label={`Gọi hotline tư vấn bất động sản Maian Homes: ${contact.phone}`}>{contact.phone}</a> : <span className="text-white/60 text-xs">Đang cập nhật</span>}
                </div>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 lg:w-7.5 lg:h-7.5 xl:w-8.5 xl:h-8.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all duration-300 flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-white/50 mb-0.5">Email liên hệ</p>
                  {contact.email ? <a href={`mailto:${contact.email}`} className="text-xs sm:text-sm lg:text-xs xl:text-sm min-[1440px]:text-base font-bold text-white hover:text-[#D4AF37] transition-colors" aria-label={`Gửi email liên hệ Maian Homes: ${contact.email}`}>{contact.email}</a> : <span className="text-white/60 text-xs">Đang cập nhật</span>}
                </div>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 lg:w-7.5 lg:h-7.5 xl:w-8.5 xl:h-8.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all duration-300 flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-white/50 mb-0.5">Thời gian làm việc</p>
                  <p className="text-white font-semibold text-[11px] sm:text-xs lg:text-[11px] xl:text-xs">08:30 - 17:30 (Từ Thứ 2 - Thứ 7)</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Luxury Form Card */}
          <div className="md:col-span-12 lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-xl md:max-w-xl lg:max-w-[420px] xl:max-w-[460px] bg-black/45 backdrop-blur-2xl rounded-2xl p-4.5 sm:p-6 lg:p-4 xl:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/25 relative overflow-hidden text-white">
              {/* Top Golden Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F4E0A5] to-[#D4AF37]" />

              {sent ? (
                <div className="text-center py-6 px-3 space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-12 h-12 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full flex items-center justify-center mx-auto border border-[#D4AF37]/40">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">Đã nhận thông tin!</h3>
                    <p className="text-white/70 text-xs font-light max-w-md mx-auto leading-relaxed">
                      Chân thành cảm ơn bạn đã quan tâm. Các chuyên viên tư vấn cao cấp của Maian Homes sẽ sớm liên hệ để cung cấp thông tin chi tiết nhất.
                    </p>
                  </div>
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold tracking-wider uppercase transition-all duration-300 border border-white/15"
                    >
                      Gửi thêm yêu cầu tư vấn khác
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2.5 lg:mb-2 xl:mb-2.5">
                    <h3 className="text-sm sm:text-base lg:text-sm xl:text-base font-bold text-white tracking-tight mb-0.5">
                      Gửi Yêu Cầu Tư Vấn Ngay
                    </h3>
                    <p className="text-white/60 text-[10px] sm:text-[11px] font-light tracking-wide">
                      Thông tin của quý khách được bảo mật tuyệt đối 100%.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-2 lg:space-y-1.5 xl:space-y-2 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-1.5 xl:gap-2">
                      <div className="relative">
                        <label htmlFor="contact-name" className="sr-only">Họ và tên</label>
                        <input
                          id="contact-name"
                          type="text"
                          placeholder="Họ và tên *"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3 py-1.5 sm:px-3 sm:py-2 lg:py-1.5 lg:px-2.5 xl:py-1.5 xl:px-3 rounded-lg border border-white/15 bg-white/5 outline-none text-xs text-white placeholder-white/40 transition-all focus:bg-white/10 focus:border-[#D4AF37]"
                        />
                      </div>
                      <div className="relative">
                        <label htmlFor="contact-phone" className="sr-only">Số điện thoại</label>
                        <input
                          id="contact-phone"
                          type="tel"
                          placeholder="Số điện thoại *"
                          required
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-1.5 sm:px-3 sm:py-2 lg:py-1.5 lg:px-2.5 xl:py-1.5 xl:px-3 rounded-lg border border-white/15 bg-white/5 outline-none text-xs text-white placeholder-white/40 transition-all focus:bg-white/10 focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label htmlFor="contact-email" className="sr-only">Địa chỉ Email</label>
                      <input
                        id="contact-email"
                        type="email"
                        placeholder="Địa chỉ Email (tùy chọn)"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-1.5 sm:px-3 sm:py-2 lg:py-1.5 lg:px-2.5 xl:py-1.5 xl:px-3 rounded-lg border border-white/15 bg-white/5 outline-none text-xs text-white placeholder-white/40 transition-all focus:bg-white/10 focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="relative">
                      <label htmlFor="contact-project" className="block text-[10px] font-medium text-white/70 mb-0.5 uppercase tracking-wider">
                        Dự án quan tâm:
                      </label>
                      <select
                        id="contact-project"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full px-3 py-1.5 sm:px-3 sm:py-2 lg:py-1.5 lg:px-2.5 xl:py-1.5 xl:px-3 rounded-lg border border-white/15 bg-[#25211D] outline-none text-xs text-white transition-all focus:border-[#D4AF37] cursor-pointer"
                      >
                        <option value="" className="bg-[#1A1612] text-[#D4AF37] font-semibold py-1">
                          Tư vấn thông tin khác
                        </option>
                        {projects.map((p) => (
                          <option
                            key={p.id || p.slug}
                            value={p.id || p.name}
                            className="bg-[#1A1612] text-white py-1"
                          >
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <textarea
                        placeholder="Quý khách cần tư vấn cụ thể về chính sách giá, căn hộ mẫu hay pháp lý? (Tùy chọn)"
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full px-3 py-1.5 sm:px-3 sm:py-2 lg:py-1.5 lg:px-2.5 xl:py-1.5 xl:px-3 rounded-lg border border-white/15 bg-white/5 outline-none text-xs text-white placeholder-white/40 resize-none transition-all focus:bg-white/10 focus:border-[#D4AF37]"
                      />
                    </div>

                    {error && (
                      <div
                        role="alert"
                        aria-live="polite"
                        className="py-1.5 px-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-1.5 font-medium"
                      >
                        <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      aria-busy={loading}
                      aria-label={loading ? 'Đang gửi yêu cầu tư vấn' : 'Gửi yêu cầu tư vấn'}
                      className="w-full py-2 sm:py-2 lg:py-1.5 xl:py-2 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#c6a352] text-[#1A1612] font-bold text-xs tracking-widest uppercase shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>{loading ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Tư Vấn'}</span>
                      {!loading && <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
