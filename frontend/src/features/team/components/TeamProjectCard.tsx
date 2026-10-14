'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Coins, MapPin } from 'lucide-react';
import { getAssetUrl } from '@/lib/api';
import type { TeamProject } from '@/features/team/types';

interface TeamProjectCardProps {
  project: TeamProject;
  priority?: boolean;
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

export function TeamProjectCard({ project, priority = false }: TeamProjectCardProps) {
  const statusInfo = getStatusInfo(project.status);
  // Ưu tiên ảnh bìa dự án hợp lệ có độ phân giải cao nhất
  const rawCandidates = [
    project.logo_url,
    ...(Array.isArray(project.images) ? project.images : []),
    project.image,
    ...(Array.isArray(project.hero_images) ? project.hero_images : []),
  ];
  const validPath = rawCandidates.find(
    (url): url is string => typeof url === 'string' && url.trim().length > 0
  );
  const imageUrl = getAssetUrl(validPath) || '/images/banner_sec.png';

  return (
    <Link
      href={`/du_an/${project.slug}`}
      className="group cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-2xl sm:rounded-[1.75rem] w-[80vw] max-w-[300px] sm:w-auto shrink-0 sm:shrink snap-start"
      aria-label={`Dự án phụ trách: ${project.name} - Maian Homes`}
    >
      {/* Khung hình chữ nhật dọc 3:4 chuẩn mực giống trang dự án */}
      <div className="relative aspect-[3/4] rounded-2xl sm:rounded-[1.75rem] overflow-hidden bg-slate-900 shadow-[0_10px_30px_rgba(26,22,18,0.08)] group-hover:shadow-[0_18px_45px_rgba(212,175,55,0.22)] border border-slate-200/60 group-hover:border-[#D4AF37]/60 transition-all duration-700">
        {/* Ảnh bìa dự án phủ trọn vẹn card - Sắc nét chuẩn HD trên Mobile, Tablet, Laptop và PC */}
        <Image
          src={imageUrl}
          alt={project.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 800px"
          quality={90}
          priority={priority}
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out [backface-visibility:hidden] [image-rendering:-webkit-optimize-contrast]"
        />

        {/* Header Badges: Khoảng giá (trái) & Trạng thái dự án (phải) */}
        <div className="text-preserve absolute top-3.5 left-3.5 right-3.5 sm:top-4 sm:left-4 sm:right-4 z-10 flex items-center justify-between gap-2 pointer-events-none">
          {/* Badge Giá (nếu có) */}
          {project.price_range ? (
            <div className="text-preserve pointer-events-auto">
              <span
                title={project.price_range}
                className="text-preserve inline-flex items-center justify-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-white text-slate-900 shadow-md border border-slate-200/90 leading-none tracking-normal"
              >
                <Coins className="size-3 text-[#A37B18] shrink-0" />
                <span className="text-preserve whitespace-nowrap">{project.price_range}</span>
              </span>
            </div>
          ) : (
            <div />
          )}

          {/* Badge Trạng thái dự án */}
          {statusInfo && (
            <div className="text-preserve pointer-events-auto">
              <span
                className={`text-preserve inline-flex items-center justify-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold leading-none tracking-normal ${statusInfo.badgeClass}`}
              >
                <span className={`size-1.5 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                <span className="text-preserve whitespace-nowrap">{statusInfo.label}</span>
              </span>
            </div>
          )}
        </div>

        {/* Thông tin đáy thẻ: Tên dự án, vị trí và nút điều hướng lồng trong gradient bóng đêm */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-16">
          <div className="flex items-end justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <h3
                title={project.name}
                className="font-serif font-bold text-sm sm:text-base tracking-normal leading-snug text-white group-hover:text-[#F3E5AB] transition-colors duration-300 line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] min-h-[2.6em]"
              >
                {project.name}
              </h3>
              <p
                title={(project.location || '').split(',').slice(-2).join(',') || project.location || 'TP. Hồ Chí Minh'}
                className="text-white/95 font-medium text-xs mt-1 sm:mt-1.5 flex items-center gap-1.5 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              >
                <MapPin className="size-3.5 text-[#D4AF37] shrink-0" />
                <span>
                  {(project.location || '').split(',').slice(-2).join(',') || project.location || 'TP. Hồ Chí Minh'}
                </span>
              </p>
            </div>

            {/* Nút tròn mũi tên sang trọng */}
            <div className="size-8 sm:size-9 shrink-0 rounded-full bg-[#1A1612]/70 backdrop-blur-md flex items-center justify-center border border-white/30 text-white group-hover:bg-[#D4AF37] group-hover:text-[#1A1612] group-hover:border-[#D4AF37] transform translate-y-0.5 sm:translate-y-0 group-hover:scale-105 transition-all duration-300 shadow-lg">
              <ArrowUpRight className="size-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
