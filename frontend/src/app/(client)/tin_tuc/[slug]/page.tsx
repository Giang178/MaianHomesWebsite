export const revalidate = 300;

import { Metadata } from 'next';
import { cache, type ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import ArticleDetailClient from '@/features/news/ArticleDetailClient';
import { getAssetUrl } from '@/lib/api';
import type { ArticleItem } from '@/features/news/NewsListClient';
import { buildArticleStructuredData, safeJsonLd } from '@/features/content/public/structured-data';
import { fetchPublicJson, invalidPublicPayload, type PublicFetchResult } from '@/lib/public-fetch';

type RelatedArticle = Partial<ArticleItem> & { _id?: string };
type ArticleDocument = Partial<ArticleItem> & {
  _id?: string;
  created_at?: string;
  seo?: {
    meta_title?: string;
    meta_description?: string;
    canonical_url?: string;
  };
  geo?: {
    answer_summary?: string;
    key_facts?: string[];
    faqs?: Array<{ question: string; answer: string }>;
    sources?: Array<{ title: string; url: string }>;
  };
};
type ArticleDetailProps = ComponentProps<typeof ArticleDetailClient>;
type ArticleDetailPayload = {
  article?: ArticleDocument;
  linked_project?: ArticleDetailProps['linkedProject'];
  related_articles?: RelatedArticle[];
  revisions?: ArticleDetailProps['revisions'];
};
type NormalizedArticle = ArticleItem & Pick<ArticleDocument, 'seo' | 'geo'>;
type ArticleDetailData = {
  article: NormalizedArticle;
  linkedProject: ArticleDetailProps['linkedProject'];
  relatedArticles: ArticleItem[];
  revisions: ArticleDetailProps['revisions'];
};

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Generate article pages on first access instead of contacting the backend during image builds.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

function articleUnavailable(result: { status?: number; requestId?: string; reason: string }): Error {
  const context = [
    result.status ? `status=${result.status}` : undefined,
    result.requestId ? `requestId=${result.requestId}` : undefined,
    `reason=${result.reason}`,
  ].filter(Boolean).join(' ');
  const error = new Error(`Public article data unavailable (${context})`);
  error.name = 'PublicContentUnavailableError';
  return error;
}

const getArticleDetail = cache(async (slug: string): Promise<PublicFetchResult<ArticleDetailData>> => {
  const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const result = await fetchPublicJson<ArticleDetailPayload>(
    `${cleanBase}/api/public/articles/${encodeURIComponent(slug)}`,
    {
      cache: 'force-cache',
      next: { revalidate: 300, tags: ['articles', 'article-' + slug] },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (result.state !== 'ok') return result;
  const json = result.data;
  if (!json?.article || typeof json.article.title !== 'string' || typeof json.article.slug !== 'string') {
    return invalidPublicPayload<ArticleDetailData>(result);
  }

  return {
    ...result,
    data: {
      article: {
        id: json.article.id || json.article._id || '',
        title: json.article.title || '',
        slug: json.article.slug || '',
        category: json.article.category || 'market',
        project_id: json.article.project_id,
        sapo: json.article.sapo || '',
        content: json.article.content || '',
        featured_image_id: json.article.featured_image_id,
        gallery: json.article.gallery || [],
        published_at: json.article.published_at || json.article.created_at,
        updated_at: json.article.updated_at,
        author_name: json.article.author_name || 'Maian Homes',
        view_count: json.article.view_count || 0,
        seo: json.article.seo || {},
        geo: json.article.geo || {}
      },
      linkedProject: json.linked_project ?? null,
      relatedArticles: (json.related_articles || []).map((rel: RelatedArticle) => ({
        id: rel.id || rel._id || '',
        title: rel.title || '',
        slug: rel.slug || '',
        category: rel.category || 'market',
        sapo: rel.sapo || '',
        content: '',
        gallery: rel.gallery || [],
        published_at: rel.published_at,
      })),
      revisions: json.revisions || [],
    },
  };
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticleDetail(slug);
  if (result.state === 'not-found') {
    return {
      title: 'Bài viết không tồn tại',
      robots: { index: false, follow: false },
    };
  }
  if (result.state === 'error') {
    throw articleUnavailable(result);
  }

  const data = result.data;
  const { article } = data;
  const rawTitle = article.seo?.meta_title || article.title || 'Bài viết';
  const cleanTitle = rawTitle.replace(/\s*\|\s*Maian Homes.*$/i, '').trim();
  const pageTitle = `${cleanTitle} | Maian Homes`;
  const description = article.seo?.meta_description || (article.sapo ? article.sapo.slice(0, 155) : 'Cập nhật tin tức thị trường bất động sản từ Maian Homes.');
  const imageUrl = (article.gallery && article.gallery[0])
    ? (getAssetUrl(article.gallery[0].url) || `${SITE_URL}/images/default-project.jpg`)
    : `${SITE_URL}/images/default-project.jpg`;

  return {
    title: cleanTitle.slice(0, 60),
    description,
    alternates: {
      canonical: article.seo?.canonical_url || `${SITE_URL}/tin_tuc/${article.slug}`,
    },
    openGraph: {
      title: pageTitle.slice(0, 60),
      description,
      url: `${SITE_URL}/tin_tuc/${article.slug}`,
      siteName: 'Maian Homes Enterprise',
      type: 'article',
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      authors: [article.author_name || 'Maian Homes'],
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle.slice(0, 60),
      description,
      images: [imageUrl],
    },
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getArticleDetail(slug);
  if (result.state === 'not-found') {
    notFound();
  }
  if (result.state === 'error') {
    throw articleUnavailable(result);
  }

  const data = result.data;
  const { article, linkedProject, relatedArticles, revisions } = data;
  const imageUrl = (article.gallery && article.gallery[0])
    ? (getAssetUrl(article.gallery[0].url) || `${SITE_URL}/images/default-project.jpg`)
    : `${SITE_URL}/images/default-project.jpg`;

  const articleStructuredData = buildArticleStructuredData(article, imageUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleStructuredData) }}
      />
      <ArticleDetailClient
        article={article}
        linkedProject={linkedProject}
        relatedArticles={relatedArticles}
        revisions={revisions}
      />
    </>
  );
}
