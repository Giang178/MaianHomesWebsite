'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { WorkspaceFAQ } from '../types';

interface WorkspaceFAQProps {
  faqs: WorkspaceFAQ[];
  title?: string;
  subtitle?: string;
  theme?: 'light' | 'dark';
}

export default function WorkspaceFAQSection({
  faqs = [],
  title = '',
  subtitle = '',
  theme = 'dark',
}: WorkspaceFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const activeFaqs = faqs.filter((f) => f.status === 'PUBLISHED');

  if (activeFaqs.length === 0) return null;

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const isLight = theme === 'light';

  return (
    <section
      className={`py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 transition-colors ${
        isLight ? 'bg-white text-[#2D1B14]' : 'bg-[#1A1612] text-white'
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase font-bold tracking-[0.15em] text-[#AA820A]">
            <HelpCircle className="w-4 h-4" />
            <span>Hỏi đáp dịch vụ</span>
          </div>
          <h2
            className={`text-2xl sm:text-4xl font-bold font-serif tracking-[-0.015em] leading-[1.25] ${
              isLight ? 'text-[#2D1B14]' : 'text-white'
            }`}
          >
            {title}
          </h2>
          <p
            className={`text-sm sm:text-base font-light max-w-xl mx-auto leading-[1.65] tracking-[0.01em] ${
              isLight ? 'text-zinc-600' : 'text-[#F3E6C6]/70'
            }`}
          >
            {subtitle}
          </p>
        </div>

        {/* Accordion list */}
        <div className="space-y-3">
          {activeFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={faq.id || faq._id || idx}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isLight
                    ? 'bg-[#FAF8F5] border-[#E8E0D8] hover:border-[#D4AF37]/50'
                    : 'bg-[#221B14] border-[#D4AF37]/15'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className={`w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-zinc-100/70' : 'hover:bg-[#2A2016]'
                  }`}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`font-semibold text-sm sm:text-base pr-2 ${
                      isLight ? 'text-zinc-900' : 'text-[#F3E6C6]'
                    }`}
                  >
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen
                        ? 'rotate-180 bg-[#D4AF37] text-white'
                        : isLight
                        ? 'bg-zinc-200/70 text-zinc-600'
                        : 'bg-[#D4AF37]/10 text-[#D4AF37]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    className={`px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm font-light leading-relaxed border-t animate-fadeIn ${
                      isLight
                        ? 'text-zinc-700 border-zinc-200/80'
                        : 'text-[#F3E6C6]/80 border-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-line">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
