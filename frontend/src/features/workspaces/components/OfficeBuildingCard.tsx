'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Building2, Ruler } from 'lucide-react';
import { OfficeBuilding } from '../types';

interface OfficeBuildingCardProps {
  building: OfficeBuilding;
}

export default function OfficeBuildingCard({ building }: OfficeBuildingCardProps) {
  const images = building.images || [];
  const primaryImageObj =
    images.find((img) => typeof img === 'object' && img.is_primary) ||
    (typeof images[0] === 'object' ? images[0] : null);
  const primaryImage =
    primaryImageObj?.url ||
    (typeof images[0] === 'string' ? images[0] : images[0]?.url) ||
    '';
  const primaryAlt = primaryImageObj?.alt_text || building.name;

  const positiveNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

  const minArea = positiveNumber(building.min_area) ? building.min_area : null;
  const maxArea = positiveNumber(building.max_area) ? building.max_area : null;
  const areaText =
    minArea == null
      ? 'Chưa cập nhật'
      : maxArea == null || minArea === maxArea
      ? `${minArea} m²`
      : `${minArea} - ${maxArea} m²`;

  const minPrice = positiveNumber(building.price_per_sqm_min)
    ? building.price_per_sqm_min
    : positiveNumber(building.min_price)
    ? building.min_price
    : null;
  const maxPrice = positiveNumber(building.price_per_sqm_max)
    ? building.price_per_sqm_max
    : null;
  const priceDisplay =
    minPrice == null
      ? 'Liên hệ'
      : maxPrice == null || minPrice === maxPrice
      ? `$${minPrice}`
      : `$${minPrice}–${maxPrice}`;

  const gradeKey = String(building.building_grade || building.grade || '').trim().toUpperCase();
  const gradeLabel = gradeKey ? `Hạng ${gradeKey}` : 'Chưa cập nhật';
  const certification = building.certification;
  const locationLabel = [building.district, building.city].filter(Boolean).join(' • ') || 'Chưa cập nhật';

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-zinc-300 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
      <div>
        {/* Building Image Container */}
        <div className="relative h-56 w-full overflow-hidden bg-zinc-100">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={primaryAlt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : null}

          {/* Top-Left Dual Badge: HẠNG + LEED/CERTIFICATION */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
            <span className="px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold tracking-wider uppercase bg-white/95 text-zinc-900 border border-zinc-200/80 shadow-sm backdrop-blur-sm flex items-center gap-1.5">
              <span>{gradeLabel}</span>
              {certification && (
                <>
                  <span className="text-zinc-300 font-light">|</span>
                  <span className="text-emerald-700 font-semibold">{certification}</span>
                </>
              )}
            </span>
          </div>

          {/* Bottom Overlay Location Tag */}
          <div className="absolute inset-x-0 bottom-0 pt-6 pb-2.5 px-3 bg-gradient-to-t from-black/75 via-black/30 to-transparent flex items-center gap-1 text-white text-xs font-medium">
            <MapPin className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            <span className="truncate drop-shadow-sm text-[11px]">{locationLabel}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3 text-zinc-900">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-serif text-zinc-900 group-hover:text-[#b84518] transition-colors line-clamp-1">
              <Link href={`/dich-vu-cho-thue/office/${building.slug}`}>{building.name}</Link>
            </h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1 line-clamp-1 font-light">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>{building.address}</span>
            </p>
          </div>

          {/* Specs Row: Area & Grade */}
          <div className="flex items-center justify-between text-xs text-zinc-600 pt-1 pb-1 border-t border-zinc-100">
            <span className="flex items-center gap-1.5 font-medium">
              <Ruler className="w-3.5 h-3.5 text-zinc-400" />
              <span>{areaText}</span>
            </span>
            <span className="flex items-center gap-1 font-medium text-zinc-700">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>{gradeLabel}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Price Block & CTA Button */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-serif text-[#b84518]">
              {priceDisplay}
            </span>
            <span className="text-xs text-zinc-500 font-normal">/m²/tháng</span>
          </div>
          <span className="text-[11px] text-zinc-400 block font-light -mt-0.5">
            Giá thuê tham khảo
          </span>
        </div>

        <Link
          href={`/dich-vu-cho-thue/office/${building.slug}`}
          aria-label={`Xem chi tiết tòa nhà văn phòng ${building.name}`}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200/90 transition-all hover:border-zinc-300 shadow-sm shrink-0 text-center"
        >
          Xem chi tiết <span className="sr-only">tòa nhà {building.name}</span>
        </Link>
      </div>
    </div>
  );
}
