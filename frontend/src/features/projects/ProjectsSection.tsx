'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAssetUrl } from '@/lib/api';
import { contentApi } from '@/features/content/api';
import { selectProjectCardImage } from './project-card-data';
import { RefreshCw, Building2, AlertCircle, Search, Tag, Coins, MapPin, ArrowUpRight } from 'lucide-react';

interface ProjectCard {
  name: string;
  slug: string;
  shortDesc: string;
  location: string;
  image: string;
  status: string;
  priceRange: string;
  isFeatured?: boolean;
}

interface DBProject {
  name: string;
  slug: string;
  logo_url?: string;
  images?: string[];
  hero_images?: string[];
  marketing_tags?: string[];
  location?: string;
  status?: string;
  price_range?: string;
  is_featured?: boolean;
}

const PREDEFINED_PRICE_RANGES = [
  "1 - 3 tỷ",
  "3 - 5 tỷ",
  "5 - 7 tỷ",
  "7 - 10 tỷ",
  "10 - 20 tỷ",
  "Trên 20 tỷ",
];

export const parsePriceToBillion = (priceStr: string) => {
  if (!priceStr) return null;
  const str = priceStr.toLowerCase().replace(/,/g, '.');
  if (/\/\s*m(?:2|²)|m(?:2|²)\b/.test(str) || str.includes('triệu/m')) return null;
  const matches = str.match(/\d+(\.\d+)?/g);
  if (!matches) return null;
  
  const numbers = matches.map(Number);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  
  if (str.includes('dưới') || str.includes('<')) return { min: 0, max: min };
  if (str.includes('trên') || str.includes('hơn') || str.includes('>')) return { min: max, max: Infinity };
  
  return { min, max };
};

export const checkPriceMatch = (projectPriceStr: string, filterValue: string) => {
  if (filterValue === 'ALL') return true;
  if (!projectPriceStr) return false;
  if (filterValue === 'Thỏa thuận') {
    const isAgreement = projectPriceStr.toLowerCase().includes('thỏa thuận') || projectPriceStr.toLowerCase().includes('liên hệ');
    return isAgreement;
  }
  
  const projectPrice = parsePriceToBillion(projectPriceStr);
  const filterPrice = parsePriceToBillion(filterValue);
  
  if (!projectPrice || !filterPrice) return projectPriceStr === filterValue;
  
  return projectPrice.min <= filterPrice.max && projectPrice.max >= filterPrice.min;
};

interface ProjectsSectionProps {
  initialProjects: ProjectCard[];
  initialError?: boolean;
  hideFilters?: boolean;
  limit?: number;
}

