'use client';

import {
  ClipboardCheck,
  Search,
  Handshake,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface OfficeLeasingProcessProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  steps?: Array<{
    step?: string;
    title: string;
    subtitle: string;
    description: string;
  }>;
}

export default function OfficeLeasingProcess({
  badge,
  title,
  subtitle,
  steps,
}: OfficeLeasingProcessProps = {}) {
  const processIcons = [ClipboardCheck, Search, KeyRound, Handshake];
  const displayBadge = badge;
  const displayTitle = title;
  const displaySubtitle = subtitle;
  const displaySteps = (steps || []).map((item, idx) => ({
    ...item,
    step: item.step || `0${idx + 1}`,
    icon: processIcons[idx % processIcons.length],
  }));

  if (!displayTitle && !displaySubtitle && displaySteps.length === 0) return null;
  return (
    <section className="py-10 sm:py-14 bg-zinc-50/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          {displayBadge ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#AA820A]" />
              <span>{displayBadge}</span>
            </div>
          ) : null}
          {displayTitle ? (
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-zinc-900 font-medium">
              {displayTitle}
            </h2>
          ) : null}
          {displaySubtitle ? (
            <p className="mt-2 text-zinc-600 text-xs sm:text-sm font-light max-w-xl mx-auto">
              {displaySubtitle}
            </p>
          ) : null}
        </div>
        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displaySteps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group bg-white border border-zinc-200 hover:border-zinc-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-serif font-bold text-zinc-300 group-hover:text-[#AA820A] transition-colors">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 text-[#AA820A] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold font-serif text-zinc-900">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#AA820A] uppercase tracking-wider mt-1 mb-2.5">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-zinc-600 font-light leading-relaxed">
                    {item.description}
                  </p>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
