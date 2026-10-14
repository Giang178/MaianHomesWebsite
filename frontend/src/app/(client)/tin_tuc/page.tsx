export const revalidate = 300;

import { Metadata } from 'next';
import { connection } from 'next/server';
import NewsListClient, { ArticleItem } from '@/features/news/NewsListClient';
import PublicDataUnavailable from '@/components/system/PublicDataUnavailable';
import { fetchPublicJson, invalidPublicPayload, type PublicFetchResult } from '@/lib/public-fetch';
import { buildCmsMetadata, cmsGeoJsonLd, getPublicPage, pageText } from '@/features/website/public/page-content';

type PublicArticle = Partial<ArticleItem> & { _id?: string; created_at?: string };

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('news_index', {
    title: 'Tin Tức & Thị Trường Bất Động Sản',
    description: 'Cập nhật tin tức thị trường bất động sản hạng sang, thông tin dự án trọng điểm và phân tích chuyên sâu từ Maian Homes.',
    canonicalPath: '/tin_tuc',
  });
}

async function fetchPublicArticles(): Promise<PublicFetchResult<ArticleItem[]>> {
  const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const result = await fetchPublicJson<{ data?: PublicArticle[] }>(`${cleanBase}/api/public/articles?limit=50`, {
    cache: 'force-cache',
    next: { revalidate: 300, tags: ['articles'] },
    signal: AbortSignal.timeout(8000),
  });
  if (result.state !== 'ok') return result;
  if (!Array.isArray(result.data?.data)) return invalidPublicPayload(result);

  return {
    ...result,
    data: result.data.data.map((doc: PublicArticle) => ({
      id: doc.id || doc._id || '',
      title: doc.title || '',
      slug: doc.slug || '',
      category: doc.category || 'market',
      project_id: doc.project_id,
      sapo: doc.sapo || '',
      content: doc.content || '',
      featured_image_id: doc.featured_image_id,
      gallery: doc.gallery || [],
      published_at: doc.published_at || doc.created_at,
      updated_at: doc.updated_at,
      author_name: doc.author_name || 'Maian Homes',
      view_count: doc.view_count || 0,
    })),
  };
}

export default async function NewsPage() {
  await connection();
  const [result, page] = await Promise.all([fetchPublicArticles(), getPublicPage('news_index')]);
  if (result.state !== 'ok') {
    return (
      <main className="min-h-[70vh] bg-[#FAF9F6] px-6 py-32">
        <PublicDataUnavailable
          title="Chưa thể tải danh sách tin tức"
          requestId={result.requestId}
          status={result.status}
        />
      </main>
    );
  }
  const articles = result.data;
  const content = page?.content || {};
  const pageTitle = pageText(content, 'title', 'Tin Tức & Phân Tích');
  const pageDescription = pageText(content, 'description', 'Dữ liệu thị trường minh bạch, góc nhìn chuyên sâu và thông tin dự án bất động sản cao cấp được thẩm định bởi đội ngũ chuyên gia Maian Homes.');
  const cmsGeo = cmsGeoJsonLd(page, `${SITE_URL}/tin_tuc`, 'Tin Tức & Phân Tích');

  // Chuẩn bị cấu trúc JSON-LD Schema (SEO & GEO)
  const schemaOrgJSONLD = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Trang chủ",
            "item": `${SITE_URL}`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Tin tức",
            "item": `${SITE_URL}/tin_tuc`
          }
        ]
      },
      {
        "@type": "CollectionPage",
        "name": "Tin Tức & Thị Trường Bất Động Sản | Maian Homes",
        "description": "Cập nhật những chuyển động mới nhất của thị trường bất động sản hạng sang, thông tin dự án trọng điểm và phân tích chuyên sâu.",
        "url": `${SITE_URL}/tin_tuc`,
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": articles.slice(0, 10).map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "url": `${SITE_URL}/tin_tuc/${item.slug}`
          }))
        }
      }
    ]
  };

  return (
    <>
      {/* Tiêm JSON-LD Ẩn cho Bot Crawler & AI Answer Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJSONLD).replace(/</g, '\\u003c') }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(cmsGeo).replace(/</g, '\\u003c')}}/>
      <NewsListClient initialArticles={articles} pageTitle={pageTitle} pageDescription={pageDescription} />
    </>
  );
}
