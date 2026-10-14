'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Eye, ImageIcon, X } from 'lucide-react';

interface CoworkingGalleryProps {
  images?: any[];
  gallery?: any[];
}

export default function CoworkingGallery(props: CoworkingGalleryProps) {
  const images = props.gallery || props.images || [];
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const displayImages = images
    .map((img) => (typeof img === 'string' ? { url: img, alt_text: '' } : img))
    .filter((img) => img && img.url)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  if (displayImages.length === 0) return null;

  const handlePrev = () => {
    if (selectedIdx !== null) {
      setSelectedIdx((selectedIdx - 1 + displayImages.length) % displayImages.length);
    }
  };

  const handleNext = () => {
    if (selectedIdx !== null) {
      setSelectedIdx((selectedIdx + 1) % displayImages.length);
    }
  };

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white text-[#2D1B14]">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {displayImages.map((img, idx) => (
            <div
              key={img.id || idx}
              onClick={() => setSelectedIdx(idx)}
              className="group relative h-60 rounded-2xl overflow-hidden border border-[#E8E0D8] hover:border-[#D4AF37] cursor-pointer shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 bg-zinc-100"
            >
              <Image
                src={img.url}
                alt={img.alt_text || ''}
                fill
                quality={90}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="font-medium truncate pr-2">{img.alt_text}</span>
                  <Eye className="w-4 h-4 text-[#D4AF37] shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setSelectedIdx(null)}
        >
          <button
            onClick={() => setSelectedIdx(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Đóng xem ảnh"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 sm:left-8 p-3 rounded-full bg-black/60 text-white hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors cursor-pointer"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Active Image */}
          <div
            className="relative max-w-4xl max-h-[85vh] w-full h-[60vh] sm:h-[75vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={displayImages[selectedIdx].url}
              alt={displayImages[selectedIdx].alt_text || 'Co-working image'}
              fill
              quality={95}
              sizes="100vw"
              className="object-contain"
              priority
            />
            {displayImages[selectedIdx].caption && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-xs text-[#F3E6C6] text-center border border-white/10">
                {displayImages[selectedIdx].caption}
              </div>
            )}
          </div>

          {/* Next button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 sm:right-8 p-3 rounded-full bg-black/60 text-white hover:bg-[#D4AF37] hover:text-[#1A1612] transition-colors cursor-pointer"
            aria-label="Ảnh tiếp"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </section>
  );
}
