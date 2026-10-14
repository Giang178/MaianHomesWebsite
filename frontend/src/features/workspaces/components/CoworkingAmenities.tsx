'use client';

import {
  Car,
  Coffee,
  LucideIcon,
  Monitor,
  PhoneCall,
  Printer,
  ShieldCheck,
  Smile,
  Users,
  Wifi,
  Wind,
  Zap,
} from 'lucide-react';
import { WorkspaceAmenity } from '../types';

const ICON_MAP: Record<string, LucideIcon> = {
  Wifi,
  Users,
  Printer,
  Coffee,
  Wind,
  Car,
  Smile,
  ShieldCheck,
  Monitor,
  PhoneCall,
  Zap,
};

interface CoworkingAmenitiesProps {
  amenities: WorkspaceAmenity[];
}

export default function CoworkingAmenities({ amenities = [] }: CoworkingAmenitiesProps) {
  const activeAmenities = amenities
    .filter((a) => a.is_active !== false)
    .sort((a, b) => a.display_order - b.display_order);

  if (activeAmenities.length === 0) return null;

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-[#FAF8F5] text-[#2D1B14]">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm lg:text-base uppercase font-bold tracking-[0.15em] text-[#AA820A]">
            <Zap className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>Tiện ích toàn diện</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#2D1B14] tracking-[-0.015em] leading-[1.25]">
            Hạ Tầng Văn Phòng Chuẩn Mực
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 font-light leading-[1.65] tracking-[0.01em]">
            Mọi tiện nghi cần thiết cho một ngày làm việc hiệu quả và chuyên nghiệp đều được chuẩn bị sẵn sàng.
          </p>
        </div>

        {/* Icons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {activeAmenities.map((amenity) => {
            const IconComponent = ICON_MAP[amenity.icon] || Zap;

            return (
              <div
                key={amenity.id || amenity.name}
                className="group p-5 sm:p-6 rounded-2xl bg-white border border-[#E8E0D8] hover:border-[#D4AF37]/60 hover:bg-[#FAF6EE]/50 transition-all duration-300 flex flex-col items-center text-center space-y-3 shadow-xs hover:shadow-md hover:-translate-y-1"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FAF6EE] group-hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center text-[#AA820A] transition-colors shadow-2xs">
                  <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-[#2D1B14] group-hover:text-[#AA820A] transition-colors leading-[1.35]">
                  {amenity.name}
                </h3>
                {amenity.description && (
                  <p className="text-xs text-zinc-600 font-normal leading-[1.5]">
                    {amenity.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
