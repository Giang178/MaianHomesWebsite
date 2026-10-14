'use client';

import Image from 'next/image';
import { CheckCircle2, Users2 } from 'lucide-react';

interface CoworkingIntroProps {
  space?: any;
  title?: string;
  shortDesc?: string;
  fullDesc?: string;
  targetAudience?: string[];
  highlights?: string[];
  imageUrl?: string;
}

export default function CoworkingIntro(props: CoworkingIntroProps) {
  const {
    space,
    title: providedTitle,
    shortDesc: providedShortDesc,
    fullDesc: providedFullDesc,
    imageUrl: providedImageUrl,
  } = props;
  const title = providedTitle ?? space?.intro_title ?? space?.introduction?.title;
  const shortDesc = providedShortDesc ?? space?.intro_short_desc ?? space?.introduction?.short_desc ?? space?.tagline;
  const fullDesc = providedFullDesc ?? space?.intro_full_desc ?? space?.introduction?.full_desc;
  const imageUrl = providedImageUrl ?? space?.intro_image ?? space?.introduction?.image_url ?? space?.hero_image ?? '/images/coworking/intro.jpg';
  const highlights = props.highlights ?? space?.intro_highlights ?? space?.introduction?.highlights ?? [];
  const targetAudience = props.targetAudience ?? space?.intro_target_audience ?? space?.introduction?.target_audience ?? [];
  const displayImage = imageUrl;

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white text-[#2D1B14]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Cột trái: Nội dung giới thiệu */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm lg:text-base uppercase font-bold tracking-[0.15em] text-[#AA820A]">
              <span className="w-8 lg:w-10 h-[2px] bg-[#AA820A]"></span>
              <span>Giới thiệu không gian</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#2D1B14] tracking-[-0.015em] leading-[1.25]">
              {title}
            </h2>

            <p className="text-base sm:text-lg text-[#AA820A] font-medium leading-[1.6]">
              {shortDesc}
            </p>

            <p className="text-sm sm:text-base text-zinc-600 font-light leading-[1.7] tracking-[0.01em]">
              {fullDesc}
            </p>

            {/* Điểm nổi bật (Highlights) */}
            {highlights.length > 0 && (
              <div className="pt-2 space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                  Đặc quyền & Điểm nhấn:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[#AA820A] shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-700 font-normal leading-[1.5]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Đối tượng khách hàng phù hợp */}
            {targetAudience.length > 0 && (
              <div className="pt-4 border-t border-[#E8E0D8] space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#AA820A] font-semibold">
                  <Users2 className="w-4 h-4" />
                  <span>Đối tượng khách hàng lý tưởng:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targetAudience.map((audience, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FAF6EE] text-[#2D1B14] border border-[#E8E0D8]"
                    >
                      {audience}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: Hình ảnh thực tế (hiển thị đơn giản, rõ nét, không thẻ nổi) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E0D8] shadow-lg hover:shadow-xl transition-all duration-500 group aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] bg-zinc-100">
              <Image
                src={displayImage}
                alt={space?.introduction?.alt_text || space?.intro_alt_text || title || ''}
                fill
                priority
                quality={90}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, (max-width: 1440px) 50vw, 750px"
                className="object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
