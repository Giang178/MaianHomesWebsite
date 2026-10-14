'use client';

import Image from 'next/image';

interface Partner {
  name: string;
  logo: string;
}

const partnersRow1: Partner[] = [
  { name: 'Vingroup', logo: '/images/partner/banner-GT01.png' },
  { name: 'Masterise Homes', logo: '/images/partner/banner-GT02.png' },
  { name: 'Keppel Land', logo: '/images/partner/banner-GT03.png' },
  { name: 'Gamuda Land', logo: '/images/partner/banner-GT04.png' },
];

const partnersRow2: Partner[] = [
  { name: 'CapitaLand', logo: '/images/partner/banner-GT05.png' },
  { name: 'SonKim Land', logo: '/images/partner/banner-GT06.jpg' },
  { name: 'Nam Long', logo: '/images/partner/banner-GT07.jpg' },
  { name: 'Khang Điền', logo: '/images/partner/banner-GT08.jpg' },
];

export default function PartnersSection() {
  return (
    <section className="bg-[#FAF9F5] text-[#1A1612] py-20 lg:py-28 overflow-hidden relative">
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee-left {
          display: flex;
          width: max-content;
          animation: marquee-left 25s linear infinite;
        }
        .animate-marquee-right {
          display: flex;
          width: max-content;
          animation: marquee-right 25s linear infinite;
        }
        .animate-marquee-left:hover, .animate-marquee-right:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="w-full max-w-[96%] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Nửa trái: Brand Statement */}
          <div className="lg:col-span-5 space-y-6">
            <div className="text-[#D4AF37] text-xs sm:text-sm min-[1368px]:text-base font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] min-[1368px]:tracking-[0.25em]">
              Sự kết nối tầm cỡ
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl min-[1368px]:text-5xl font-serif font-bold tracking-tight leading-snug uppercase text-slate-900">
              Đối tác <br className="hidden lg:inline" /> chiến lược
            </h2>
            <div className="h-1 w-20 bg-[#D4AF37]" />
            <p className="text-slate-600 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed max-w-md text-pretty">
              Chúng tôi lựa chọn đồng hành cùng các chủ đầu tư, nhà phát triển và đối tác uy tín, cùng chung tiêu chuẩn về chất lượng, minh bạch và giá trị dành cho khách hàng.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div>
                <span className="text-2xl sm:text-3xl lg:text-3xl min-[1368px]:text-4xl font-bold font-serif text-[#D4AF37]">08+</span>
                <p className="text-[10px] sm:text-xs min-[1368px]:text-xs uppercase tracking-wider text-slate-500 font-medium mt-1">Đối tác chiến lược</p>
              </div>
              <div className="w-px h-10 bg-slate-300" />
              <div>
                <span className="text-2xl sm:text-3xl lg:text-3xl min-[1368px]:text-4xl font-bold font-serif text-[#D4AF37]">100%</span>
                <p className="text-[10px] sm:text-xs min-[1368px]:text-xs uppercase tracking-wider text-slate-500 font-medium mt-1">Dự án chọn lọc</p>
              </div>
            </div>
          </div>

          {/* Nửa phải: Marquee Logo (2 hàng chạy ngược chiều nhau) */}
          <div className="lg:col-span-7 relative w-full overflow-hidden select-none">
            {/* Hàng 1 chạy sang trái */}
            <div className="overflow-hidden mb-6 relative">
              <div className="animate-marquee-left gap-6">
                {[...partnersRow1, ...partnersRow1, ...partnersRow1, ...partnersRow1].map((partner, index) => (
                  <div
                    key={`row1-${index}`}
                    aria-hidden={index >= partnersRow1.length ? 'true' : undefined}
                    className="shrink-0 w-32 h-14 sm:w-44 sm:h-20 flex items-center justify-center bg-white border border-slate-100 hover:border-[#D6B25E]/40 rounded-2xl transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(214,178,94,0.08)] px-6"
                  >
                    <div className="relative w-full h-[60%]">
                      <Image
                        src={partner.logo}
                        alt={index < partnersRow1.length ? partner.name : ''}
                        aria-hidden={index >= partnersRow1.length ? 'true' : undefined}
                        fill
                        sizes="176px"
                        className="object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Fade overlay 2 đầu */}
              <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#FAF9F5] to-transparent pointer-events-none z-10" />
              <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FAF9F5] to-transparent pointer-events-none z-10" />
            </div>

            {/* Hàng 2 chạy sang phải */}
            <div className="overflow-hidden relative">
              <div className="animate-marquee-right gap-6">
                {[...partnersRow2, ...partnersRow2, ...partnersRow2, ...partnersRow2].map((partner, index) => (
                  <div
                    key={`row2-${index}`}
                    aria-hidden={index >= partnersRow2.length ? 'true' : undefined}
                    className="shrink-0 w-32 h-14 sm:w-44 sm:h-20 flex items-center justify-center bg-white border border-slate-100 hover:border-[#D6B25E]/40 rounded-2xl transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(214,178,94,0.08)] px-6"
                  >
                    <div className="relative w-full h-[60%]">
                      <Image
                        src={partner.logo}
                        alt={index < partnersRow2.length ? partner.name : ''}
                        aria-hidden={index >= partnersRow2.length ? 'true' : undefined}
                        fill
                        sizes="176px"
                        className="object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Fade overlay 2 đầu */}
              <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#FAF9F5] to-transparent pointer-events-none z-10" />
              <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FAF9F5] to-transparent pointer-events-none z-10" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
