'use client';

import { useState, useRef, useEffect, TouchEvent } from 'react';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Camera,
} from 'lucide-react';

export interface GalleryImage {
  id?: string;
  url: string;
  alt_text?: string;
  caption?: string;
  is_primary?: boolean;
}

interface OfficeDetailGallerySliderProps {
  images: GalleryImage[];
  buildingName: string;
}

export default function OfficeDetailGallerySlider({
  images,
  buildingName,
}: OfficeDetailGallerySliderProps) {
  const validImages: GalleryImage[] = images;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Touch Swipe Handling for Mobile
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 45; // Minimum px distance to trigger swipe

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > minSwipeDistance) {
      // Swiped Left -> Show Next
      handleNext();
    } else if (distance < -minSwipeDistance) {
      // Swiped Right -> Show Prev
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === 'Escape') setLightboxOpen(false);
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, validImages.length]);

  if (validImages.length === 0) return null;

  const currentImage = validImages[currentIndex] || validImages[0];

  return (
    <section className="py-4 sm:py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* =========================================================================
          MAIN SLIDER CONTAINER: 1 LARGE IMAGE WITH TOUCH SWIPE & ARROWS
          ========================================================================= */}
      <div
        className="relative h-72 sm:h-96 md:h-[460px] lg:h-[520px] w-full rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 group select-none shadow-sm cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Main Image with Smooth Fade Transition */}
        <div key={currentIndex} className="relative w-full h-full animate-fadeIn">
          <Image
            src={currentImage.url}
            alt={currentImage.alt_text || `${buildingName} - ảnh ${currentIndex + 1}`}
            fill
            sizes="(max-width: 1024px) 100vw, 1280px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            priority
          />
        </div>

        {/* Subtle Gradient Overlays for Readability */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* Top-Right: Image Counter & Fullscreen Button */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Slide Indicator Badge */}
          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider flex items-center gap-1.5 border border-white/10 shadow-sm">
            <Camera className="w-3.5 h-3.5 text-orange-400" />
            <span>
              {currentIndex + 1} / {validImages.length}
            </span>
          </div>

          {/* Fullscreen Preview Button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-white hover:text-zinc-900 border border-white/10 transition-colors shadow-sm cursor-pointer"
            title="Xem toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom-Left: Caption / Title */}
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 max-w-[65%] sm:max-w-[75%]">
          <p className="text-white text-xs sm:text-sm font-medium drop-shadow-md truncate">
            {currentImage.alt_text || currentImage.caption || `${buildingName} • Góc nhìn thực tế`}
          </p>
          <span className="text-[10px] sm:text-[11px] text-zinc-300 font-light block drop-shadow-sm mt-0.5 truncate">
            Vuốt ngang để chuyển ảnh
          </span>
        </div>

        {/* Navigation Arrows (Prev / Next) */}
        {validImages.length > 1 && (
          <>
            {/* Prev Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-white text-white hover:text-zinc-900 backdrop-blur-md border border-white/15 flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 -ml-0.5" />
            </button>

            {/* Next Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-white text-white hover:text-zinc-900 backdrop-blur-md border border-white/15 flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Ảnh tiếp"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 -mr-0.5" />
            </button>
          </>
        )}

        {/* Pagination Dots at Bottom Center for Mobile */}
        {validImages.length > 1 && (
          <div className="absolute bottom-3 right-3 sm:hidden z-20 flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-full">
            {validImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx ? 'w-4 bg-[#b84518]' : 'w-1.5 bg-white/60'
                }`}
                aria-label={`Ảnh ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          THUMBNAIL STRIP (SCROLLABLE ROW BELOW THE MAIN IMAGE)
          ========================================================================= */}
      {validImages.length > 1 && (
        <div className="mt-3 flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 px-0.5">
          {validImages.map((img, idx) => {
            const isActive = currentIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative shrink-0 w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#b84518] shadow-md scale-[1.02] ring-2 ring-[#b84518]/20'
                    : 'border-zinc-200 opacity-60 hover:opacity-100 hover:border-zinc-400'
                }`}
              >
                <Image
                  src={img.url}
                  alt={img.alt_text || `Thumbnail ${idx + 1}`}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          LIGHTBOX MODAL (EXPANDED FULLSCREEN VIEW)
          ========================================================================= */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-50"
            aria-label="Đóng xem toàn màn hình"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 sm:left-8 p-3 rounded-full bg-white/10 hover:bg-[#b84518] text-white transition-colors cursor-pointer z-50"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>

          {/* Active Image */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full h-[65vh] sm:h-[80vh]"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              src={currentImage.url}
              alt={currentImage.alt_text || `${buildingName} - phóng to`}
              fill
              quality={95}
              sizes="100vw"
              className="object-contain"
              priority
            />
            {currentImage.alt_text && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-xs text-white text-center border border-white/10">
                {currentImage.alt_text}
              </div>
            )}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 sm:right-8 p-3 rounded-full bg-white/10 hover:bg-[#b84518] text-white transition-colors cursor-pointer z-50"
            aria-label="Ảnh tiếp"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>
      )}
    </section>
  );
}