export default function ProjectsSection({ initialProjects, initialError = false, hideFilters = false, limit }: ProjectsSectionProps) {
  const [projects, setProjects] = useState<ProjectCard[]>(initialProjects);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(initialError);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priceFilter, setPriceFilter] = useState('ALL');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const resData = await contentApi.listProjectsPublic() as { data?: DBProject[] };
      const dbProjects: DBProject[] = resData.data || [];
      
      const normalized: ProjectCard[] = dbProjects.map((p) => {
        const imgPath = selectProjectCardImage(p);
        return {
          name: p.name,
          slug: p.slug,
          shortDesc: p.marketing_tags?.[0] || 'Căn hộ cao cấp',
          location: p.location || '',
          image: getAssetUrl(imgPath) || '/images/default-project.jpg',
          status: p.status || 'AVAILABLE',
          priceRange: p.price_range || '',
          isFeatured: Boolean(p.is_featured),
        };
      });

      const combined: ProjectCard[] = [];
      for (const p of normalized) {
        if (!combined.some(c => c.slug === p.slug)) {
          combined.push(p);
        }
      }
      setProjects(combined);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialError || initialProjects.length === 0) {
      void fetchProjects();
    }
  }, [fetchProjects, initialError, initialProjects.length]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => {
      // Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(searchLower) || 
                            p.shortDesc.toLowerCase().includes(searchLower) ||
                            p.location.toLowerCase().includes(searchLower);
      
      // Status
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      
      // Price
      const matchesPrice = checkPriceMatch(p.priceRange, priceFilter);

      return matchesSearch && matchesStatus && matchesPrice;
    });

    // Ưu tiên hiển thị dự án nổi bật lên trước
    result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    
    return result;
  }, [projects, searchQuery, statusFilter, priceFilter, limit]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <RefreshCw className="w-10 h-10 text-[#D4AF37] animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Đang cập nhật danh sách dự án...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-public-data-status="unavailable"
        className="max-w-2xl mx-auto py-16 px-6 bg-white rounded-3xl border border-red-100 shadow-lg text-center animate-in fade-in duration-500"
      >
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Không Thể Tải Danh Sách Dự Án</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto text-sm leading-relaxed">
          Đã có lỗi kết nối đến máy chủ khi tải bộ sưu tập bất động sản. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.
        </p>
        <button
          onClick={fetchProjects}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] px-8 py-3.5 rounded-full font-bold hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] transition-all transform active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Thử tải lại
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 bg-white rounded-3xl border border-[#E5E2D9] shadow-md text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-[#FAF8F2] text-[#D4AF37] flex items-center justify-center mx-auto mb-6 border border-[#D4AF37]/20">
          <Building2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-3">Chưa Có Dự Án Nào Được Công Bố</h2>
        <p className="text-slate-600 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
          Các dự án mới nhất của Maian Homes đang trong quá trình chuẩn bị công bố chính thức. Quý khách vui lòng quay lại sau hoặc để lại thông tin liên hệ để nhận thông báo sớm nhất.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={fetchProjects}
            className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37] px-8 py-3.5 font-bold text-[#8A6A2F] transition-all hover:bg-[#FAF8F2]"
          >
            <RefreshCw className="h-4 w-4" />
            Cập nhật danh sách
          </button>
          <Link
            href="/lien-he"
            className="inline-block bg-[#1A1612] text-[#F3E6C6] px-8 py-3.5 rounded-full font-bold hover:bg-[#D4AF37] hover:text-[#1A1612] transition-all shadow-md"
          >
            Đăng ký nhận thông tin dự án
          </Link>
        </div>
      </div>
    );
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
      badgeClass: 'bg-[#1A1612]/95 text-emerald-300 border border-emerald-400/80 shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
    };
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="sr-only">Danh sách dự án bất động sản tuyển chọn</h2>
      {/* Filters & Search Bar */}
      {!hideFilters && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search */}
          <div className="relative w-full lg:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm dự án, khu vực..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Status Filter */}
            <div className="relative w-full sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Tag className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] appearance-none cursor-pointer outline-none transition-all"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="AVAILABLE">Đang mở bán</option>
                <option value="PRE_SALE">Sắp mở bán</option>
                <option value="HANDING_OVER">Đang bàn giao</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Price Filter */}
            <div className="relative w-full sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] appearance-none cursor-pointer outline-none transition-all"
              >
                <option value="ALL">Tất cả khoảng giá</option>
                {PREDEFINED_PRICE_RANGES.map(price => (
                  <option key={price} value={price}>{price}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredProjects.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-500">Không tìm thấy dự án nào phù hợp với bộ lọc của bạn.</p>
          <button 
            onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setPriceFilter('ALL'); }}
            className="mt-4 text-[#D4AF37] font-semibold hover:underline cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className={`grid w-full grid-cols-1 gap-4 sm:gap-6 lg:gap-8 mx-auto justify-items-center ${
          filteredProjects.length === 1
            ? 'max-w-[380px]'
            : filteredProjects.length === 2
              ? 'md:grid-cols-2 max-w-4xl'
              : 'md:grid-cols-2 lg:grid-cols-3 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'
        }`}>
          {filteredProjects.map((project, index) => {
            const statusInfo = getStatusInfo(project.status);

            return (
              <Link
                key={project.slug}
                href={`/du_an/${project.slug}`}
                className="group cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-2xl sm:rounded-[1.75rem] lg:rounded-[2rem] w-[82vw] max-w-[320px] sm:w-full sm:max-w-[380px] shrink-0"
                aria-label={`Xem thông tin chi tiết dự án ${project.name}${project.location ? ` tại ${project.location}` : ' - Maian Homes'}`}
              >
                {/* Khung hình chữ nhật dọc 3:4 chuẩn mực giống trang chủ */}
                <div className="relative aspect-[3/4] rounded-2xl sm:rounded-[1.75rem] lg:rounded-[2rem] overflow-hidden bg-slate-900 shadow-[0_10px_30px_rgba(26,22,18,0.08)] group-hover:shadow-[0_18px_45px_rgba(212,175,55,0.22)] border border-slate-200/60 group-hover:border-[#D4AF37]/60 transition-all duration-700">
                  {/* Ảnh dự án */}
                  <Image
                    src={project.image}
                    alt={project.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 800px"
                    priority={index < 3}
                    className="object-cover group-hover:scale-108 transition-transform duration-1000 ease-out transform-gpu [backface-visibility:hidden]"
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

                    {/* Badge Trạng thái & Nổi bật */}
                    <div className="text-preserve pointer-events-auto flex items-center gap-1.5">
                      {project.isFeatured && (
                        <span
                          className="text-preserve inline-flex items-center justify-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] lg:text-xs font-bold leading-none bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white shadow-md border border-amber-300/40"
                          title="Dự án nổi bật"
                        >
                          <span>★</span>
                          <span className="text-preserve whitespace-nowrap">Nổi bật</span>
                        </span>
                      )}
                      {statusInfo && (
                        <span
                          className={`text-preserve inline-flex items-center justify-center gap-1.5 w-[96px] h-[24px] sm:w-auto sm:h-auto px-2 sm:px-3.5 sm:py-1.5 lg:px-4 rounded-full text-[9px] sm:text-[11px] lg:text-xs font-bold leading-none tracking-normal ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                          <span className="text-preserve whitespace-nowrap">{statusInfo.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thông tin đáy thẻ: Tên dự án, vị trí và nút điều hướng lồng trong gradient bóng đêm */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 lg:p-6 text-white flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-16">
                    <div className="flex items-end justify-between gap-2.5 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <h3
                          title={project.name}
                          className="font-serif font-bold text-sm sm:text-base lg:text-[1.0625rem] tracking-normal leading-snug text-white group-hover:text-[#F3E5AB] transition-colors duration-300 line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] min-h-[2.6em]"
                        >
                          {project.name}
                        </h3>
                        <p
                          title={(project.location || '').split(',').slice(-2).join(',') || project.location || 'TP. Hồ Chí Minh'}
                          className="text-white/95 font-medium text-[11px] sm:text-xs lg:text-sm mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
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
      )}
    </div>
  );
}
