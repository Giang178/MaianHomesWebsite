import { Metadata } from 'next';
import { connection } from 'next/server';
import RecruitmentClient from './RecruitmentClient';
import PublicDataUnavailable from '@/components/system/PublicDataUnavailable';
import { fetchPublicJson, invalidPublicPayload, type PublicFetchResult } from '@/lib/public-fetch';
import { buildCmsMetadata, getPublicPage, publicMediaUrl } from '@/features/website/public/page-content';

type PublicJob = {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  employment_type: string;
  quantity: number;
  salary_range?: string;
  short_description?: string;
  deadline?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_expired?: boolean;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';
const RECRUITMENT_URL = `${SITE_URL}/tuyen-dung`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const API_URL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function getPublicJobs(): Promise<PublicFetchResult<PublicJob[]>> {
  const result = await fetchPublicJson<PublicJob[]>(`${API_URL}/api/public/jobs?view=summary`, {
    cache: 'force-cache',
    next: { revalidate: 60, tags: ['public-jobs'] },
    signal: AbortSignal.timeout(5000),
  });
  if (result.state !== 'ok') return result;
  if (!Array.isArray(result.data)) return invalidPublicPayload(result);
  return result;
}

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('recruitment_index', {title: 'Tuyển dụng bất động sản cao cấp', description: 'Khám phá cơ hội nghề nghiệp và môi trường làm việc tại Maian Homes.', canonicalPath: '/tuyen-dung', image: '/images/banner_hr.png'});
}

export default async function PublicRecruitmentPage() {
  await connection();
  const [result, page] = await Promise.all([getPublicJobs(), getPublicPage('recruitment_index')]);
  if (result.state !== 'ok') {
    return (
      <main className="min-h-[70vh] bg-[#FAF9F6] px-6 py-32">
        <PublicDataUnavailable
          title="Chưa thể tải danh sách tuyển dụng"
          requestId={result.requestId}
          status={result.status}
        />
      </main>
    );
  }
  const jobs = result.data;
  const publishedJobs = jobs.filter((job) => job.slug && job.title);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'Maian Homes',
        url: SITE_URL,
        inLanguage: 'vi-VN',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Maian Homes',
        legalName: 'CÔNG TY TNHH MAIAN HOMES',
        url: SITE_URL,
        logo: `${SITE_URL}/images/logo_final.png`,
        sameAs: [
          'https://www.facebook.com/MaianHomes',
          'https://www.instagram.com/maianhomes',
          'https://www.tiktok.com/@maianhomes',
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${RECRUITMENT_URL}/#webpage`,
        url: RECRUITMENT_URL,
        name: 'Tuyển dụng Maian Homes',
        description: 'Danh sách vị trí tuyển dụng đang mở tại Maian Homes trong lĩnh vực bất động sản cao cấp và PropTech.',
        inLanguage: 'vi-VN',
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORGANIZATION_ID },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: publishedJobs.length,
          itemListElement: publishedJobs.slice(0, 20).map((job, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${RECRUITMENT_URL}/${job.slug}`,
            name: job.title,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${RECRUITMENT_URL}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Tuyển dụng', item: RECRUITMENT_URL },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <RecruitmentClient
        initialJobs={publishedJobs}
        heroImage={publicMediaUrl(page?.content?.hero_media_id, '/images/banner_hr.png')}
      />
    </>
  );
}
