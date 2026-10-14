'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Ruler,
  Wind,
  ArrowUpDown,
  ShieldCheck,
  Users,
  Check,
  DollarSign,
} from 'lucide-react';
import { GradeSpotlight } from '../types';
import { GRADE_CONFIGS, OfficeGradeType } from './OfficeGradeView';

interface OfficeGradeSpotlightProps {
  title?: string;
  subtitle?: string;
  grades?: GradeSpotlight[];
}

export default function OfficeGradeSpotlight({
  title,
  subtitle,
  grades,
}: OfficeGradeSpotlightProps = {}) {
  const defaultFallbackGrades: GradeSpotlight[] = (['A', 'B', 'C'] as OfficeGradeType[]).map((g) => {
    const c = GRADE_CONFIGS[g];
    return {
      id: `grade-${g.toLowerCase()}`,
      grade: g,
      name: c.name,
      subtitle: c.tagline,
      badge: c.badge,
      priceRange: c.priceDisplay,
      price_range: c.priceDisplay,
      description: c.description,
      imageUrl: c.heroImage,
      image_url: c.heroImage,
      alt_text: c.hero_alt_text || c.name,
      target_audience: c.targetAudience,
      specs: c.specs,
      criteriaList: c.criteriaList,
      highlights: c.criteriaList.map((item) => item.title),
    };
  });

  const activeGrades = grades && grades.length > 0 ? grades : defaultFallbackGrades;
  if (activeGrades.length === 0) return null;
  const gradeThemes: Record<
    string,
    { badgeBg: string; badgeBorder: string; badgeText: string; accentColor: string; priceBg: string }
  > = {
    A: {
      badgeBg: 'bg-amber-100',
      badgeBorder: 'border-amber-300',
      badgeText: 'text-amber-900',
      accentColor: 'text-amber-700',
      priceBg: 'bg-amber-900/90 text-amber-200 border-amber-700/50',
    },
    B: {
      badgeBg: 'bg-blue-100',
      badgeBorder: 'border-blue-300',
      badgeText: 'text-blue-900',
      accentColor: 'text-blue-700',
      priceBg: 'bg-blue-950/90 text-blue-200 border-blue-800/50',
    },
    C: {
      badgeBg: 'bg-emerald-100',
      badgeBorder: 'border-emerald-300',
      badgeText: 'text-emerald-900',
      accentColor: 'text-emerald-700',
      priceBg: 'bg-emerald-950/90 text-emerald-200 border-emerald-800/50',
    },
  };

  return (
    <section className="py-10 sm:py-14 bg-zinc-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">

          {title ? (
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-zinc-900 tracking-tight">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="text-xs sm:text-sm text-zinc-600 font-light leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* 3 Detailed Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {activeGrades.map((gradeItem) => {
            const gCode = (gradeItem.grade || '').toUpperCase() as OfficeGradeType;
            const theme = gradeThemes[gCode] || gradeThemes.A;
            const defaultConfig = GRADE_CONFIGS[gCode] || GRADE_CONFIGS.A;
            const detailHref = `/dich-vu-cho-thue/office/${defaultConfig.slug || `hang-${(gCode || 'a').toLowerCase()}`}`;
            const price = gradeItem.priceRange || gradeItem.price_range || defaultConfig.priceDisplay;
            const effectiveSpecs = gradeItem.specs && gradeItem.specs.length > 0 ? gradeItem.specs : defaultConfig.specs;

            return (
              <div
                key={gradeItem.id || gCode}
                className="bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
              >
                {/* 1. Header Image with Badges */}
                <div className="relative h-56 sm:h-60 lg:h-64 w-full overflow-hidden bg-zinc-900">
                  {gradeItem.imageUrl || gradeItem.image_url ? (
                    <Image
                      src={gradeItem.imageUrl || gradeItem.image_url || ''}
                      alt={gradeItem.alt_text || gradeItem.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-90"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                    >
                      Hạng {gCode}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-sm">
                      {gradeItem.badge}
                    </span>
                  </div>

                  {/* Bottom Price Pill on Image */}
                  {price && (
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs lg:text-sm font-bold backdrop-blur-md border shadow-sm ${theme.priceBg}`}
                      >
                        <DollarSign className="w-4 h-4 shrink-0" />
                        <span>Khoảng giá thuê: {price}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Main Content Body */}
                <div className="p-6 lg:p-7 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Title & Subtitle */}
                    <div>
                      <h3 className="text-xl lg:text-2xl font-serif font-bold text-zinc-900 group-hover:text-[#b84518] transition-colors tracking-tight">
                        {gradeItem.name}
                      </h3>
                      {gradeItem.subtitle && (
                        <p className="text-xs lg:text-[13.5px] text-zinc-500 font-medium mt-1 leading-snug">
                          {gradeItem.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {gradeItem.description && (
                      <p className="text-xs lg:text-sm text-zinc-600 font-normal leading-relaxed">
                        {gradeItem.description}
                      </p>
                    )}

                    {/* Target Audience */}
                    {gradeItem.target_audience && (
                      <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-sm sm:text-[15px] font-bold text-zinc-700">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#b84518] shrink-0" />
                          <span>Đối tượng doanh nghiệp phù hợp:</span>
                        </div>
                        <p className="text-[13.5px] sm:text-sm lg:text-[15px] text-zinc-700 font-normal pl-6 sm:pl-7 leading-relaxed">
                          {gradeItem.target_audience}
                        </p>
                      </div>
                    )}

                    {/* 3. Bộ 4 Thông Số Kỹ Thuật Tiêu Chuẩn (Specs Grid) */}
                    <div className="space-y-3 pt-2">
                      <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500">
                        Bộ 4 Thông Số Kỹ Thuật Tiêu Chuẩn (Hạng {gCode})
                      </div>

                      {effectiveSpecs && effectiveSpecs.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 bg-zinc-50/90 p-3.5 sm:p-4 rounded-xl border border-zinc-200">
                          {effectiveSpecs.map((sp, spIdx) => (
                            <div key={spIdx} className="p-3 sm:p-3.5 rounded-lg bg-white border border-zinc-100 shadow-sm flex flex-col justify-center">
                              <span className="text-xs sm:text-[13px] font-medium text-zinc-500 block leading-tight mb-1">
                                {sp.label}
                              </span>
                              <strong className="text-[13.5px] sm:text-[15px] lg:text-base font-bold text-zinc-900 block leading-tight mb-0.5">
                                {sp.value}
                              </strong>
                              {sp.desc && (
                                <span className="text-[11px] sm:text-xs text-zinc-400 block leading-snug line-clamp-2">
                                  {sp.desc}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5 text-xs lg:text-[13.5px] bg-zinc-50/80 p-4 rounded-xl border border-zinc-200">
                          {gradeItem.ceiling_height && (
                            <div className="flex items-start gap-2">
                              <Ruler className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                              <div className="flex-1 leading-snug">
                                <span className="text-zinc-500">Chiều cao trần hoàn thiện: </span>
                                <strong className="text-zinc-900 font-semibold lg:font-bold">
                                  {gradeItem.ceiling_height}
                                </strong>
                              </div>
                            </div>
                          )}

                          {gradeItem.air_conditioning && (
                            <div className="flex items-start gap-2">
                              <Wind className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                              <div className="flex-1 leading-snug">
                                <span className="text-zinc-500">Hệ thống điều hòa: </span>
                                <strong className="text-zinc-900 font-semibold lg:font-bold">
                                  {gradeItem.air_conditioning}
                                </strong>
                              </div>
                            </div>
                          )}

                          {gradeItem.elevators && (
                            <div className="flex items-start gap-2">
                              <ArrowUpDown className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                              <div className="flex-1 leading-snug">
                                <span className="text-zinc-500">Hệ thống thang máy: </span>
                                <strong className="text-zinc-900 font-semibold lg:font-bold">
                                  {gradeItem.elevators}
                                </strong>
                              </div>
                            </div>
                          )}

                          {gradeItem.management_company && (
                            <div className="flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                              <div className="flex-1 leading-snug">
                                <span className="text-zinc-500">Đơn vị quản lý vận hành: </span>
                                <strong className="text-zinc-900 font-semibold lg:font-bold">
                                  {gradeItem.management_company}
                                </strong>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>



                    {/* Highlights Checklist */}
                    {gradeItem.highlights && gradeItem.highlights.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500">
                          Đặc Điểm Nổi Bật
                        </div>
                        <div className="space-y-2">
                          {gradeItem.highlights.slice(0, 4).map((hl, hIdx) => (
                            <div key={hIdx} className="flex items-start gap-2.5 text-[13px] sm:text-sm lg:text-[15px] text-zinc-700">
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="font-medium leading-snug">{hl}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Action Link to Grade Detail Page */}
                  <div className="pt-5 border-t border-zinc-100 mt-4">
                    <Link
                      href={detailHref}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-[#b84518] text-white text-xs lg:text-sm font-bold transition-all shadow-sm group-hover:shadow"
                    >
                      <span>Khám phá danh mục Hạng {gCode}</span>
                      <span className="sr-only">tòa nhà văn phòng cho thuê Hạng {gCode}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
