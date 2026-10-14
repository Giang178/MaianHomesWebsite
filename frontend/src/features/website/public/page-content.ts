import { cache } from 'react';
import type {Metadata} from 'next';

export interface PublicPageDocument {
  page_key: string;
  version: number;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  geo: Record<string, unknown>;
}

export interface CompanyFaq {
  question: string;
  answer: string;
}

export interface PublicCompanyKnowledge {
  company_name?: string;
  overview?: string;
  services?: string[];
  service_areas?: string[];
  working_hours?: string;
  consultation_process?: string[];
  policies?: string[];
  faqs?: CompanyFaq[];
  effective_date?: string;
  published_version?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const publicMediaUrl = (mediaId: unknown, fallback: string): string =>
  typeof mediaId === 'string' && mediaId.trim()
    ? `/api/public/marketing-media/${encodeURIComponent(mediaId.trim())}`
    : fallback;

export const getPublicPage = cache(async (pageKey: string): Promise<PublicPageDocument | null> => {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  try {
    const response = await fetch(`${cleanBase}/api/public/pages/${encodeURIComponent(pageKey)}`, {
      next: { revalidate: 300, tags: [`website-page:${pageKey}`] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return null;
    return {
      page_key: String(payload.page_key || pageKey),
      version: Number(payload.version || 1),
      content: isRecord(payload.content) ? payload.content : {},
      seo: isRecord(payload.seo) ? payload.seo : {},
      geo: isRecord(payload.geo) ? payload.geo : {},
    };
  } catch {
    return null;
  }
});

export const getPublishedCompanyKnowledge = cache(async (): Promise<PublicCompanyKnowledge | null> => {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  try {
    const response = await fetch(`${cleanBase}/api/public/company-knowledge`, {
      next: { revalidate: 300, tags: ['company-knowledge'] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.company)) return null;
    const company = payload.company;
    const faqs = Array.isArray(company.faqs)
      ? company.faqs.filter((item): item is CompanyFaq =>
          isRecord(item) && typeof item.question === 'string' && Boolean(item.question.trim())
          && typeof item.answer === 'string' && Boolean(item.answer.trim()))
      : [];
    return {
      ...company,
      faqs,
      published_version: Number(company.published_version || 1),
    } as PublicCompanyKnowledge;
  } catch {
    return null;
  }
});

export function pageText(content: Record<string, unknown>, key: string, fallback: string): string {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function buildCmsMetadata(
  pageKey: string,
  fallback: {title: string; description: string; canonicalPath: string; image?: string},
): Promise<Metadata> {
  const page = await getPublicPage(pageKey);
  const seo = page?.seo || {};
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn').replace(/\/$/, '');
  const title = pageText(seo, 'title', fallback.title);
  const description = pageText(seo, 'description', fallback.description);
  const canonical = pageText(seo, 'canonical_url', `${siteUrl}${fallback.canonicalPath}`);
  const image = `${siteUrl}${fallback.image || '/images/banner.jpg'}`;
  const keywords = Array.isArray(seo.keywords) ? seo.keywords.map(String).filter(Boolean) : undefined;
  return {
    title,
    description,
    keywords,
    alternates: {canonical},
    robots: pageText(seo, 'robots', 'index,follow'),
    openGraph: {title, description, url: canonical, type: 'website', images: [{url: image, alt: title}]},
    twitter: {card: 'summary_large_image', title, description, images: [image]},
  };
}

export function cmsGeoJsonLd(page: PublicPageDocument | null, pageUrl: string, pageName: string) {
  const geo = page?.geo || {};
  const faqs = Array.isArray(geo.faqs) ? geo.faqs.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
  const graph: Record<string, unknown>[] = [{
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: pageName,
    description: String(geo.answer_summary || ''),
    inLanguage: 'vi-VN',
  }];
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: String(faq.question || ''),
        acceptedAnswer: {'@type': 'Answer', text: String(faq.answer || '')},
      })),
    });
  }
  return {'@context': 'https://schema.org', '@graph': graph};
}
