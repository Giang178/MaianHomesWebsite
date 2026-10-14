'use client';

import { useState } from 'react';
import { Award, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface AchievementItem {
  title: string;
  description?: string;
}

interface TeamAchievementsProps {
  achievements: AchievementItem[];
  initialCount?: number;
}

export function TeamAchievements({
  achievements = [],
  initialCount = 4,
}: TeamAchievementsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!achievements || achievements.length === 0) {
    return null;
  }

  const hasMore = achievements.length > initialCount;
  const visibleItems = expanded ? achievements : achievements.slice(0, initialCount);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 mb-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 text-[#B88A29]">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#FBF8F0] text-[#B88A29]">
            <Award className="size-4 sm:size-5" />
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-[#15243b]">
            Dấu ấn & Thành tựu nổi bật
          </h3>
        </div>
        {achievements.length > 1 && (
          <span className="rounded-full bg-[#FBF8F0] border border-[#D4AF37]/25 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-[#B88A29]">
            {achievements.length} dấu ấn
          </span>
        )}
      </div>

      {/* List */}
      <ul className="space-y-3.5 sm:space-y-4">
        {visibleItems.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="flex items-start gap-3 text-left animate-in fade-in duration-200"
          >
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FBF8F0] text-[#B88A29]">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="text-sm leading-relaxed flex-1">
              <strong className="block text-[#15243b] font-semibold text-xs sm:text-sm">
                {item.title}
              </strong>
              {item.description && (
                <span className="mt-0.5 block text-slate-600 text-xs sm:text-sm leading-relaxed">
                  {item.description}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Expand / Collapse Button (Optimized for Mobile and Laptop) */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 py-2.5 px-4 text-xs sm:text-sm font-semibold text-[#15243b] hover:border-[#D4AF37]/40 hover:bg-[#FBF8F0] hover:text-[#B88A29] transition-all duration-200 cursor-pointer group"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <span>Thu gọn bớt</span>
              <ChevronUp className="size-4 transition-transform group-hover:-translate-y-0.5 text-[#B88A29]" />
            </>
          ) : (
            <>
              <span>Xem thêm ({achievements.length - initialCount}) thành tựu khác</span>
              <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5 text-[#B88A29]" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
