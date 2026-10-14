'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Briefcase, DollarSign, Clock, ChevronRight, Award, Heart, BookOpen, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

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
  is_expired?: boolean;
}

export default function RecruitmentClient({ initialJobs = [], heroImage }: { initialJobs?: PublicJob[]; heroImage?: string }) {
  const [jobs, setJobs] = useState<PublicJob[]>(initialJobs);
  const [loading, setLoading] = useState(initialJobs.length === 0);
  const hasHydratedInitialJobs = useRef(initialJobs.length > 0);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('Tất cả');
  const [location, setLocation] = useState('Tất cả');
  const [employmentType, setEmploymentType] = useState('Tất cả');
  const [filterOptions, setFilterOptions] = useState(() => ({
    departments: [...new Set(initialJobs.map(job => job.department).filter(Boolean))],
    locations: [...new Set(initialJobs.map(job => job.location).filter(Boolean))],
    employmentTypes: [...new Set(initialJobs.map(job => job.employment_type).filter(Boolean))],
  }));

  useEffect(() => {
    if (hasHydratedInitialJobs.current && department === 'Tất cả' && location === 'Tất cả' && employmentType === 'Tất cả' && !search) {
      hasHydratedInitialJobs.current = false;
      return;
    }

    const loadJobs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (department !== 'Tất cả') params.append('department', department);
        if (location !== 'Tất cả') params.append('location', location);
        if (employmentType !== 'Tất cả') params.append('employment_type', employmentType);
        if (search) params.append('q', search);

        const data = await apiFetch(`/jobs?${params.toString()}`, {}, 'public');
        const loadedJobs = Array.isArray(data) ? data : [];
        setJobs(loadedJobs);
        setFilterOptions(current => ({
          departments: current.departments.length ? current.departments : [...new Set(loadedJobs.map(job => job.department).filter(Boolean))],
          locations: current.locations.length ? current.locations : [...new Set(loadedJobs.map(job => job.location).filter(Boolean))],
          employmentTypes: current.employmentTypes.length ? current.employmentTypes : [...new Set(loadedJobs.map(job => job.employment_type).filter(Boolean))],
        }));
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
  }, [department, location, employmentType, search]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-16 text-[#2D1B14] selection:bg-[#D4AF37] selection:text-white font-sans sm:pb-20">
      {/* Hero Section - Background Image with Luxury Glassmorphism Overlays & Multi-Device Responsive Polish */}
      <section className="relative overflow-hidden min-h-[360px] sm:min-h-[400px] md:min-h-[460px] lg:min-h-[500px] xl:min-h-[540px] flex items-center justify-center pt-6 pb-12 sm:pt-10 sm:pb-16 md:pt-12 md:pb-20 text-white border-b border-[#D4AF37]/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        {/* Background Image using Next.js Image with high-priority responsive rendering */}
        <div className="absolute inset-0 z-0">
          <Image
            src={heroImage || '/images/banner_hr.png'}
            alt="Gia Nhập Đội Ngũ Tiên Phong Maian Homes"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center sm:object-top transform scale-105 transition-transform duration-1000 ease-out"
          />
        </div>

        {/* Subtle Neutral Edge Gradient Overlay for Text Legibility (No brown color, no blur) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 sm:via-transparent to-black/60 z-[1] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#D4AF37]/15 via-transparent to-transparent pointer-events-none z-[1]" />

        {/* Subtle Luxury Top/Bottom Light Accents */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent z-[2]" />
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent z-[2]" />

        {/* Content Container - Responsive Typography, Spacing & Micro-animations */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 relative z-10 text-center space-y-4 sm:space-y-6 md:space-y-7 my-auto">
          <h1 className="text-2xl min-[380px]:text-3xl sm:text-5xl md:text-5xl lg:text-5xl xl:text-[3.5rem] font-serif font-bold tracking-tight leading-[1.25] sm:leading-[1.15] md:leading-[1.1] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            <span>Thành Công Cùng</span> <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] block sm:inline mt-1 sm:mt-0 drop-shadow-[0_2px_15px_rgba(212,175,55,0.35)]">
              Maian Homes
            </span>
          </h1>

          <p className="text-xs min-[380px]:text-sm sm:text-base md:text-lg lg:text-xl text-white font-medium sm:font-semibold max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto leading-relaxed sm:leading-relaxed md:leading-8 px-2 [text-shadow:_0_2px_12px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
            Từ một người môi giới đến một chuyên gia.<br />
            Từ những giao dịch đầu tiên đến một sự nghiệp dài hạn.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] block sm:inline mt-1 sm:mt-0 brightness-150 drop-shadow-[0_0_10px_rgba(212,175,55,0.4)] font-bold">
              Maian Homes </span> đồng hành cùng bạn trên hành trình đó.
          </p>
        </div>
      </section>

      {/* Culture & Perks Section - Mobile Horizontal Snap Carousel / Desktop Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-12 relative z-20 mb-12 sm:mb-20">
        <h2 className="sr-only">Đặc quyền và môi trường làm việc tại Maian Homes</h2>
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:pb-0 sm:overflow-visible no-scrollbar">
          <div className="min-w-[260px] sm:min-w-0 snap-start bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#E5E2D9] shadow-xl hover:shadow-2xl hover:border-[#D4AF37]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center mb-3.5 sm:mb-4 group-hover:scale-110 transition-transform shadow-md">
                <Award className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-[#2D1B14] mb-1.5">Trở Thành Chuyên Gia, Không Chỉ Là Người Bán</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Được đào tạo tư duy tư vấn, kiến thức thị trường, sản phẩm và kỹ năng thực chiến để từng bước trở thành chuyên gia tư vấn bất động sản chuyên nghiệp.</p>
            </div>
          </div>

          <div className="min-w-[260px] sm:min-w-0 snap-start bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#E5E2D9] shadow-xl hover:shadow-2xl hover:border-[#D4AF37]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center mb-3.5 sm:mb-4 group-hover:scale-110 transition-transform shadow-md">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-[#2D1B14] mb-1.5">Hệ Sinh Thái Giúp Bạn Tạo Ra Kết Quả</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Sản phẩm, công cụ, marketing, đào tạo và đội ngũ hỗ trợ được xây dựng đồng bộ, giúp bạn yên tâm làm nghề và phát triển khách hàng.</p>
            </div>
          </div>

          <div className="min-w-[260px] sm:min-w-0 snap-start bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#E5E2D9] shadow-xl hover:shadow-2xl hover:border-[#D4AF37]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center mb-3.5 sm:mb-4 group-hover:scale-110 transition-transform shadow-md">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-[#2D1B14] mb-1.5">Xây Dựng Tài Sản Sự Nghiệp Của Riêng Bạn</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Không chỉ tạo thu nhập từ từng giao dịch, Maian Homes khuyến khích mỗi thành viên xây dựng thương hiệu cá nhân, tệp khách hàng và uy tín nghề nghiệp – những tài sản theo bạn lâu dài.</p>
            </div>
          </div>

          <div className="min-w-[260px] sm:min-w-0 snap-start bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-[#E5E2D9] shadow-xl hover:shadow-2xl hover:border-[#D4AF37]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#2D1B14] text-[#D4AF37] flex items-center justify-center mb-3.5 sm:mb-4 group-hover:scale-110 transition-transform shadow-md">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-[#2D1B14] mb-1.5">Môi Trường Để Đi Xa Với Nghề</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Văn hóa chính trực, chia sẻ và cùng phát triển giúp bạn có đồng đội, định hướng và lộ trình để biến nghề môi giới thành một sự nghiệp bền vững</p>
            </div>
          </div>
        </div>
        <div className="flex sm:hidden justify-center items-center gap-1.5 mt-2 text-[11px] text-gray-400 font-medium">
          <span>← Vuốt ngang để xem thêm đặc quyền →</span>
        </div>
      </section>

      {/* Job Search & Filters Section - Compact & Touch Friendly */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#E5E2D9] shadow-lg mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#2D1B14] mb-5 sm:mb-6 text-center">Khám Phá Cơ Hội Việc Làm</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm vị trí tuyển dụng..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all"
              />
            </div>

            <div>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-sm font-semibold text-gray-700 bg-gray-50/80 focus:ring-2 focus:ring-[#D4AF37] outline-none transition-all cursor-pointer"
              >
                <option value="Tất cả">Tất cả bộ phận</option>
                {filterOptions.departments.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>

            <div>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-sm font-semibold text-[#2D1B14] bg-amber-50/50 focus:ring-2 focus:ring-[#D4AF37] outline-none transition-all cursor-pointer"
              >
                <option value="Tất cả">Tất cả địa điểm</option>
                {filterOptions.locations.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>

            <div>
              <select
                value={employmentType}
                onChange={e => setEmploymentType(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-sm font-semibold text-gray-700 bg-gray-50/80 focus:ring-2 focus:ring-[#D4AF37] outline-none transition-all cursor-pointer"
              >
                <option value="Tất cả">Tất cả hình thức</option>
                {filterOptions.employmentTypes.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Job List Grid - Mobile Touch Optimized Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 sm:p-16 text-center border border-[#E5E2D9] text-gray-400">
            <Briefcase className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 opacity-30 text-[#D4AF37]" />
            <h3 className="text-base sm:text-lg font-bold text-[#2D1B14] mb-1">Hiện chưa có vị trí phù hợp</h3>
            <p className="text-xs sm:text-sm">Vui lòng thử điều chỉnh bộ lọc hoặc liên hệ trực tiếp phòng tuyển dụng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {jobs.map((job) => {
              const isExpired = job.is_expired === true || job.status === 'CLOSED' || job.status === 'EXPIRED';
              return (
                <article
                  key={job.id}
                  className={`bg-white rounded-3xl border border-[#E5E2D9] p-5 sm:p-8 shadow-sm hover:shadow-xl hover:border-[#D4AF37] transition-all flex flex-col justify-between group relative overflow-hidden ${isExpired ? 'opacity-80' : ''}`}
                >
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-3 py-1 bg-[#2D1B14] text-[#D4AF37] rounded-full text-[11px] sm:text-xs font-bold tracking-wide">
                        {job.department}
                      </span>
                      {isExpired ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-500 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" /> Đã Hết Hạn
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px] sm:text-xs font-semibold">
                          {job.employment_type}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D1B14] group-hover:text-[#A8884A] transition-colors line-clamp-2">
                        <Link href={`/tuyen-dung/${job.slug}`} aria-label={`Thông tin tuyển dụng vị trí ${job.title} tại Maian Homes`}>{job.title}</Link>
                      </h3>
                      <p className="text-xs text-gray-500 mt-1.5 sm:mt-2 line-clamp-2 leading-relaxed">
                        {job.short_description}
                      </p>
                    </div>

                    <div className="pt-3.5 sm:pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-600">
                      <div className="flex items-center gap-1.5 text-[#2D1B14]">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-none">{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#A8884A] font-bold">
                        <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{job.salary_range || 'Thỏa thuận hấp dẫn'}</span>
                      </div>
                      {job.deadline && (
                        <div className="flex items-center gap-1.5 text-gray-400 w-full sm:w-auto">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Hạn nộp: {new Date(job.deadline).toLocaleDateString('vi-VN')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-gray-100 flex justify-end">
                    <Link
                      href={`/tuyen-dung/${job.slug}`}
                      className="w-full sm:w-auto justify-center inline-flex items-center gap-2 bg-[#FAF9F6] group-hover:bg-[#2D1B14] text-[#2D1B14] group-hover:text-[#D4AF37] px-5 py-3 sm:py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                      aria-label={`Ứng tuyển ngay vị trí ${job.title} - Maian Homes`}
                    >
                      <span>{isExpired ? 'Xem Chi Tiết Vị Trí' : 'Xem Chi Tiết & Ứng Tuyển'}</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
