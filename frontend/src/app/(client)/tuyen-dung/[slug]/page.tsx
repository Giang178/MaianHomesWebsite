export const revalidate = 60;

import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JobDetailClient from './JobDetailClient';
import { fetchPublicJson, invalidPublicPayload, type PublicFetchResult } from '@/lib/public-fetch';

type PublicJob = {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  address_detail?: string | null;
  employment_type: string;
  quantity: number;
  salary_range?: string | null;
  short_description?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  description_html?: string | null;
  requirements_html?: string | null;
  benefits_html?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const rawBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const baseApiUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

// Generate job pages on first access instead of contacting the backend during image builds.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

function jobUnavailable(result: { status?: number; requestId?: string; reason: string }): Error {
  const context = [
    result.status ? `status=${result.status}` : undefined,
    result.requestId ? `requestId=${result.requestId}` : undefined,
    `reason=${result.reason}`,
  ].filter(Boolean).join(' ');
  const error = new Error(`Public job data unavailable (${context})`);
  error.name = 'PublicContentUnavailableError';
  return error;
}

function stripHtml(html?: string | null): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapEmploymentType(type?: string | null): string {
  const normalized = (type || '').toLowerCase();
  if (normalized.includes('part')) return 'PART_TIME';
  if (normalized.includes('contract')) return 'CONTRACTOR';
  if (normalized.includes('intern')) return 'INTERN';
  return 'FULL_TIME';
}

const getJobDetail = cache(async (slug: string): Promise<PublicFetchResult<PublicJob>> => {
  const result = await fetchPublicJson<PublicJob>(`${baseApiUrl}/api/public/jobs/${encodeURIComponent(slug)}`, {
    cache: 'force-cache',
    next: { revalidate: 60, tags: ['public-jobs', `public-job-${slug}`] },
    signal: AbortSignal.timeout(8000),
  });
  if (result.state !== 'ok') return result;
  if (!result.data || typeof result.data.slug !== 'string' || typeof result.data.title !== 'string') {
    return invalidPublicPayload(result);
  }
  return result;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getJobDetail(slug);

  if (result.state === 'not-found') {
    return {
      title: 'Vị trí tuyển dụng',
      description: 'Không tìm thấy vị trí tuyển dụng này tại Maian Homes.',
      alternates: { canonical: `${SITE_URL}/tuyen-dung/${slug}` },
      robots: { index: false, follow: false },
    };
  }
  if (result.state === 'error') {
    throw jobUnavailable(result);
  }
  const job = result.data;

  const cleanJobTitle = (job.title || '').replace(/\s*\|\s*Maian Homes.*$/i, '').trim();
  const jobUrl = `${SITE_URL}/tuyen-dung/${job.slug}`;
  const description = job.seo_description || job.short_description || stripHtml(job.description_html) || `Gia nhập Maian Homes tại vị trí ${cleanJobTitle}. Cơ hội nghề nghiệp hấp dẫn trong lĩnh vực bất động sản cao cấp.`;

  return {
    title: job.seo_title || `Tuyển dụng ${cleanJobTitle}`,
    description,
    keywords: [cleanJobTitle, `tuyển dụng ${cleanJobTitle}`, 'Maian Homes', 'việc làm BĐS', 'tuyển dụng BĐS', job.location].filter(Boolean) as string[],
    alternates: { canonical: jobUrl },
    openGraph: {
      title: `Tuyển dụng ${cleanJobTitle} | Maian Homes`,
      description,
      url: jobUrl,
      siteName: 'Maian Homes',
      locale: 'vi_VN',
      type: 'article',
      images: [
        {
          url: `${SITE_URL}/images/logo_final.png`,
          width: 1200,
          height: 630,
          alt: `Tuyển dụng ${cleanJobTitle} tại Maian Homes`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Tuyển dụng ${cleanJobTitle} | Maian Homes`,
      description,
      images: [`${SITE_URL}/images/logo_final.png`],
    },
  };
}

export default async function PublicJobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getJobDetail(slug);

  if (result.state === 'not-found') {
    notFound();
  }
  if (result.state === 'error') {
    throw jobUnavailable(result);
  }
  const job = result.data;

  const isExpired = job.status === 'CLOSED' || job.status === 'EXPIRED';
  const jobUrl = `${SITE_URL}/tuyen-dung/${job.slug}`;
  const plainDescription = stripHtml(job.description_html) || job.short_description || `Thông tin tuyển dụng vị trí ${job.title} tại Maian Homes.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
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
        '@type': 'JobPosting',
        '@id': `${jobUrl}#jobposting`,
        title: job.title,
        description: plainDescription,
        datePosted: job.created_at || job.updated_at,
        employmentType: mapEmploymentType(job.employment_type),
        hiringOrganization: { '@id': ORGANIZATION_ID },
        directApply: true,
        applicantLocationRequirements: {
          '@type': 'Country',
          name: 'VN',
        },
        industry: 'Real Estate',
        occupationalCategory: job.department,
        workHours: job.employment_type,
        url: jobUrl,
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            streetAddress: job.address_detail || 'Số 606/62 Đường 3/2, Phường Diên Hồng',
            addressLocality: job.location || 'TP. Hồ Chí Minh',
            addressRegion: job.location || 'Hồ Chí Minh',
            addressCountry: 'VN',
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${jobUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Tuyển dụng', item: `${SITE_URL}/tuyen-dung` },
          { '@type': 'ListItem', position: 3, name: job.title, item: jobUrl },
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
      <JobDetailClient job={job} isExpired={isExpired} />
    </>
  );
}
