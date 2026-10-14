'use client';

import {
  Building2,
  ShieldCheck,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { getAssetUrl } from '@/lib/api';

interface OfficeHeroProps {
  landing: {
    title?: string;
    hero_title?: string;
    subtitle?: string;
    hero_subtitle?: string;
    hero_image?: string;
    hero_image_url?: string;
    hero_alt_text?: string;
    hero_badge?: string;
    hero_counters?: Array<{ value: string; label: string; sublabel: string }>;
    highlights?: Array<{ title: string; description: string }>;
  };
}

export default function OfficeHero({ landing }: OfficeHeroProps) {
  const heroImg = getAssetUrl(landing.hero_image || landing.hero_image_url);
  const heroBadge = landing.hero_badge;
  const heroTitle = landing.hero_title || landing.title;
  const heroAlt = landing.hero_alt_text || heroTitle || '';
  const heroSubtitle = landing.hero_subtitle || landing.subtitle;
  const counterIcons = [Building2, ShieldCheck, Clock, TrendingUp];
  const counterStyles = [
    { colorBg: 'bg-[#D4AF37]/20', colorText: 'text-[#D4AF37]' },
    { colorBg: 'bg-emerald-500/20', colorText: 'text-emerald-300' },
    { colorBg: 'bg-amber-500/20', colorText: 'text-amber-300' },
    { colorBg: 'bg-blue-500/20', colorText: 'text-blue-300' },
  ];
  const lightCounterStyles = [
    { colorBg: 'bg-[#D4AF37]/10', colorText: 'text-[#AA820A]' },
    { colorBg: 'bg-emerald-50', colorText: 'text-emerald-600' },
    { colorBg: 'bg-amber-50', colorText: 'text-[#AA820A]' },
    { colorBg: 'bg-blue-50', colorText: 'text-zinc-900' },
  ];
  const counters = (landing.hero_counters || []).map((counter, idx) => ({
    ...counter,
    icon: counterIcons[idx % counterIcons.length],
    ...(heroImg ? counterStyles[idx % counterStyles.length] : lightCounterStyles[idx % lightCounterStyles.length]),
  }));

  return (
    <section className={`relative isolate flex flex-col justify-center overflow-hidden min-h-[560px] sm:min-h-[600px] md:min-h-[68vh] lg:min-h-[72vh] py-16 sm:py-20 md:py-24 ${heroImg ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`}>
      {/* Subtle minimalist background glow or Banner Image */}
      {heroImg ? (
        <>
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" data-testid="office-hero-banner">
            <img
              src={heroImg}
              alt={heroAlt}
              className="w-full h-full object-cover object-center scale-105"
            />
          </div>
          {/* Lớp phủ kính sáng hơn, giảm bớt độ tối để bức ảnh tòa nhà hiển thị rõ nét */}
          <div className="absolute inset-0 z-0 bg-black/15 backdrop-blur-[0.5px] pointer-events-none" />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/35 via-black/10 to-black/20 pointer-events-none" />
        </>
      ) : (
        <div className="absolute top-0 left-1/2 z-0 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-50/40 via-zinc-50/30 to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center my-auto">
        {/* Subtle Minimalist Badge */}
        {heroBadge ? (
          <div
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider mb-4 sm:mb-6 shadow-sm ${
              heroImg
                ? 'bg-black/35 border border-white/25 text-[#D4AF37] backdrop-blur-md'
                : heroBadge.toUpperCase().includes('OFFICE LEASING') || heroBadge.toUpperCase().includes('MAIAN HOMES')
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-zinc-100 border border-zinc-200 text-zinc-700'
            }`}
          >
            <Sparkles
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                heroImg
                  ? 'text-[#D4AF37]'
                  : heroBadge.toUpperCase().includes('OFFICE LEASING') || heroBadge.toUpperCase().includes('MAIAN HOMES')
                  ? 'text-red-600'
                  : 'text-[#AA820A]'
              }`}
            />
            <span>{heroBadge}</span>
          </div>
        ) : null}

        {/* Main Headline - Cụm "MAIAN HOMES | OFFICE LEASING" có màu đỏ */}
        {heroTitle ? (
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] xl:text-5xl font-serif tracking-tight leading-snug sm:leading-tight font-bold max-w-4xl mx-auto text-red-600">
            {heroTitle}
          </h1>
        ) : null}

        {/* Subtitle - Cụm "VĂN PHÒNG CHO THUÊ TẠI TP.HCM" có màu xanh đậm như logo */}
        {heroSubtitle ? (
          <p className="mt-3.5 sm:mt-4 text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto font-bold uppercase tracking-wide leading-relaxed text-[#002B60]">
            {heroSubtitle}
          </p>
        ) : null}

        {/* Minimalist Trust Counters Bar */}
        {counters.length > 0 ? (
          <div className="mt-8 sm:mt-10 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {counters.map((counter, idx) => {
            const Icon = counter.icon;
            return (
              <div
                key={idx}
                className={`rounded-2xl p-4 text-center transition-all ${
                  heroImg
                    ? 'bg-black/30 backdrop-blur-md border border-white/20 shadow-xl'
                    : 'bg-zinc-50/80 border border-zinc-200/80'
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${counter.colorBg} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-4 h-4 ${counter.colorText}`} />
                </div>
                <div className={`text-xl sm:text-2xl font-bold font-serif ${heroImg ? 'text-white' : counter.colorText}`}>
                  {counter.value}
                </div>
                {counter.label && (
                  <div className={`text-xs sm:text-[13px] font-semibold mt-1 ${heroImg ? 'text-white/95' : 'text-zinc-800'}`}>
                    {counter.label}
                  </div>
                )}
                {counter.sublabel && (
                  <div className={`text-[11px] mt-0.5 font-light ${heroImg ? 'text-white/70' : 'text-zinc-500'}`}>
                    {counter.sublabel}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
