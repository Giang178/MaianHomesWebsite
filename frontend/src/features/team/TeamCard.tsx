import Link from 'next/link';
import { Award, ArrowUpRight, Clock, Building2, Sparkles } from 'lucide-react';
import { TeamAvatar } from './TeamAvatar';
import type { TeamMember } from './types';

const roleLabels: Record<string, { label: string; badgeClass: string }> = {
  LEADERSHIP: {
    label: 'Lãnh đạo',
    badgeClass: 'bg-[#1A1612]/95 text-[#F3E5AB] border border-[#D4AF37]/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
  },
  SPECIALIST: {
    label: 'Chuyên gia',
    badgeClass: 'bg-[#1A1612]/90 text-amber-200 border border-amber-400/60 shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
  },
  BROKER: {
    label: 'Môi giới',
    badgeClass: 'bg-[#1A1612]/90 text-slate-200 border border-slate-400/50 shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
  },
};

export function TeamCard({
  member,
  featured = false,
  className: customClassName,
  variant = 'vertical',
}: {
  member: TeamMember;
  featured?: boolean;
  className?: string;
  variant?: 'vertical' | 'horizontal';
}) {
  const roleInfo = member.profile_type ? roleLabels[member.profile_type] : null;

  if (variant === 'horizontal') {
    const baseHorizontalStyles =
      'text-preserve group relative flex flex-row items-stretch overflow-hidden rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] hover:border-[#D4AF37]/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] transition-all duration-300 w-full tracking-normal leading-normal';
    const className = `${baseHorizontalStyles} ${customClassName || ''}`;

    const horizontalContent = (
      <>
        {/* Ảnh chân dung bên trái */}
        <div className="relative w-[110px] sm:w-[130px] shrink-0 bg-[#17130f] overflow-hidden rounded-xl m-2 sm:m-2.5">
          <TeamAvatar
            src={member.avatar_url}
            alt={member.avatar_alt_text || `Chuyên gia ${member.full_name}`}
            priority={featured}
            className="group-hover:scale-105 transition-transform duration-500 ease-out transform-gpu"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
          {Boolean(member.years_experience && member.years_experience > 0) && (
            <span className="text-preserve absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-[#1A1612]/90 text-amber-300 border border-amber-400/40 shadow-xs leading-none whitespace-nowrap">
              {member.years_experience}+ năm KN
            </span>
          )}
        </div>

        {/* Cột thông tin chi tiết bên phải */}
        <div className="text-preserve flex flex-col justify-between flex-1 min-w-0 py-2.5 pr-3 sm:py-3 sm:pr-4">
          <div>
            {/* Hàng badges */}
            <div className="text-preserve flex items-center gap-1.5 mb-1.5 flex-wrap">
              {member.is_featured ? (
                <span className="text-preserve inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#D4AF37] text-slate-950 shadow-xs whitespace-nowrap leading-none">
                  <Sparkles className="size-2.5 fill-current" />
                  <span className="text-preserve whitespace-nowrap">Nổi bật</span>
                </span>
              ) : roleInfo ? (
                <span className={`text-preserve inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap leading-none ${roleInfo.badgeClass}`}>
                  <span className="text-preserve whitespace-nowrap">{roleInfo.label}</span>
                </span>
              ) : null}

              {Boolean(member.projects && member.projects.length > 0) && (
                <span className="text-preserve inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] lg:text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap leading-none">
                  <Building2 className="size-2.5 lg:size-3 text-[#B88A29]" />
                  <span className="text-preserve whitespace-nowrap">{member.projects.length} dự án</span>
                </span>
              )}
            </div>

            {/* Tên chuyên gia */}
            <h3 className="text-preserve font-serif font-bold text-slate-900 group-hover:text-[#B88A29] transition-colors text-sm sm:text-base lg:text-lg leading-snug whitespace-nowrap truncate">
              {member.full_name}
            </h3>

            {/* Chức danh / định vị */}
            {(member.headline || member.position) && (
              <p className="text-preserve mt-1 flex items-center gap-1 text-[11px] sm:text-xs lg:text-sm text-slate-600 whitespace-nowrap truncate leading-normal">
                <Award className="size-3 lg:size-3.5 text-[#D4AF37] shrink-0" />
                <span className="text-preserve truncate">{member.headline || member.position}</span>
              </p>
            )}
          </div>

          {/* Hàng đáy: Chuyên gia Maian Homes & CTA */}
          <div className="text-preserve pt-2 mt-1 border-t border-slate-100 flex items-center justify-between">
            <span className="text-preserve text-[10px] lg:text-xs text-slate-400 font-medium">Chuyên gia Maian Homes</span>
            <span className="text-preserve inline-flex items-center gap-1 text-xs lg:text-sm font-bold text-[#B88A29] group-hover:text-[#15243b] transition-colors">
              <span className="text-preserve">Xem hồ sơ</span>
              <ArrowUpRight className="size-3.5 lg:size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </>
    );

    if (!member.allow_detail_view) {
      return (
        <article
          className={className}
          aria-label={`${member.full_name} - chỉ hiển thị thông tin tóm tắt`}
        >
          {horizontalContent}
        </article>
      );
    }

    return (
      <Link href={`/doi-ngu/${member.slug}`} className={className} aria-label={`Hồ sơ chuyên viên tư vấn bất động sản ${member.full_name}`}>
        {horizontalContent}
      </Link>
    );
  }

  // Biến thể dọc mặc định (Vertical Card)
  const baseCardStyles =
    'text-preserve group relative flex flex-col justify-end overflow-hidden rounded-2xl sm:rounded-[24px] bg-[#17130f] shadow-[0_12px_35px_rgba(30,22,13,.16)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-1.5 hover:shadow-[0_22px_50px_rgba(212,175,55,0.22)] border border-slate-200/15 hover:border-[#D4AF37]/50 w-full tracking-normal leading-normal';

  const defaultHeight = 'h-[310px] sm:h-[390px] md:h-[430px] lg:h-[470px]';
  const className = `${baseCardStyles} ${customClassName || defaultHeight}`;

  const content = (
    <>
      {/* Ảnh chân dung với hiệu ứng zoom mượt mà */}
      <TeamAvatar
        src={member.avatar_url}
        alt={member.avatar_alt_text || `Chuyên gia ${member.full_name}`}
        priority={featured}
        className="group-hover:scale-108 transition-transform duration-700 ease-out transform-gpu"
      />

      {/* Header Badges: Cấp bậc & Số năm kinh nghiệm */}
      <div className="text-preserve absolute top-2.5 left-2.5 right-2.5 sm:top-3.5 sm:left-3.5 sm:right-3.5 z-10 flex items-center justify-between gap-1.5 pointer-events-none">
        {/* Badge vai trò / nổi bật */}
        <div className="text-preserve flex items-center gap-1.5">
          {member.is_featured ? (
            <span className="text-preserve inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8.5px] sm:text-[10px] font-bold bg-[#D4AF37] text-slate-950 shadow-md whitespace-nowrap leading-none tracking-normal">
              <Sparkles className="size-2.5 sm:size-3 fill-current" />
              <span className="text-preserve whitespace-nowrap">Nổi bật</span>
            </span>
          ) : roleInfo ? (
            <span
              className={`text-preserve inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8.5px] sm:text-[10px] font-semibold leading-none tracking-normal whitespace-nowrap ${roleInfo.badgeClass}`}
            >
              <span className="text-preserve whitespace-nowrap">{roleInfo.label}</span>
            </span>
          ) : (
            <div />
          )}
        </div>

        {/* Badge số năm kinh nghiệm */}
        {Boolean(member.years_experience && member.years_experience > 0) && (
          <span className="text-preserve inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8.5px] sm:text-[11px] font-bold bg-white/95 text-slate-900 shadow-sm border border-slate-200/90 leading-none tracking-normal whitespace-nowrap">
            <Clock className="size-2.5 sm:size-3 text-[#A37B18] shrink-0" />
            <span className="text-preserve whitespace-nowrap">{member.years_experience}+ năm KN</span>
          </span>
        )}
      </div>

      {/* Lớp phủ gradient sâu lắng bảo vệ chữ */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

      {/* Khối thông tin đáy thẻ */}
      <div className="text-preserve relative z-10 px-2.5 py-2.5 sm:p-5 text-white w-full tracking-normal leading-normal">
        {/* Tên chuyên gia: font serif sang trọng, 1 dòng gọn gàng không xuống dòng */}
        <h3 className="text-preserve font-serif font-bold tracking-tight text-white group-hover:text-[#F3E5AB] transition-colors duration-300 text-[13px] sm:text-base md:text-lg lg:text-xl whitespace-nowrap truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-tight">
          {member.full_name}
        </h3>

        {/* Chức danh / định vị: 1 dòng thanh lịch, hiển thị lớn rõ ràng trên laptop */}
        {(member.headline || member.position) && (
          <p className="text-preserve mt-1 flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-xs md:text-[13px] lg:text-sm text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-tight tracking-tight whitespace-nowrap truncate">
            <Award className="size-3 sm:size-3.5 lg:size-4 shrink-0 text-[#D4AF37] hidden sm:inline-block" aria-hidden="true" />
            <span className="text-preserve truncate">{member.headline || member.position}</span>
          </p>
        )}

        {/* Hàng meta chân thẻ: Số lượng dự án + Nút tròn điều hướng */}
        <div className="text-preserve border-t border-white/10 pt-1.5 sm:pt-2 mt-1.5 sm:mt-2.5 flex items-center justify-between gap-1.5">
          {Boolean(member.projects && member.projects.length > 0) ? (
            <span className="text-preserve inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] md:text-xs lg:text-[13px] font-medium text-[#F3E5AB] leading-tight tracking-normal whitespace-nowrap">
              <Building2 className="size-2.5 sm:size-3 lg:size-3.5 shrink-0 text-[#D4AF37]" />
              <span className="text-preserve">
                {member.projects.length} dự án<span className="hidden sm:inline"> đồng hành</span>
              </span>
            </span>
          ) : (
            <span className="text-preserve text-[10px] sm:text-[11px] md:text-xs lg:text-[13px] text-white/60 font-light">
              Cố vấn tận tâm
            </span>
          )}

          <div className="size-5 sm:size-7 lg:size-8 shrink-0 rounded-full bg-white/20 sm:bg-[#1A1612]/70 backdrop-blur-md flex items-center justify-center border border-white/30 text-white group-hover:bg-[#D4AF37] group-hover:text-[#1A1612] group-hover:border-[#D4AF37] group-hover:scale-110 transition-all duration-300 shadow-sm">
            <ArrowUpRight className="size-3 sm:size-3.5 lg:size-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </>
  );

  if (!member.allow_detail_view) {
    return (
      <article
        className={className}
        aria-label={`${member.full_name} - chỉ hiển thị thông tin tóm tắt`}
      >
        {content}
      </article>
    );
  }

  return (
    <Link href={`/doi-ngu/${member.slug}`} className={className} aria-label={`Hồ sơ chuyên gia tư vấn bất động sản ${member.full_name}`}>
      {content}
    </Link>
  );
}
