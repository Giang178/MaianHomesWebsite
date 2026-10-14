'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface StepItem {
  step: string;
  title: string;
  description: string;
}

const stepsData: StepItem[] = [
  {
    step: '01',
    title: 'Tiếp nhận nhu cầu',
    description: 'Lắng nghe mục tiêu, ngân sách, khu vực quan tâm và kỳ vọng của khách hàng.',
  },
  {
    step: '02',
    title: 'Tư vấn và đề xuất',
    description: 'Phân tích dữ liệu, so sánh dự án và đề xuất các lựa chọn phù hợp nhất.',
  },
  {
    step: '03',
    title: 'Tham quan và trải nghiệm',
    description: 'Sắp xếp lịch tham quan, cung cấp thông tin thực tế và hỗ trợ đánh giá sản phẩm.',
  },
  {
    step: '04',
    title: 'Ký kết và đồng hành',
    description: 'Hỗ trợ thủ tục, đàm phán, ký kết và tiếp tục đồng hành sau giao dịch.',
  },
];

export default function ConsultationProcess() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section className="bg-[#1A1612] text-white py-16 sm:py-20 lg:py-28 relative overflow-hidden">
      {/* Decorative vector overlays */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[96%] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-8 relative z-10">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">

          {/* Nửa trái: Title & Introduction */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit">
            <div className="text-[#D4AF37] text-xs sm:text-sm min-[1368px]:text-base font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] min-[1368px]:tracking-[0.25em]">
              Quy trình làm việc
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl min-[1368px]:text-5xl font-serif font-bold tracking-tight leading-snug uppercase text-[#F3E6C6]">
              Quy trình <br /> tư vấn
            </h2>
            <div className="h-1 w-20 bg-[#D4AF37]" />
            <p className="text-[#F3E6C6]/70 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed text-pretty">
              Maian Homes xây dựng một quy trình đồng hành minh bạch, khoa học và chặt chẽ nhằm tối ưu hóa thời gian và gia tăng giá trị cho mọi quyết định của quý khách hàng.
            </p>
          </div>

          {/* Nửa phải: Vertical Accordion Timeline */}
          <div
            className="lg:col-span-8 divide-y divide-white/10 border-t border-b border-white/10"
            onMouseLeave={() => setActiveStep(null)}
          >
            {stepsData.map((item, index) => {
              const isActive = activeStep === index;
              return (
                <div
                  key={index}
                  onClick={() => setActiveStep(activeStep === index ? null : index)}
                  onMouseEnter={() => setActiveStep(index)}
                  className="group py-6 sm:py-8 cursor-pointer transition-colors duration-500 hover:bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-6 sm:gap-10">
                      {/* Big outline number */}
                      <span
                        className="step-number text-2xl sm:text-4xl lg:text-5xl min-[1368px]:text-6xl font-serif font-bold transition-all duration-500 select-none block"
                        style={{
                          WebkitTextStroke: '1px rgba(255, 255, 255, 1)',
                          color: isActive ? '#D4AF37' : 'transparent',
                          transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        {item.step}
                      </span>
                      <h3
                        className={`text-base sm:text-lg lg:text-xl min-[1368px]:text-2xl font-bold tracking-normal transition-all duration-300 ${isActive ? 'text-[#D4AF37]' : 'text-white group-hover:text-[#D4AF37]/80'
                          }`}
                      >
                        {item.title}
                      </h3>
                    </div>
                    {/* Icon indicator */}
                    <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 group-hover:text-white group-hover:border-white/40 transition-colors shrink-0">
                      {isActive ? <Minus className="w-4 h-4 text-[#D4AF37]" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expandable description container */}
                  <div
                    className={`grid transition-all duration-500 ease-in-out overflow-hidden ${isActive ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'
                      }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pl-16 sm:pl-24 pr-8 text-slate-300 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed max-w-2xl text-pretty">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}
