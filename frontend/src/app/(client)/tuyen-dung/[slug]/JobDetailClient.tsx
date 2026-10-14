'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';
import { apiUploadPublic } from '@/lib/api';
import { 
  MapPin, Briefcase, DollarSign, Clock, Users, Send, CheckCircle, 
  ArrowLeft, Upload, Sparkles, Award, 
  ShieldCheck, Building, ChevronRight, ArrowDown
} from 'lucide-react';

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const ALLOWED_RESUME_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

interface PublicJob {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  employment_type: string;
  quantity: number;
  salary_range?: string;
  short_description?: string;
  deadline?: string;
  created_at?: string;
  status?: string;
  description_html?: string;
  requirements_html?: string;
  benefits_html?: string;
}

export default function JobDetailClient({ job, isExpired }: { job: PublicJob; isExpired: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const applicationKeyRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'desc' | 'req' | 'benefits'>('desc');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    birth_year: '',
    education: 'Đại học',
    school: '',
    address: ''
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const sanitizedDescription = useMemo(() => DOMPurify.sanitize(job.description_html || '<p>Đang cập nhật chi tiết công việc...</p>'), [job.description_html]);
  const sanitizedRequirements = useMemo(() => DOMPurify.sanitize(job.requirements_html || '<p>Đang cập nhật yêu cầu ứng viên...</p>'), [job.requirements_html]);
  const sanitizedBenefits = useMemo(() => DOMPurify.sanitize(job.benefits_html || '<p>Đang cập nhật chế độ đãi ngộ...</p>'), [job.benefits_html]);

  const updateFormField = (field: keyof typeof formData, value: string) => {
    applicationKeyRef.current = null;
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = formData.full_name.trim();
    const email = formData.email.trim().toLowerCase();
    const phoneInput = formData.phone.trim().replace(/[^\d+]/g, '');
    const normalizedPhone = phoneInput.startsWith('+84')
      ? '0' + phoneInput.slice(3)
      : phoneInput.startsWith('84')
        ? '0' + phoneInput.slice(2)
        : phoneInput;
    const birthYear = formData.birth_year.trim();

    if (!fullName || !email || !normalizedPhone) {
      alert('Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại.');
      return;
    }
    if (fullName.length < 2 || fullName.length > 200) {
      alert('Họ tên không hợp lệ.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Email không hợp lệ.');
      return;
    }
    if (!/^0\d{8,11}$/.test(normalizedPhone)) {
      alert('Số điện thoại không hợp lệ.');
      return;
    }
    if (birthYear && (!/^\d{4}$/.test(birthYear) || Number(birthYear) < 1900 || Number(birthYear) > new Date().getFullYear())) {
      alert('Năm sinh không hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('full_name', fullName);
      body.append('email', email);
      body.append('phone', normalizedPhone);
      if (birthYear) body.append('birth_year', birthYear);
      if (formData.education.trim()) body.append('education', formData.education.trim());
      if (formData.school.trim()) body.append('school', formData.school.trim());
      if (formData.address.trim()) body.append('address', formData.address.trim());
      if (resumeFile) {
        if (resumeFile.size > MAX_RESUME_SIZE) {
          throw new Error('Dung lượng CV không được vượt quá 10MB.');
        }
        if (resumeFile.type && !ALLOWED_RESUME_MIME_TYPES.has(resumeFile.type)) {
          throw new Error('Định dạng CV không hợp lệ. Vui lòng chọn file PDF, DOC hoặc DOCX.');
        }
        body.append('resume', resumeFile);
      }

      const applicationKey = applicationKeyRef.current || (
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : 'job-application-' + Date.now() + '-' + Math.random().toString(16).slice(2)
      );
      applicationKeyRef.current = applicationKey;
      await apiUploadPublic('/jobs/' + encodeURIComponent(job.slug) + '/apply', body, applicationKey);
      applicationKeyRef.current = null;
      setSubmitted(true);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Có lỗi xảy ra khi nộp hồ sơ.');
    } finally {
      setSubmitting(false);
    }
  };
  const scrollToApplyForm = () => {
    const formElement = document.getElementById('apply-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-[#2D1B14] pb-16 sm:pb-24 font-sans selection:bg-[#D4AF37]/30 selection:text-[#2D1B14]">
      {/* Luxury Hero Banner - Background Image with High Contrast Legibility */}
      <section className="relative overflow-hidden text-white pt-2 pb-10 sm:pt-4 sm:pb-14 md:pt-6 md:pb-16 border-b border-[#D4AF37]/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        {/* Background Image using Next.js Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/banner_hr.png"
            alt={job.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center sm:object-top transform scale-105 transition-transform duration-1000 ease-out"
          />
        </div>

        {/* Subtle Neutral Edge Gradient Overlay for Text Legibility (No brown color, no blur) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 sm:via-transparent to-black/70 z-[1] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#D4AF37]/15 via-transparent to-transparent pointer-events-none z-[1]" />

        {/* Subtle Luxury Top/Bottom Light Accents */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent z-[2]" />
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent z-[2]" />

        {/* Compact Breadcrumb Bar Inside Hero */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-white/15 pb-3.5 sm:pb-4">
          <Link href="/tuyen-dung" className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#F3E6C6] hover:text-white transition-all group drop-shadow-md">
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Danh sách vị trí</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-white/80 font-medium drop-shadow-md">Phòng ban:</span>
            <span className="font-bold text-[#F3E6C6] bg-black/40 backdrop-blur-md border border-white/20 px-3 py-0.5 rounded-full drop-shadow-md">
              {job.department}
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 space-y-6 sm:space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {isExpired ? (
                <span className="bg-gray-600/90 backdrop-blur-md text-white px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 border border-white/10">
                  <Clock className="w-3.5 h-3.5" />
                  Đã đóng nhận hồ sơ
                </span>
              ) : (
                <span className="bg-[#D4AF37] text-[#1C110A] px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {job.employment_type || 'Full-Time'}
                </span>
              )}
              <span className="bg-black/40 backdrop-blur-md border border-white/20 text-white px-3.5 py-1 rounded-full text-xs font-bold drop-shadow-md">
                Chỉ tiêu: {job.quantity || 1} nhân sự
              </span>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4 max-w-4xl">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
              {job.title}
            </h1>
            <p className="text-xs sm:text-base text-white font-medium sm:font-semibold leading-relaxed max-w-3xl [text-shadow:_0_2px_12px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
              {job.short_description || 'Gia nhập đội ngũ Maian Homes trong môi trường chuyên nghiệp, minh bạch và giàu cơ hội phát triển.'}
            </p>
          </div>

          {/* Quick Info Grid Cards - Compact on Mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3.5 sm:p-4 transition-all hover:bg-white/10 hover:border-[#D4AF37]/40">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#A8884A] font-bold uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] shrink-0" />
                <span className="truncate">Địa điểm</span>
              </div>
              <p className="text-xs sm:text-base font-bold text-white truncate">{job.location || 'Hà Nội / TP.HCM'}</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3.5 sm:p-4 transition-all hover:bg-white/10 hover:border-[#D4AF37]/40">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#A8884A] font-bold uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] shrink-0" />
                <span className="truncate">Đãi ngộ</span>
              </div>
              <p className="text-xs sm:text-base font-bold text-[#F3E5AB] truncate">{job.salary_range || 'Thỏa thuận hấp dẫn'}</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3.5 sm:p-4 transition-all hover:bg-white/10 hover:border-[#D4AF37]/40">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#A8884A] font-bold uppercase tracking-wider mb-1">
                <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] shrink-0" />
                <span className="truncate">Khối</span>
              </div>
              <p className="text-xs sm:text-base font-bold text-white truncate">{job.department || 'Khối Kinh Doanh'}</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3.5 sm:p-4 transition-all hover:bg-white/10 hover:border-[#D4AF37]/40">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#A8884A] font-bold uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] shrink-0" />
                <span className="truncate">Ngày dự kiến</span>
              </div>
              <p className="text-xs sm:text-base font-bold text-amber-300 truncate">
                {job.deadline ? new Date(job.deadline).toLocaleDateString('vi-VN') : 'Luôn mở'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10">
        
        {/* Left Column: Job Details (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 sm:space-y-8">
          
          {/* Interactive Navigation Tabs - Responsive Segmented Control */}
          <div className="bg-white p-1 sm:p-2 rounded-2xl border border-[#E5E2D9] shadow-xs grid grid-cols-3 gap-1 sm:flex sm:gap-2">
            <button
              onClick={() => setActiveTab('desc')}
              className={`py-2 sm:py-3 px-1 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                activeTab === 'desc'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-md scale-[1.02] sm:scale-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-[#2D1B14]'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate max-w-full">
                <span className="sm:hidden">Mô tả</span>
                <span className="hidden sm:inline">Mô tả công việc</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('req')}
              className={`py-2 sm:py-3 px-1 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                activeTab === 'req'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-md scale-[1.02] sm:scale-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-[#2D1B14]'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate max-w-full">
                <span className="sm:hidden">Yêu cầu</span>
                <span className="hidden sm:inline">Yêu cầu ứng viên</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('benefits')}
              className={`py-2 sm:py-3 px-1 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                activeTab === 'benefits'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-md scale-[1.02] sm:scale-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-[#2D1B14]'
              }`}
            >
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate max-w-full">
                <span className="sm:hidden">Quyền lợi</span>
                <span className="hidden sm:inline">Quyền lợi đãi ngộ</span>
              </span>
            </button>
          </div>

          {/* Dynamic Content Sections */}
          <div className="bg-white p-5 sm:p-10 rounded-3xl border border-[#E5E2D9] shadow-sm relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-bl-full pointer-events-none" />
            
            {activeTab === 'desc' && (
              <div className="space-y-5 sm:space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 pb-4 sm:pb-5 border-b border-gray-100">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center shadow-md shrink-0">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#2D1B14]">Chi Tiết Nhiệm Vụ & Công Việc</h2>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Trách nhiệm hàng ngày tại vị trí {job.title}</p>
                  </div>
                </div>
                <div 
                  className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed space-y-3 sm:space-y-4 marker:text-[#D4AF37]" 
                  dangerouslySetInnerHTML={{ __html: sanitizedDescription }} 
                />
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => setActiveTab('req')}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#2D1B14] hover:text-[#D4AF37] bg-gray-50 hover:bg-[#2D1B14] px-4 py-2 rounded-xl transition-all cursor-pointer group"
                  >
                    <span>Tiếp theo: Yêu cầu ứng viên</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'req' && (
              <div className="space-y-5 sm:space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 pb-4 sm:pb-5 border-b border-gray-100">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center shadow-md shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#2D1B14]">Tiêu Chuẩn & Yêu Cầu Ứng Viên</h2>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Những kỹ năng và thái độ chúng tôi tìm kiếm</p>
                  </div>
                </div>
                <div 
                  className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed space-y-3 sm:space-y-4 marker:text-[#D4AF37]" 
                  dangerouslySetInnerHTML={{ __html: sanitizedRequirements }} 
                />
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveTab('desc')}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-[#2D1B14] bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Mô tả công việc</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('benefits')}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#2D1B14] hover:text-[#D4AF37] bg-gray-50 hover:bg-[#2D1B14] px-4 py-2 rounded-xl transition-all cursor-pointer group"
                  >
                    <span>Tiếp theo: Quyền lợi</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'benefits' && (
              <div className="space-y-5 sm:space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 pb-4 sm:pb-5 border-b border-gray-100">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center shadow-md shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#2D1B14]">Chế Độ Đãi Ngộ & Đặc Quyền</h2>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Sự đầu tru của Maian Homes vào tương lai của bạn</p>
                  </div>
                </div>
                <div 
                  className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed space-y-3 sm:space-y-4 marker:text-[#D4AF37]" 
                  dangerouslySetInnerHTML={{ __html: sanitizedBenefits }} 
                />
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveTab('req')}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-[#2D1B14] bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Yêu cầu ứng viên</span>
                  </button>
                  {!isExpired && (
                    <button
                      onClick={scrollToApplyForm}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#D4AF37] bg-[#2D1B14] hover:bg-[#3D2B24] px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Ứng tuyển ngay</span>
                      <ArrowDown className="w-4 h-4 animate-bounce" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Application Form (5 Cols) */}
        <div id="apply-form" className="lg:col-span-5 xl:col-span-4 scroll-mt-24">
          <div className="bg-white p-5 sm:p-8 rounded-3xl border-2 border-[#D4AF37]/40 shadow-2xl sticky top-28 space-y-5 sm:space-y-6 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-2 bg-gradient-to-r from-[#D4AF37] to-[#A8884A]" />

            {isExpired ? (
              <div className="py-8 sm:py-10 text-center space-y-5 animate-fadeIn">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50/50 text-[#D4AF37] rounded-full flex items-center justify-center mx-auto shadow-inner border border-[#D4AF37]/20">
                  <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2D1B14]">Vị Trí Tạm Đóng</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xs mx-auto font-light">
                  Vị trí tuyển dụng này hiện đã hoàn tất tiếp nhận hồ sơ. Tuy nhiên, Maian Homes luôn chào đón các ứng viên tiềm năng gia nhập <strong className="text-[#2D1B14]">Mạng lưới Tài năng</strong> để nhận cơ hội mới sớm nhất.
                </p>
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <Link
                    href="/lien-he"
                    className="w-full justify-center inline-flex items-center gap-2 bg-[#2D1B14] hover:bg-[#3D2B24] text-[#D4AF37] px-6 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-[0.98]"
                  >
                    <Send className="w-4 h-4" />
                    <span>Gửi CV Ứng Tuyển Tự Do</span>
                  </Link>
                  <Link
                    href="/tuyen-dung"
                    className="w-full justify-center inline-flex items-center gap-2 bg-[#FAF9F6] border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3.5 rounded-2xl text-xs font-bold transition-all active:scale-[0.98]"
                  >
                    <span>Xem vị trí đang mở khác</span>
                  </Link>
                </div>
              </div>
            ) : submitted ? (
              <div className="py-10 sm:py-12 text-center space-y-4 sm:space-y-5 animate-fadeIn">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2D1B14]">Ứng Tuyển Thành Công!</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                  Hồ sơ của bạn đã được chuyển đến ban lãnh đạo Maian Homes. Bộ phận Nhân sự sẽ liên hệ mời phỏng vấn trong vòng <strong className="text-[#2D1B14]">24 - 48 giờ làm việc</strong>.
                </p>
                <div className="pt-3 sm:pt-4">
                  <button
                    onClick={() => {
                      applicationKeyRef.current = null;
                      setSubmitted(false);
                      setFormData({
                        full_name: '',
                        email: '',
                        phone: '',
                        birth_year: '',
                        education: 'Đại học',
                        school: '',
                        address: ''
                      });
                      setResumeFile(null);
                    }}
                    className="w-full px-6 py-3.5 bg-[#2D1B14] hover:bg-[#3D2B24] text-[#D4AF37] rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    Nộp thêm vị trí khác
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitApply} className="space-y-3.5 sm:space-y-4">
                <div className="border-b border-gray-100 pb-3.5 sm:pb-4">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#A8884A] block mb-1">Cơ hội thăng tiến</span>
                  <h3 className="text-lg sm:text-2xl font-serif font-bold text-[#2D1B14]">Nộp Hồ Sơ Ứng Tuyển Ngay</h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                    <span>Thông tin bảo mật tuyệt đối 100%</span>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Họ và tên ứng viên *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={e => updateFormField('full_name', e.target.value)}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => updateFormField('email', e.target.value)}
                      placeholder="email@domain.com"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={e => updateFormField('phone', e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Năm sinh</label>
                    <input
                      type="number"
                      value={formData.birth_year}
                      onChange={e => updateFormField('birth_year', e.target.value)}
                      placeholder="1998"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Trình độ</label>
                    <select
                      value={formData.education}
                      onChange={e => updateFormField('education', e.target.value)}
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white cursor-pointer"
                    >
                      <option value="Đại học">Đại học</option>
                      <option value="Cao đẳng">Cao đẳng</option>
                      <option value="Sau đại học">Sau đại học</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Trường học / Đơn vị công tác cũ</label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={e => updateFormField('school', e.target.value)}
                    placeholder="VD: ĐH Kinh tế Quốc dân..."
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all bg-gray-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2D1B14] mb-1">Đính kèm CV (PDF / DOCX)</label>
                  <label className={`flex flex-col items-center justify-center p-4 sm:p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center ${
                    resumeFile 
                      ? 'border-[#D4AF37] bg-[#FAF8F2]' 
                      : 'border-gray-300 hover:border-[#D4AF37] bg-gray-50/80 hover:bg-[#FAF8F2]'
                  }`}>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center mb-1.5 sm:mb-2 shadow-xs">
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xs font-bold text-[#2D1B14] max-w-[200px] sm:max-w-[220px] truncate">
                      {resumeFile ? resumeFile.name : 'Nhấn để chọn tệp CV từ máy'}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Hỗ trợ .pdf, .doc, .docx (Tối đa 10MB)</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > MAX_RESUME_SIZE) {
                          alert('Dung lượng CV không được vượt quá 10MB.');
                          e.target.value = '';
                          return;
                        }
                        if (file.type && !ALLOWED_RESUME_MIME_TYPES.has(file.type)) {
                          alert('Định dạng CV không hợp lệ. Vui lòng chọn file PDF, DOC hoặc DOCX.');
                          e.target.value = '';
                          return;
                        }
                        applicationKeyRef.current = null;
                        setResumeFile(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="pt-2 sm:pt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-[#2D1B14] via-[#3D2B24] to-[#2D1B14] hover:from-[#1C110A] hover:to-[#1C110A] text-[#D4AF37] py-3.5 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98] group"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        <span>Gửi Hồ Sơ Ứng Tuyển Ngay</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
