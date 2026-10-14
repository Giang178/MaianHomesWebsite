'use client';

import React from 'react';
import Image from 'next/image';
import { Armchair, ArrowRight, Users } from 'lucide-react';
import { SeatType } from '../types';

interface CoworkingSeatTypesProps {
  seatTypes: SeatType[];
  onSelectSeatType?: (seatType: SeatType) => void;
}

export default function CoworkingSeatTypes({
  seatTypes = [],
  onSelectSeatType,
}: CoworkingSeatTypesProps) {
  const activeTypes = seatTypes.filter((st) => st.status === 'ACTIVE');

  if (activeTypes.length === 0) return null;

  const isSingle = activeTypes.length === 1;

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-[#FAF8F5] text-[#2D1B14]">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        {/* Dynamic Grid: Centered single card if length is 1, 2 columns if 2, 3 columns if more */}
        <div
          className={`grid gap-6 sm:gap-8 ${
            isSingle
              ? 'max-w-xl mx-auto grid-cols-1'
              : activeTypes.length === 2
              ? 'max-w-4xl mx-auto grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {activeTypes.map((st) => (
            <SeatTypeCard
              key={st.id || st._id || st.code}
              st={st}
              onSelect={onSelectSeatType}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SeatTypeCard({
  st,
  onSelect,
}: {
  st: SeatType;
  onSelect?: (st: SeatType) => void;
}) {
  const [imgSrc, setImgSrc] = React.useState(st.image_url || '/images/coworking/hot-desk.jpg');

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-[#E8E0D8] hover:border-[#D4AF37]/60 transition-all duration-300 shadow-xs hover:shadow-md flex flex-col justify-between hover:-translate-y-1">
      <div>
        {/* Image */}
        <div className="relative h-52 w-full overflow-hidden bg-zinc-100">
          <Image
            src={imgSrc}
            alt={st.alt_text || st.name || ''}
            fill
            quality={90}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            onError={() => setImgSrc('/images/coworking/intro.jpg')}
          />

          {/* Capacity badge */}
          {st.capacity && st.capacity > 0 && (
            <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-[#AA820A] border border-[#E8E0D8] shadow-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{st.capacity} chỗ</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 sm:p-7 space-y-3.5">
          <h3 className="text-xl font-bold font-serif text-[#2D1B14] group-hover:text-[#AA820A] transition-colors leading-[1.3]">
            {st.name}
          </h3>

          <p className="text-sm text-zinc-600 font-normal leading-[1.65] line-clamp-3">
            {st.description}
          </p>

          {/* Reference price */}
          {st.reference_price && (
            <div className="pt-2 border-t border-zinc-100">
              <span className="text-xs uppercase tracking-wider text-zinc-500 block">
                Chi phí tham khảo:
              </span>
              <span className="text-lg font-bold text-[#AA820A]">
                {st.reference_price}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-0">
        <button
          onClick={() => {
            if (onSelect) {
              onSelect(st);
            } else if (typeof document !== 'undefined') {
              const el = document.getElementById('dat-lich');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#FAF6EE] hover:bg-[#D4AF37] text-[#AA820A] hover:text-[#1A1612] border border-[#D4AF37]/40 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>NHẬN TƯ VẤN LOẠI CHỖ NÀY</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
