'use client';

import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CoworkingHeroProps {
  space?: any;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  ctaTourLabel?: string;
  ctaConsultLabel?: string;
  onTourClick?: () => void;
  onConsultClick?: () => void;
}

export default function CoworkingHero(props: CoworkingHeroProps) {
  const {
    space,
    title: providedTitle,
    subtitle: providedSubtitle,
    description: providedDescription,
    imageUrl: providedImageUrl,
    ctaTourLabel,
    ctaConsultLabel,
    onTourClick,
    onConsultClick,
  } = props;
  const title = providedTitle ?? space?.hero?.title ?? space?.name;
  const subtitle = providedSubtitle ?? space?.hero?.subtitle ?? space?.tagline;
  const description = providedDescription ?? space?.hero?.description;
  const imageUrl = providedImageUrl ?? space?.hero?.image_url ?? space?.hero_image;
  const ctaLabel = ctaConsultLabel ?? space?.hero?.cta_consult_label ?? ctaTourLabel ?? space?.hero?.cta_tour_label;
  const bgImg = imageUrl || '/images/coworking/hero.jpg';

  return (
    <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden text-white pt-10 pb-10 sm:pt-14 sm:pb-12 px-4 sm:px-6 lg:px-8">
      {/* Background Image - Clean, High-Res & Crisp (Next.js optimized Image quality 95, priority) */}
      <Image
        src={bgImg}
        alt={title || ''}
        fill
        priority
        quality={95}
        sizes="100vw"
        className="object-cover object-center z-0"
      />

      {/* Atmospheric dark overlay for optimal text legibility and image vibrance */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80 z-0" />

      {/* Decorative Golden Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60 z-10" />

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6 sm:space-y-7">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1612]/70 border border-[#D4AF37]/50 text-[#D4AF37] text-xs sm:text-sm font-semibold tracking-[0.15em] uppercase shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>{title}</span>
        </div>

        {/* Main H1 Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.015em] text-[#FAF8F5] leading-[1.2] text-balance font-serif drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)]">
          {subtitle}
        </h1>

        {/* Description */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-white font-medium leading-[1.65] tracking-[0.01em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {description}
        </p>

        {/* Single Primary CTA Button */}
        <div className="pt-2 flex items-center justify-center">
          <button
            onClick={() => {
              if (onConsultClick) {
                onConsultClick();
              } else if (onTourClick) {
                onTourClick();
              } else if (typeof document !== 'undefined') {
                const el = document.getElementById('dat-lich');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full sm:w-auto px-9 py-4 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] hover:shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="w-4 h-4 text-[#1A1612]" />
          </button>
        </div>
      </div>
    </section>
  );
}
