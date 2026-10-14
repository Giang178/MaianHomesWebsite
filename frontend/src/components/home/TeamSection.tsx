import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TeamCard } from '@/features/team/TeamCard';
import type { TeamMember } from '@/features/team/types';

/**
 * Sắp xếp danh sách thành viên hiển thị theo thứ tự: 2, 1, 3, 4
 */
function reorderTeamMembers(items: TeamMember[]): TeamMember[] {
  if (items.length < 4) return items;
  const [first, second, third, fourth] = items;
  return [second, first, third, fourth];
}

export default function TeamSection({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;
  const visible = members.slice(0, 4);
  const orderedMembers = reorderTeamMembers(visible);

  return (
    <section id="doi-ngu" className="bg-white pt-12 sm:pt-16 lg:pt-20 min-[1368px]:pt-28 pb-16 sm:pb-20 lg:pb-24 text-slate-900 relative">
      <div className="w-full max-w-[96%] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-8">
        <div className="max-w-3xl mb-8 sm:mb-12 lg:mb-14">
          <div className="text-[#D4AF37] text-xs sm:text-sm min-[1368px]:text-base font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] min-[1368px]:tracking-[0.25em] mb-2 sm:mb-3">
            Đội ngũ chuyên gia
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-3xl min-[1368px]:text-4xl font-serif font-bold tracking-tight text-slate-900 mb-3 sm:mb-4 uppercase leading-snug">
            ĐỘI NGŨ NHÀ MÔI GIỚI MAIAN HOMES
          </h2>
          <div className="h-1 w-16 sm:w-20 bg-[#D4AF37] mb-3 sm:mb-4 rounded-full" />
          <p className="text-slate-600 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed text-pretty">
            Không chỉ bán bất động sản, chúng tôi hướng đến vai trò người tư vấn đáng tin cậy – hiểu thị trường, hiểu sản phẩm và quan trọng nhất là hiểu khách hàng.
          </p>
        </div>

        {/* Danh sách 4 card: Vuốt ngang (horizontal snap) trên Mobile, Lưới trên Tablet & Desktop */}
        <div className="text-preserve flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-4 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar items-stretch">
          {orderedMembers.map((member) => (
            <div
              key={member.slug}
              className="w-[82vw] max-w-[320px] sm:w-full shrink-0 sm:shrink snap-center text-preserve"
            >
              <TeamCard member={member} className="h-[380px] sm:h-[440px] lg:h-[480px]" />
            </div>
          ))}
        </div>

        {/* Gợi ý vuốt trên Mobile */}
        <div className="flex sm:hidden items-center justify-center gap-1.5 mt-3 text-slate-400 text-xs font-light tracking-wide">
          <span>Vuốt ngang để xem thêm</span>
          <ArrowRight className="w-3.5 h-3.5 animate-pulse text-[#D4AF37]" />
        </div>

        {/* Nút CTA dẫn đến trang danh bạ đội ngũ */}
        <div className="mt-8 sm:mt-12 text-center">
          <Link
            href="/doi-ngu"
            className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3.5 rounded-full text-xs sm:text-sm font-medium sm:font-semibold tracking-normal sm:tracking-wider sm:uppercase border border-[#D4AF37]/60 text-slate-800 bg-white shadow-[0_2px_10px_rgba(212,175,55,0.08)] hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-all duration-300 hover:shadow-[0_8px_25px_rgba(212,175,55,0.25)] active:scale-[0.98]"
          >
            <span>Xem tất cả chuyên gia</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37] group-hover:text-white group-hover:translate-x-1 transition-all duration-300 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
