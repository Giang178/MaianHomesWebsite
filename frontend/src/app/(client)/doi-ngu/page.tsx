import type { Metadata } from 'next';
import { TeamDirectoryClient } from '@/features/team/TeamDirectoryClient';
import PublicDataUnavailable from '@/components/system/PublicDataUnavailable';
import ContactFormSection from '@/components/home/ContactFormSection';
import { getPublicTeam, TeamApiError } from '@/features/team/api';
import { buildCmsMetadata, cmsGeoJsonLd, getPublicPage, pageText } from '@/features/website/public/page-content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('team_index', {
    title: 'Đội ngũ chuyên gia bất động sản',
    description: 'Gặp gỡ đội ngũ chuyên gia, nhà môi giới và cố vấn bất động sản được tuyển chọn tại Maian Homes.',
    canonicalPath: '/doi-ngu',
  });
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; du_an?: string }>;
}) {
  const params = await searchParams;
  const initialProjectSlug = params.project || params.du_an || '';
  const page = await getPublicPage('team_index');
  const content = page?.content || {};
  const pageTitle = pageText(content, 'title', 'Đội Ngũ Nhà Môi Giới Maian Homes');
  const pageDescription = pageText(content, 'description', 'Không chỉ bán bất động sản, chúng tôi hướng đến vai trò người tư vấn đáng tin cậy, am hiểu thị trường và đồng hành minh bạch cùng khách hàng.');
  let result;
  try {
    result = await getPublicTeam({ limit: 100 });
  } catch (error) {
    const apiError = error instanceof TeamApiError ? error : null;
    return (
      <main className="min-h-[70vh] bg-[#fbfaf7] px-6 py-32">
        <PublicDataUnavailable
          title="Chưa thể tải danh sách đội ngũ"
          requestId={apiError?.requestId}
          status={apiError?.status}
        />
      </main>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Đội ngũ chuyên gia Maian Homes',
    url: `${SITE_URL}/doi-ngu`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: result.data.map((member, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        ...(member.allow_detail_view
          ? { url: `${SITE_URL}/doi-ngu/${member.slug}` }
          : { item: { '@type': 'Person', name: member.full_name } }),
        name: member.full_name,
      })),
    },
  };

  // Trích xuất danh sách dự án duy nhất để truyền vào Form tư vấn
  const uniqueProjects = Array.from(
    new Map<string, { id?: string; name: string; slug: string }>(
      (result.data || [])
        .flatMap((m) => m.projects || [])
        .filter((p) => p && (p.slug || p.id))
        .map((p) => [p.slug || p.id, { id: p.id, name: p.name, slug: p.slug }])
    ).values()
  );

  return (
    <main className="min-h-screen bg-[#fbfaf7] pb-12 sm:pb-16 pt-14 text-slate-900 lg:pt-18">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(cmsGeoJsonLd(page, `${SITE_URL}/doi-ngu`, 'Đội ngũ chuyên gia Maian Homes')).replace(/</g, '\\u003c')}}/>
      {/* ── HEADER & HERO THƯƠNG HIỆU ── */}
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-2 sm:pt-4 pb-3 sm:pb-6 text-center">
        <div className="inline-flex items-center justify-center gap-2 mb-2 sm:mb-3">
          <span className="h-0.5 w-5 sm:w-6 rounded-full bg-[#D4AF37]" />
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-[#B88A29]">
            Đội ngũ chuyên gia
          </span>
          <span className="h-0.5 w-5 sm:w-6 rounded-full bg-[#D4AF37]" />
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#15243b] uppercase">
          {pageTitle}
        </h1>
        <div className="h-1 w-16 sm:w-20 bg-[#D4AF37] mx-auto mt-2.5 sm:mt-3.5 mb-2.5 sm:mb-3.5 rounded-full" />
        <p className="mx-auto max-w-2xl text-xs sm:text-base text-slate-600 font-light leading-relaxed">
          {pageDescription}
        </p>
      </header>

      {/* ── DANH BẠ CHUYÊN GIA & BỘ LỌC ── */}
      <TeamDirectoryClient
        members={result.data}
        initialProjectSlug={initialProjectSlug}
      />

      {/* ── KHỐI CHUYỂN ĐỔI: FORM TƯ VẤN ĐỒNG BỘ ── */}
      <div className="mt-14 sm:mt-20">
        <ContactFormSection projects={uniqueProjects} />
      </div>
    </main>
  );
}
