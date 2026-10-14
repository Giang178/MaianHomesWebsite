import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  Quote,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { TeamAvatar } from '@/features/team/TeamAvatar';
import { TeamApiError, getPublicTeamMember } from '@/features/team/api';
import { TeamAchievements } from '@/features/team/components/TeamAchievements';
import { TeamProjectCard } from '@/features/team/components/TeamProjectCard';
import ContactFormSection from '@/components/home/ContactFormSection';

export const revalidate = 300;

// Generate profiles on first access instead of contacting the backend during image builds.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

const loadMember = cache(async (slug: string) => {
  try {
    return await getPublicTeamMember(slug);
  } catch (error) {
    if (error instanceof TeamApiError && error.status === 404) notFound();
    throw error;
  }
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const member = await loadMember(slug);
  const rawTitle = member.seo_title || `${member.full_name} - ${member.position}`;
  const cleanTitle = rawTitle.replace(/\s*\|\s*Maian Homes.*$/i, '').trim();
  const pageTitle = `${cleanTitle} | Maian Homes`;
  const description = member.seo_description || member.short_bio;
  const canonical = `${SITE_URL}/doi-ngu/${member.slug}`;
  return {
    title: cleanTitle,
    description,
    alternates: { canonical },
    openGraph: { title: pageTitle, description, url: canonical, type: 'profile', images: [{ url: member.avatar_url, alt: member.full_name }] },
    twitter: { card: 'summary_large_image', title: pageTitle, description, images: [member.avatar_url] },
  };
}

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await loadMember(slug);
  const canonical = `${SITE_URL}/doi-ngu/${member.slug}`;
  const phoneHref = member.phone
    ? `tel:${member.phone.replace(/[^\d+]/g, '')}`
    : undefined;
  const typeName = member.profile_type === 'BROKER' ? 'RealEstateAgent' : 'Person';

  const stats = [
    [Award, `${member.years_experience.toString().padStart(2, '0')}+`, 'Năm kinh nghiệm'],
    [UsersRound, `${member.customers_served}+`, 'Khách hàng đồng hành'],
    [BriefcaseBusiness, `${member.deals_completed}+`, 'Giao dịch thành công'],
    [CheckCircle2, `${member.satisfaction_rate}%`, 'Khách hàng hài lòng'],
  ] as const;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': typeName,
        '@id': `${canonical}#person`,
        name: member.full_name,
        jobTitle: member.position,
        description: member.short_bio,
        image: `${SITE_URL}${member.avatar_url}`,
        url: canonical,
        telephone: member.phone || undefined,
        email: member.email || undefined,
        worksFor: { '@type': 'Organization', name: 'Maian Homes', url: `${SITE_URL}` },
        knowsAbout: member.specialties.map(item => item.title),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}` },
          { '@type': 'ListItem', position: 2, name: 'Đội ngũ', item: `${SITE_URL}/doi-ngu` },
          { '@type': 'ListItem', position: 3, name: member.full_name, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#FBFBF9] text-slate-900 selection:bg-[#D4AF37]/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#061221] via-[#091B30] to-[#0D243F] text-white">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-80 w-80 rounded-full bg-[#1e3b5d]/30 blur-2xl" />

        <Image
          src="/images/banner_sec1.png"
          alt=""
          fill
          sizes="100vw"
          quality={75}
          className="pointer-events-none object-cover object-center opacity-20 mix-blend-luminosity"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-18 sm:pt-22 lg:pt-24">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            {/* Left Col: Info & Bio */}
            <div className="pb-8 sm:pb-12 lg:pb-16">
              {/* Back navigation */}
              <Link
                href="/doi-ngu"
                aria-label="Quay lại danh sách đội ngũ chuyên gia Maian Homes"
                className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs sm:text-sm font-medium text-white/80 backdrop-blur-sm transition-all hover:border-[#D4AF37]/50 hover:bg-white/10 hover:text-[#F1CB65]"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                <span>Đội ngũ chuyên gia</span>
              </Link>

              {/* Profile Type & Position Badges */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#F1CB65]">
                  <Sparkles className="size-3 text-[#D4AF37]" />
                  {member.profile_type === 'LEADERSHIP' ? 'Lãnh đạo' : 'Chuyên viên môi giới'}
                </span>
                {member.position && (
                  <span className="text-xs sm:text-sm font-medium text-white/60">
                    • {member.position}
                  </span>
                )}
              </div>

              {/* Single H1 for SEO */}
              <h1 className="mt-4 break-words font-serif text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#D4AF37] leading-[1.15]">
                {member.full_name}
              </h1>

              {/* Short Bio */}
              <p className="mt-4 max-w-2xl text-sm sm:text-base lg:text-lg leading-relaxed text-white/80">
                {member.short_bio}
              </p>

              {/* Quick Contact Actions */}
              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <a
                  href={phoneHref || '/lien-he'}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#D4AF37] px-5 sm:px-6 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#07182b] transition-all duration-300 hover:bg-[#F1CB65] shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Phone className="size-4" />
                  <span>Liên hệ ngay chuyên gia</span>
                </a>
                {member.phone && (
                  <a
                    href={phoneHref}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 sm:px-5 text-xs sm:text-sm text-white backdrop-blur-sm transition-all hover:border-[#D4AF37] hover:bg-white/10 hover:text-[#F1CB65]"
                    aria-label={`Gọi điện thoại cho chuyên gia ${member.full_name}: ${member.phone}`}
                  >
                    <span>{member.phone}</span>
                  </a>
                )}
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 sm:px-5 text-xs sm:text-sm text-white backdrop-blur-sm transition-all hover:border-[#D4AF37] hover:bg-white/10 hover:text-[#F1CB65]"
                    aria-label={`Gửi email cho chuyên gia ${member.full_name}: ${member.email}`}
                  >
                    <Mail className="size-4 text-[#D4AF37]" />
                    <span>{member.email}</span>
                  </a>
                )}
                {member.linkedin_url?.startsWith('https://') && (
                  <a
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 sm:px-5 text-xs sm:text-sm text-white backdrop-blur-sm transition-all hover:border-[#D4AF37] hover:bg-white/10 hover:text-[#F1CB65]"
                    aria-label={`Hồ sơ LinkedIn của chuyên gia ${member.full_name}`}
                  >
                    <ExternalLink className="size-4 text-[#D4AF37]" />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            </div>

            {/* Right Col: Hero Avatar Portrait (Single Image on page) */}
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[260px] sm:max-w-xs md:max-w-sm lg:max-w-md self-end drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-[#061221] via-transparent to-transparent z-10 pointer-events-none opacity-40" />
              <TeamAvatar src={member.avatar_url} alt={member.avatar_alt_text || `Chuyên gia ${member.full_name}`} priority />
            </div>
          </div>
        </div>
      </section>

      {/* Floating Performance Stats */}
      <section className="relative z-20 mx-auto -mt-6 sm:-mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map(([Icon, value, label]) => {
            const StatIcon = Icon as typeof Award;
            return (
              <div
                key={String(label)}
                className="group rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/40 hover:shadow-xl"
              >
                <div className="flex size-10 sm:size-12 items-center justify-center rounded-xl bg-[#FBF8F0] text-[#B88A29] transition-colors group-hover:bg-[#D4AF37] group-hover:text-white">
                  <StatIcon className="size-5 sm:size-6" />
                </div>
                <strong className="mt-3 block font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#B88A29]">
                  {String(value)}
                </strong>
                <span className="mt-1 block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {String(label)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section: Về tôi & Thành tựu nổi bật (No duplicate photo!) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-14">
        <div className="grid gap-8 lg:gap-12 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Bento Quote & Highlights */}
          <div className="space-y-6 lg:col-span-5">
            {/* Bento Quote Box */}
            {member.quote && (
              <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#091B30] via-[#0D243F] to-[#152E4D] p-6 sm:p-8 text-white shadow-xl">
                <Quote className="absolute -right-3 -top-3 size-20 sm:size-24 text-white/[0.04] pointer-events-none" />
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37] block mb-3">
                  Triết lý làm việc
                </span>
                <blockquote className="relative z-10 text-base sm:text-lg font-serif italic leading-relaxed text-white/95">
                  “{member.quote}”
                </blockquote>
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-[#F1CB65]">
                      {member.full_name}
                    </p>
                    <p className="text-[11px] text-white/60">
                      {member.position || 'Chuyên gia tư vấn'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Achievements Card (Smart Responsive for Mobile & Laptop) */}
            <TeamAchievements achievements={member.achievements} initialCount={4} />
          </div>

          {/* Right Column: Detailed Biography */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-0.5 w-5 rounded-full bg-[#D4AF37]" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-[#B88A29]">
                Giới thiệu chuyên môn
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold uppercase text-[#15243b] tracking-tight">
              Về tôi
            </h2>
            {member.headline && (
              <h3 className="mt-2.5 font-serif text-base sm:text-lg lg:text-xl font-medium text-[#48566a] leading-relaxed">
                {member.headline}
              </h3>
            )}
            <div className="mt-5 whitespace-pre-line text-sm sm:text-base leading-relaxed text-slate-600 text-justify">
              {member.about}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Chuyên môn & Lĩnh vực hoạt động */}
      {member.specialties.length > 0 && (
        <section className="bg-white py-8 sm:py-10 lg:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center justify-center gap-2 mb-2">
                <span className="h-0.5 w-5 rounded-full bg-[#D4AF37]" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-[#B88A29]">
                  Năng lực cốt lõi
                </span>
                <span className="h-0.5 w-5 rounded-full bg-[#D4AF37]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold uppercase text-[#15243b] tracking-tight">
                Lĩnh vực chuyên môn
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-lg mx-auto">
                Kinh nghiệm chuyên sâu và hiểu biết thực địa giúp kiến tạo giá trị bền vững cho khách hàng.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {member.specialties.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-slate-100 bg-[#FBFBF9] p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/50 hover:bg-white hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-white text-[#B88A29] shadow-sm transition-colors group-hover:bg-[#B88A29] group-hover:text-white">
                      <Award className="size-5 shrink-0" />
                    </div>
                    <h3 className="font-serif font-bold text-[#15243b] text-base leading-tight">
                      {item.title}
                    </h3>
                  </div>
                  {item.description && (
                    <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section: Dự án đã đồng hành */}
      {member.projects && member.projects.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-0.5 w-5 rounded-full bg-[#D4AF37]" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-[#B88A29]">
                  Hồ sơ dự án
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold uppercase text-[#15243b] tracking-tight">
                Dự án đã đồng hành
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
              Các dự án bất động sản tiêu biểu ghi dấu ấn tư vấn và đồng hành thành công.
            </p>
          </div>

          {/* Mobile swipeable carousel, Tablet/Desktop multi-col grid */}
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6 sm:overflow-visible">
            {member.projects.map((project, index) => (
              <TeamProjectCard key={project.id} project={project} priority={index < 2} />
            ))}
          </div>

          {/* Gợi ý vuốt trên Mobile khi có nhiều hơn 1 dự án */}
          {member.projects.length > 1 && (
            <div className="flex sm:hidden items-center justify-center gap-1.5 mt-2 text-slate-400 text-xs font-light tracking-wide">
              <span>Vuốt ngang để xem thêm</span>
              <ArrowRight className="size-3.5 animate-pulse text-[#D4AF37]" />
            </div>
          )}
        </section>
      )}

      {/* Form để lại thông tin tư vấn đồng bộ như trang chủ */}
      <ContactFormSection projects={member.projects || []} />
    </main>
  );
}
