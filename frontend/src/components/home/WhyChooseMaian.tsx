'use client';

import { Gem, ShieldCheck, TrendingUp, Handshake } from 'lucide-react';


export default function WhyChooseMaian() {
  return (
    <section className="bg-[#FAF9F5] text-slate-900 pt-12 sm:pt-16 lg:pt-20 min-[1368px]:pt-28 pb-10 sm:pb-12 lg:pb-16 relative">
      <div className="w-full max-w-[96%] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-8">

        {/* Header */}
        <div className="max-w-3xl mb-12 lg:mb-16">
          <div className="text-[#D4AF37] text-xs sm:text-sm min-[1368px]:text-base font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] min-[1368px]:tracking-[0.25em] mb-2 sm:mb-3">
            Giá trị khác biệt
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl min-[1368px]:text-4xl font-serif font-bold tracking-tight text-slate-900 mb-3 sm:mb-4 uppercase leading-snug">
            Vì sao chọn Maian Homes
          </h2>
          <div className="h-1 w-20 bg-[#D4AF37] mb-4" />
          <p className="text-slate-600 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed text-pretty">
            Maian Homes lấy lợi ích của khách hàng làm điểm xuất phát, lấy giá trị thật của bất động sản làm cơ sở tư vấn và lấy niềm tin dài hạn làm thước đo thành công.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-3 gap-6 min-[1368px]:gap-8">

          {/* Bento Card 1: Featured Brand Philosophy (Nền tối, lớn, chiếm 1 cột chính, 2 dòng chiều cao trên lg) */}
          <div className="md:col-span-12 lg:col-span-1 lg:row-span-2 bg-[#1A1612] text-white rounded-3xl p-6 sm:p-10 min-[1368px]:p-12 flex flex-col justify-between border border-white/5 shadow-xl relative overflow-hidden group">
            {/* Background design decoration */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-[#D4AF37]/5 blur-3xl group-hover:bg-[#D4AF37]/10 transition-all duration-700" />

            <div className="space-y-6 relative z-10">
              <span className="text-[#D4AF37] text-[10px] sm:text-xs min-[1368px]:text-xs font-semibold uppercase tracking-wider block">Triết lý hành động</span>
              <p className="text-sm sm:text-lg md:text-xl lg:text-lg min-[1368px]:text-2xl font-serif font-medium leading-relaxed sm:leading-loose text-pretty text-[#F3E6C6]">
                &ldquo;
                Hiểu đúng nhu cầu - Phân tích đúng giá trị - Tư vấn đúng sản phẩm - Đồng hành dài hạn.&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-8 border-t border-white/10 mt-8 relative z-10 items-end">
              <div className="flex flex-col justify-end h-full">
                <span className="text-lg sm:text-xl font-serif font-semibold text-[#D4AF37] block leading-tight">100% Khách hàng</span>
                <span className="text-[10px] sm:text-xs text-white/80 uppercase tracking-widest font-semibold mt-3 block whitespace-nowrap">An tâm</span>
              </div>
              <div className="flex flex-col justify-end h-full">
                <span className="text-lg sm:text-xl font-serif font-semibold text-[#D4AF37] block leading-tight whitespace-nowrap">Đồng hành</span>
                <span className="text-[10px] sm:text-xs text-white/80 uppercase tracking-widest font-semibold mt-3 block whitespace-nowrap">Dài lâu</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Tư vấn đúng giá trị (Nền trắng viền vàng champagne bên trái) */}
          <div className="md:col-span-6 lg:col-span-1 bg-white border border-[#EAE6DF] hover:border-[#D4AF37]/50 rounded-3xl p-6 sm:p-8 min-[1368px]:p-10 transition-all duration-500 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(212,175,55,0.06)] border-l-4 border-l-[#D4AF37] flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F2] flex items-center justify-center mb-6 text-[#D4AF37] border border-[#D4AF37]/10 transition-transform duration-500 group-hover:scale-105">
                <Gem className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-base sm:text-lg lg:text-base min-[1368px]:text-xl font-bold text-slate-900 mb-2 sm:mb-3 tracking-normal group-hover:text-[#D4AF37] transition-colors relative inline-block">
                Thấu hiểu nhu cầu 
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#D4AF37] transition-all duration-500 group-hover:w-full" />
              </h3>
              <p className="text-slate-600 text-xs sm:text-xs min-[1368px]:text-sm font-light leading-relaxed text-pretty">
                Lắng nghe để hiểu mục tiêu thực sự của khách hàng trước khi giới thiệu bất động sản.
              </p>
            </div>
          </div>

          {/* Bento Card 3: Pháp lý rõ ràng (Nền kem nhạt, icon chìm trang trí) */}
          <div className="md:col-span-6 lg:col-span-1 bg-[#FAF8F2] border border-[#EAE6DF] hover:border-[#D4AF37]/50 rounded-3xl p-6 sm:p-8 min-[1368px]:p-10 transition-all duration-500 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(212,175,55,0.06)] flex flex-col justify-between group relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-6 text-[#D4AF37] border border-[#D4AF37]/10 transition-transform duration-500 group-hover:scale-105">
                <ShieldCheck className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-base sm:text-lg lg:text-base min-[1368px]:text-xl font-bold text-slate-900 mb-2 sm:mb-3 tracking-normal group-hover:text-[#D4AF37] transition-colors relative inline-block">
                Pháp lý rõ ràng
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#D4AF37] transition-all duration-500 group-hover:w-full" />
              </h3>
              <p className="text-slate-600 text-xs sm:text-xs min-[1368px]:text-sm font-light leading-relaxed text-pretty">
               Chọn lọc và phân tích sản phẩm dựa trên giá trị thực, pháp lý, tài chính và tiềm năng.
              </p>
            </div>
          </div>

          {/* Bento Card 4: Giá trị đầu tư bền vững (Nền xám nhạt slate tinh tế) */}
          <div className="md:col-span-6 lg:col-span-1 bg-[#F3F2EE] border border-[#EAE6DF] hover:border-[#D4AF37]/50 rounded-3xl p-6 sm:p-8 min-[1368px]:p-10 transition-all duration-500 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(212,175,55,0.06)] flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-6 text-[#D4AF37] border border-[#D4AF37]/10 transition-transform duration-500 group-hover:scale-105">
                <TrendingUp className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-base sm:text-lg lg:text-base min-[1368px]:text-xl font-bold text-slate-900 mb-2 sm:mb-3 tracking-normal group-hover:text-[#D4AF37] transition-colors relative inline-block">
                Minh bạch & giá trị
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#D4AF37] transition-all duration-500 group-hover:w-full" />
              </h3>
              <p className="text-slate-600 text-xs sm:text-xs min-[1368px]:text-sm font-light leading-relaxed text-pretty">
                Nói rõ cơ hội lẫn rủi ro, giúp khách hàng có đủ thông tin để tự tin quyết định.
              </p>
            </div>
          </div>

          {/* Bento Card 5: Đồng hành tận tâm (Góc trên bên phải được bo cong đặc biệt) */}
          <div className="md:col-span-6 lg:col-span-1 bg-white border border-[#EAE6DF] hover:border-[#D4AF37]/50 rounded-3xl rounded-tr-[5rem] p-6 sm:p-8 min-[1368px]:p-10 transition-all duration-500 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(212,175,55,0.06)] flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F2] flex items-center justify-center mb-6 text-[#D4AF37] border border-[#D4AF37]/10 transition-transform duration-500 group-hover:scale-105">
                <Handshake className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-base sm:text-lg lg:text-base min-[1368px]:text-xl font-bold text-slate-900 mb-2 sm:mb-3 tracking-normal group-hover:text-[#D4AF37] transition-colors relative inline-block">
                Đồng hành dài hạn
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#D4AF37] transition-all duration-500 group-hover:w-full" />
              </h3>
              <p className="text-slate-600 text-xs sm:text-xs min-[1368px]:text-sm font-light leading-relaxed text-pretty">
                Không dừng lại ở giao dịch, Maian Homes hướng đến trở thành người cố vấn bất động sản lâu dài của khách hàng.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
