'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  MapPin, 
  ArrowRight, 
  ArrowUpRight, 
  Coins, 
  AlertCircle,
  PhoneCall
} from 'lucide-react';

export interface FeaturedProjectItem {
  id?: string;
  name: string;
  slug: string;
  shortDesc?: string;
  location?: string;
  image: string;
  status?: string;
  priceRange?: string;
  isFeatured?: boolean;
}

interface FeaturedProjectsSectionProps {
  projects: FeaturedProjectItem[];
  error?: boolean;
}

const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  AVAILABLE: {
    label: 'Đang mở bán',
    dotClass: 'bg-emerald-400 animate-pulse',
    badgeClass: 'bg-[#1A1612]/95 text-emerald-300 border border-emerald-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
  COMING_SOON: {
    label: 'Sắp ra mắt',
    dotClass: 'bg-blue-400 animate-pulse',
    badgeClass: 'bg-[#1A1612]/95 text-blue-300 border border-blue-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
  PRE_SALE: {
    label: 'Sắp mở bán',
    dotClass: 'bg-indigo-400 animate-pulse',
    badgeClass: 'bg-[#1A1612]/95 text-indigo-300 border border-indigo-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
  HANDING_OVER: {
    label: 'Đang bàn giao',
    dotClass: 'bg-amber-400 animate-pulse',
    badgeClass: 'bg-[#1A1612]/95 text-amber-300 border border-amber-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
  RESERVED: {
    label: 'Đã giữ chỗ',
    dotClass: 'bg-orange-400',
    badgeClass: 'bg-[#1A1612]/95 text-orange-300 border border-orange-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
  SOLD: {
    label: 'Đã bán',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-[#1A1612]/95 text-slate-300 border border-slate-500/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
  },
};

const getStatusInfo = (status?: string) => {
  if (!status) return null;
  const upper = status.toUpperCase();
  if (statusConfig[upper]) return statusConfig[upper];
  return {
    label: status,
    dotClass: 'bg-emerald-400',
    badgeClass: 'bg-black/70 text-emerald-300 border-emerald-500/35',
  };
};

export default function FeaturedProjectsSection({ projects, error = false }: FeaturedProjectsSectionProps) {
  // Chỉ hiển thị tối đa 3 dự án nổi bật
  const featuredList = projects.slice(0, 3);

  if (error) {
    return (
      <div
        data-public-data-status="unavailable"
        className="max-w-2xl mx-auto py-12 sm:py-16 px-6 bg-white rounded-3xl border border-red-100 shadow-xl text-center"
      >
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-serif font-bold text-slate-900 mb-2">Không Thể Tải Danh Sách Dự Án</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto text-xs sm:text-sm leading-relaxed font-light">
          Hệ thống đang kết nối dữ liệu dự án thời gian thực. Quý khách vui lòng thử tải lại trang hoặc liên hệ trực tiếp với chuyên viên Maian Homes.
        </p>
        <a
          href="#tu-van"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] px-6 sm:px-7 py-2.5 sm:py-3 rounded-full font-bold shadow-lg hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] transition-all transform active:scale-95 text-xs sm:text-sm"
        >
          <PhoneCall className="w-4 h-4" /> Liên hệ tư vấn ngay
        </a>
      </div>
    );
  }

  if (featuredList.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 sm:py-16 px-6 bg-white rounded-3xl border border-[#EAE6DF] shadow-md text-center">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FAF9F5] text-[#D4AF37] flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/30">
          <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-serif font-bold text-slate-900 mb-2">Chưa Có Dự Án Nổi Bật</h3>
        <p className="text-slate-600 mb-6 text-xs sm:text-sm max-w-md mx-auto font-light">
          Các dự án tâm điểm đang được cập nhật. Quý khách vui lòng xem toàn bộ danh mục hoặc để lại thông tin để nhận thông báo sớm nhất.
        </p>
        <Link
          href="/du_an"
          className="inline-flex items-center gap-2 bg-[#1A1612] text-[#F3E6C6] px-5 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors shadow-sm text-xs sm:text-sm"
          aria-label="Xem tất cả danh mục dự án bất động sản Maian Homes tại TP.HCM"
        >
          Xem tất cả dự án
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Hiển thị các dự án nổi bật: Vuốt ngang trên Mobile, Lưới cân đối trên Tablet & Desktop */}
      <div
        className={`flex sm:grid gap-4 sm:gap-6 lg:gap-8 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-4 sm:pb-0 -mx-4 px-4 sm:mx-auto sm:px-0 no-scrollbar items-stretch justify-start sm:justify-center ${
          featuredList.length === 1
            ? 'sm:grid-cols-1 max-w-[330px] sm:max-w-[350px] md:max-w-[360px] lg:max-w-[365px] xl:max-w-[380px]'
            : featuredList.length === 2
            ? 'sm:grid-cols-1 md:grid-cols-2 max-w-[660px] md:max-w-2xl lg:max-w-3xl xl:max-w-4xl justify-items-center'
            : 'sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl justify-items-center'
        }`}
      >
        {featuredList.map((project) => {
          const statusInfo = getStatusInfo(project.status);

          return (
            <Link
              key={project.slug}
              href={`/du_an/${project.slug}`}
              className="group cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-2xl sm:rounded-[1.75rem] lg:rounded-[2rem] w-[82vw] max-w-[320px] sm:w-full sm:max-w-[380px] shrink-0 sm:shrink snap-center"
              aria-label={`Khám phá chi tiết dự án bất động sản ${project.name} tại TP.HCM`}
            >
              {/* Khung hình chữ nhật dọc 3:4 chuẩn mực */}
              <div className="relative aspect-[3/4] rounded-2xl sm:rounded-[1.75rem] lg:rounded-[2rem] overflow-hidden bg-slate-900 shadow-[0_10px_30px_rgba(26,22,18,0.08)] sm:group-hover:shadow-[0_18px_45px_rgba(212,175,55,0.22)] border border-slate-200/60 sm:group-hover:border-[#D4AF37]/60 transition-all duration-700">
                {/* Ảnh dự án */}
                <Image
                  src={project.image}
                  alt={project.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 800px"
                  priority={true}
                  className="object-cover sm:group-hover:scale-108 transition-transform duration-1000 ease-out transform-gpu [backface-visibility:hidden]"
                />

                {/* Header Badges: Khoảng giá (trái) & Trạng thái dự án (phải) - Kích thước 2 tag bằng nhau tuyệt đối trên mobile */}
                <div className="text-preserve absolute top-3.5 left-3.5 right-3.5 sm:top-4 sm:left-4 sm:right-4 lg:top-4.5 lg:left-4.5 lg:right-4.5 z-10 flex items-center justify-between gap-2 pointer-events-none">
                  {/* Badge Giá (nếu có) */}
                  {project.priceRange ? (
                    <div className="text-preserve pointer-events-auto">
                      <span
                        title={project.priceRange}
                        className="text-preserve inline-flex items-center justify-center gap-1.5 w-[96px] h-[24px] sm:w-auto sm:h-auto px-2 sm:px-3.5 sm:py-1.5 lg:px-4 rounded-full text-[9px] sm:text-[11px] lg:text-xs font-bold bg-white text-slate-900 shadow-md border border-slate-200/90 leading-none tracking-normal"
                      >
                        <Coins className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#A37B18] shrink-0" />
                        <span className="text-preserve whitespace-nowrap">{project.priceRange}</span>
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Badge Trạng thái dự án */}
                  {statusInfo && (
                    <div className="text-preserve pointer-events-auto">
                      <span
                        className={`text-preserve inline-flex items-center justify-center gap-1.5 w-[96px] h-[24px] sm:w-auto sm:h-auto px-2 sm:px-3.5 sm:py-1.5 lg:px-4 rounded-full text-[9px] sm:text-[11px] lg:text-xs font-bold leading-none tracking-normal ${statusInfo.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                        <span className="text-preserve whitespace-nowrap">{statusInfo.label}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Thông tin đáy thẻ: Tên dự án, vị trí và nút điều hướng lồng trong gradient bóng đêm */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 lg:p-6 text-white flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-16">
                  <div className="flex items-end justify-between gap-2.5 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        title={project.name}
                        className="font-serif font-bold text-sm sm:text-base lg:text-[1.0625rem] tracking-normal leading-snug text-white group-hover:text-[#F3E5AB] transition-colors duration-300 line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] min-h-[2.6em] text-balance"
                      >
                        {project.name}
                      </h3>
                      <p
                        title={(project.location || '').split(',').slice(-2).join(',') || project.location || 'TP. Hồ Chí Minh'}
                        className="text-white/95 font-medium text-[11px] sm:text-xs lg:text-xs min-[1368px]:text-sm mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                      >
                        <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D4AF37] shrink-0" />
                        <span>
                          {(project.location || '').split(',').slice(-2).join(',') || project.location || 'TP. Hồ Chí Minh'}
                        </span>
                      </p>
                    </div>

                    {/* Nút tròn mũi tên sang trọng */}
                    <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 lg:w-9 lg:h-9 shrink-0 rounded-full bg-[#1A1612]/70 backdrop-blur-md flex items-center justify-center border border-white/30 text-white group-hover:bg-[#D4AF37] group-hover:text-[#1A1612] group-hover:border-[#D4AF37] transform translate-y-0.5 sm:translate-y-0 group-hover:scale-105 transition-all duration-300 shadow-lg">
                      <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Gợi ý vuốt trên Mobile */}
      {featuredList.length > 1 && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 -mt-2 mb-1 text-slate-400 text-xs font-light tracking-wide">
          <span>Vuốt ngang để xem thêm</span>
          <ArrowRight className="w-3.5 h-3.5 animate-pulse text-[#D4AF37]" />
        </div>
      )}

      {/* Nút chuyển hướng: Xem tất cả dự án */}
      <div className="pt-2 sm:pt-4 flex justify-center">
        <Link
          href="/du_an"
          className="group inline-flex items-center gap-2 px-4.5 sm:px-5.5 py-2 sm:py-2.5 rounded-full bg-white hover:bg-[#1A1612] text-slate-900 hover:text-[#F3E5AB] border border-[#D4AF37]/50 hover:border-[#1A1612] shadow-sm hover:shadow-md transition-all duration-300 font-medium text-xs sm:text-sm tracking-normal sm:tracking-wide"
        >
          <span>Khám Phá Tất Cả Dự Án</span>
          <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#FAF9F5] group-hover:bg-[#D4AF37] text-slate-900 flex items-center justify-center transition-colors duration-300">
            <ArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
