import { cache } from 'react';
import { safeJsonLd } from '@/features/content/public/structured-data';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { workspaceApi } from '@/features/workspaces/api';
import { generateOfficeLandingJsonLd } from '@/features/workspaces/structured-data';
import {
  OfficeHero,
  OfficeBuildingsSection,
  OfficeGradeSpotlight,
  OfficeLeasingProcess,
  WorkspaceFAQ,
  WorkspaceConsultationForm,
} from '@/features/workspaces/components';

export const revalidate = 60;

const getCachedOfficeLanding = cache(async (isPreview: boolean, cookieHeader?: string) => {
  return workspaceApi.getOfficeLanding(isPreview, cookieHeader);
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const isPreview = params.preview === 'true';

  try {
    let cookieHeader: string | undefined;
    if (isPreview) {
      try {
        const cookieStore = await cookies();
        cookieHeader = cookieStore.toString();
      } catch {
        // Preview metadata can be generated without request cookies.
      }
    }
    const data = await getCachedOfficeLanding(isPreview, cookieHeader);
    const raw = data?.landing || data;
    const seo = raw?.seo_metadata || raw?.seo;
    const metaTitle = seo?.meta_title || seo?.title || raw?.hero_title || raw?.title || '';
    const metaDesc = seo?.meta_description || seo?.description || raw?.hero_subtitle || raw?.subtitle || '';
    const keywords = seo?.meta_keywords?.length ? seo.meta_keywords : (seo?.keywords || []);
    const ogImg = seo?.og_image || raw?.hero_image_url || raw?.hero_image;

    return {
      title: metaTitle || undefined,
      description: metaDesc,
      keywords,
      openGraph: {
        title: metaTitle || undefined,
        description: metaDesc,
        images: ogImg ? [{ url: ogImg }] : [],
        type: 'website',
        locale: 'vi_VN',
      },
      alternates: seo?.canonical_url ? { canonical: seo.canonical_url } : undefined,
      robots: seo?.robots_directives || seo?.robots || (isPreview ? 'noindex, nofollow' : 'index, follow'),
      other: {
        'geo.region': 'VN-SG',
        'geo.placename': 'TP. Hồ Chí Minh',
        'geo.position': '10.7769;106.7009',
        'ICBM': '10.7769, 106.7009',
      },
    };
  } catch {
    return {};
  }
}
export default async function OfficeLandingPage({
  searchParams,
}: {
  searchParams: Promise<{
    district?: string;
    area_band?: string;
    budget_band?: string;
    grade?: string;
    search?: string;
    preview?: string;
  }>;
}) {
  const params = await searchParams;
  const isPreview = params.preview === 'true';

  let cookieHeader: string | undefined;
  if (isPreview) {
    try {
      const cookieStore = await cookies();
      cookieHeader = cookieStore.toString();
    } catch {
      // ignore
    }
  }

  let landingData = null;
  let buildingsData = null;

  try {
    [landingData, buildingsData] = await Promise.all([
      getCachedOfficeLanding(isPreview, cookieHeader),
      workspaceApi.getOfficeBuildings({
        district: params.district,
        area_band: params.area_band,
        budget_band: params.budget_band,
        grade: params.grade,
        search: params.search,
        limit: 50,
      }),
    ]);
  } catch (err) {
    console.error('Failed to fetch office landing data:', err);
  }

  if (!landingData && !isPreview) {
    notFound();
  }

  const raw = landingData?.landing || landingData;
  const landing = {
    ...raw,
    title: raw?.hero_title || raw?.title,
    subtitle: raw?.hero_subtitle || raw?.subtitle,
    hero_image: raw?.hero_image_url || raw?.hero_image,
    hero_badge: raw?.hero_badge,
    hero_counters: raw?.hero_counters,
    grades_title: raw?.grades_title || raw?.districts_title,
    grades_subtitle: raw?.grades_subtitle || raw?.districts_subtitle,
    grades: raw?.grades || raw?.districts,
    process_badge: raw?.process_badge,
    process_title: raw?.process_title,
    process_subtitle: raw?.process_subtitle,
    process_steps: raw?.process_steps,
    market_section_title: raw?.market_section_title,
    market_section_description: raw?.market_section_description,
    consultation_badge: raw?.consultation_badge,
    consultation_title: raw?.consultation_title,
    consultation_description: raw?.consultation_description,
    highlights: raw?.highlights || [],
  };

  const positiveNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;
  const rawBuildings = buildingsData?.items || [];
  const buildings = rawBuildings.map((b: any) => {
    const units = b.units || [];
    const unitPrices = units
      .map((u: any) => u.rental_price)
      .filter(positiveNumber);
    const unitAreas = units
      .map((u: any) => u.area)
      .filter(positiveNumber);
    const minPrice = positiveNumber(b.price_per_sqm_min)
      ? b.price_per_sqm_min
      : positiveNumber(b.min_price)
      ? b.min_price
      : unitPrices.length
      ? Math.min(...unitPrices)
      : null;
    const maxPrice = positiveNumber(b.price_per_sqm_max)
      ? b.price_per_sqm_max
      : positiveNumber(b.max_price)
      ? b.max_price
      : unitPrices.length
      ? Math.max(...unitPrices)
      : null;
    const minArea = positiveNumber(b.min_area)
      ? b.min_area
      : unitAreas.length
      ? Math.min(...unitAreas)
      : null;
    const maxArea = positiveNumber(b.max_area)
      ? b.max_area
      : unitAreas.length
      ? Math.max(...unitAreas)
      : null;

    return {
      ...b,
      price_per_sqm_min: minPrice,
      price_per_sqm_max: maxPrice,
      min_area: minArea,
      max_area: maxArea,
      grade: b.grade || b.building_grade || '',
    };
  });
  const faqs = landingData?.faqs || raw?.faqs || [];
  const jsonLd = generateOfficeLandingJsonLd(landing, buildings, faqs);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-2 px-4 text-xs font-semibold tracking-wider uppercase sticky top-16 z-30">
          Chế độ xem trước (Preview Mode) — Nội dung chưa công khai
        </div>
      )}

      {/* 1. Hero Section (Banner) */}
      <OfficeHero landing={landing} />

      {/* 2. Exploration Section: Top Filter Bar & Buildings Collection (Image 1) */}
      <OfficeBuildingsSection
        buildings={buildings}
        districts={buildingsData?.districts || []}
      />

      {/* 3. 3 Grades Showcase: Phân khúc Hạng A, B, C (replaces "Một vị trí nhiều cơ hội") */}
      <OfficeGradeSpotlight
        title={landing.grades_title}
        subtitle={landing.grades_subtitle}
        grades={landing.grades}
      />

      {/* 4. 4-Step Professional Leasing Concierge Process (Image 1 continuation) */}
      <OfficeLeasingProcess
        badge={landing.process_badge}
        title={landing.process_title}
        subtitle={landing.process_subtitle}
        steps={landing.process_steps}
      />

      {/* 6. Semantic GEO & Market Standards Context Block */}
      <section className="py-8 sm:py-10 bg-zinc-50 text-zinc-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xs sm:text-sm font-semibold text-zinc-800 uppercase tracking-wider mb-2.5">
            {landing.market_section_title || landing.intro_title}
          </h2>
          <p className="leading-relaxed font-light text-zinc-600">
            {landing.market_section_description || landing.intro_description}
          </p>
        </div>
      </section>

      {/* 7. FAQs Section (Light Theme) */}
      <WorkspaceFAQ faqs={faqs} title={landing.seo_metadata?.h1 || landing.hero_title} theme="light" />

      {/* 8. Consultation Request Form */}
      <div id="tu-van" className="py-8 sm:py-10 lg:py-12 bg-white scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <WorkspaceConsultationForm
            source="OFFICE"
            theme="light"
            hideHeader={false}
            badge={landing.consultation_badge}
            title={landing.consultation_title}
            subtitle={landing.consultation_description}
          />
        </div>
      </div>
    </div>
  );
}
