import { Metadata } from 'next';
import { safeJsonLd } from '@/features/content/public/structured-data';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { workspaceApi } from '@/features/workspaces/api';
import { generateBuildingJsonLd } from '@/features/workspaces/structured-data';
import {
  OfficeDetailView,
} from '@/features/workspaces/components';

export const revalidate = 60;

interface BuildingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: BuildingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sParams = await searchParams;
  const isPreview = sParams.preview === 'true';

  try {
    const cookieHeader = isPreview ? (await cookies()).toString() : undefined;
    const data = await workspaceApi.getOfficeBuildingBySlug(slug, isPreview, cookieHeader);
    const b = data?.building || (data?.name ? data : null);
    if (!b) return {};

    const seo = b.seo || b.seo_metadata;
    return {
      title: seo?.meta_title || seo?.title || b.name || undefined,
      description: seo?.meta_description || seo?.description || b.description || '',
      keywords: seo?.meta_keywords?.length ? seo.meta_keywords : (seo?.keywords || []),
      openGraph: {
        title: seo?.meta_title || seo?.title || b.name || undefined,
        description: seo?.meta_description || seo?.description || b.description || '',
        images: b.images?.length
          ? [{ url: typeof b.images[0] === 'string' ? b.images[0] : b.images[0]?.url || '' }]
          : [],
        type: 'website',
        locale: 'vi_VN',
      },
      alternates: {
        canonical: seo?.canonical_url || `https://maianhomes.vn/dich-vu-cho-thue/office/${b.slug}`,
      },
      robots: seo?.robots_directives || seo?.robots || (isPreview ? 'noindex, nofollow' : 'index, follow'),
      other: {
        'geo.region': 'VN-SG',
        'geo.placename': `${b.name}, ${b.district || ''}, TP. Hồ Chí Minh`.trim(),
        'geo.position': `${b.latitude || 10.7769};${b.longitude || 106.7009}`,
        'ICBM': `${b.latitude || 10.7769}, ${b.longitude || 106.7009}`,
      },
    };
  } catch {
    return {};
  }
}
export default async function OfficeBuildingDetailPage({
  params,
  searchParams,
}: BuildingPageProps) {
  const { slug } = await params;
  const sParams = await searchParams;
  const isPreview = sParams.preview === 'true';

  let data = null;
  try {
    const cookieHeader = isPreview ? (await cookies()).toString() : undefined;
    data = await workspaceApi.getOfficeBuildingBySlug(slug, isPreview, cookieHeader);
  } catch (err) {
    console.error('Failed to fetch building details:', err);
  }

  // Support both raw building object directly from API and { building: ... }
  const rawBuilding = data?.building || (data?.name ? data : null);

  if (!rawBuilding) {
    notFound();
  }

  const building = rawBuilding;
  const rawUnits = (data?.units || rawBuilding?.units || []) as any[];
  const units = rawUnits.map((u, idx) => ({
    ...u,
    unit_code: u.unit_code || u.code || u.unit_number || u.name || '',
  }));
  const faqs = (data?.faqs || rawBuilding?.faqs || []) as any[];
  const jsonLd = generateBuildingJsonLd(building, units, faqs);

  // Fetch related buildings in same district or grade
  let relatedBuildings: any[] = [];
  try {
    const relRes = await workspaceApi.getOfficeBuildings({
      district: building.district,
      grade: building.building_grade || building.grade,
      limit: 6,
      is_preview: isPreview,
    });
    relatedBuildings = (relRes?.items || []).filter((b: any) => b.slug !== slug).slice(0, 3);

    // If not enough by district+grade, fetch general buildings to always have up to 3 recommendations
    if (relatedBuildings.length < 3) {
      const allRes = await workspaceApi.getOfficeBuildings({ limit: 6 });
      const more = (allRes?.items || []).filter(
        (b: any) => b.slug !== slug && !relatedBuildings.some((r) => r.slug === b.slug)
      );
      relatedBuildings = [...relatedBuildings, ...more].slice(0, 3);
    }
  } catch {
    relatedBuildings = [];
  }

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <OfficeDetailView
        building={building}
        units={units}
        faqs={faqs}
        relatedBuildings={relatedBuildings}
        isPreview={isPreview}
      />
    </>
  );
}
