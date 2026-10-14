import { Metadata } from 'next';
import { workspaceApi } from '@/features/workspaces/api';
import { OfficeGradeView } from '@/features/workspaces/components';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  let title = '';
  let description = '';
  let keywords: string[] = [];
  try {
    const landing = await workspaceApi.getOfficeLanding();
    const confA = landing?.grade_pages?.A;
    if (confA?.seo?.meta_title) title = confA.seo.meta_title;
    if (confA?.seo?.meta_description) description = confA.seo.meta_description;
    if (confA?.seo?.meta_keywords) {
      keywords = confA.seo.meta_keywords.split(',').map((k: string) => k.trim());
    }
  } catch {
    return {};
  }

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      locale: 'vi_VN',
      type: 'website',
    },
    alternates: {
      canonical: 'https://maianhomes.vn/dich-vu-cho-thue/office/hang-a',
    },
    other: {
      'geo.region': 'VN-SG',
      'geo.placename': 'TP. Hồ Chí Minh',
      'geo.position': '10.7769;106.7009',
      'ICBM': '10.7769, 106.7009',
    },
  };
}

export default async function OfficeGradeAPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; budget_band?: string; search?: string }>
}) {
  const params = await searchParams;
  let buildings: any[] = [];
  let districts: string[] = [];
  let gradeConfigs: any = {};
  let customConfig: any = null;

  try {
    const [resBuildings, landingRes] = await Promise.allSettled([
      workspaceApi.getOfficeBuildings({
        grade: 'A',
        district: params.district,
        budget_band: params.budget_band,
        search: params.search,
        limit: 50,
      }),
      workspaceApi.getOfficeLanding(),
    ]);

    if (resBuildings.status === 'fulfilled' && resBuildings.value) {
      buildings = resBuildings.value.items || [];
      districts = resBuildings.value.districts || [];
    }

    if (landingRes.status === 'fulfilled') {
      gradeConfigs = landingRes.value?.grade_pages || {};
      customConfig = gradeConfigs.A || null;
    }
  } catch (err) {
    console.error('Failed to fetch Grade A data:', err);
  }

  return <OfficeGradeView currentGrade="A" buildings={buildings} districts={districts} gradeConfigs={gradeConfigs} customConfig={customConfig} />;
}
