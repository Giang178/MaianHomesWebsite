type Faq = { question: string; answer: string };

type ArticleStructuredDataInput = {
  title: string;
  slug: string;
  sapo?: string;
  published_at?: string;
  updated_at?: string;
  author_name?: string;
  geo?: {
    answer_summary?: string;
    key_facts?: string[];
    faqs?: Faq[];
    sources?: Array<{ title: string; url: string }>;
  };
};

type ProjectStructuredDataInput = {
  name: string;
  slug: string;
  description?: string;
  developer?: string;
  location?: string;
  price_range?: string;
  latitude?: number;
  longitude?: number;
  amenities?: unknown[];
  updated_at?: string;
  seo_metadata?: {
    cornerstone_text?: string;
    usps?: string[];
    key_facts?: string[];
    faqs?: Faq[];
    sources?: Array<{ title: string; url: string }>;
  };
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

const faqPage = (faqs: Faq[] = []) =>
  faqs.length
    ? {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }
    : null;

export const buildArticleStructuredData = (
  article: ArticleStructuredDataInput,
  imageUrl: string,
) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.geo?.answer_summary || article.sapo,
      abstract: article.geo?.answer_summary || article.sapo,
      image: [imageUrl],
      datePublished: article.published_at,
      dateModified: article.updated_at || article.published_at,
      keywords: article.geo?.key_facts,
      citation: article.geo?.sources?.map((source) => source.url),
      author: [
        {
          '@type': 'Person',
          name: article.author_name || 'Maian Homes Editorial Team',
          url: SITE_URL,
        },
      ],
      publisher: {
        '@type': 'Organization',
        name: 'Maian Homes Enterprise',
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/images/logo_final.png`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/tin_tuc/${article.slug}`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Trang chủ',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Tin tức',
          item: `${SITE_URL}/tin_tuc`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: `${SITE_URL}/tin_tuc/${article.slug}`,
        },
      ],
    },
    faqPage(article.geo?.faqs),
  ].filter(Boolean),
});

export const buildProjectStructuredData = (
  project: ProjectStructuredDataInput,
  heroImage: string,
) => {
  const structuredImage = heroImage.startsWith('/')
    ? `${SITE_URL}${heroImage}`
    : heroImage;

  const amenityList = Array.isArray(project.amenities)
    ? project.amenities.map((a) => ({
        '@type': 'LocationFeatureSpecification',
        name: typeof a === 'string' ? a : (a as { name?: string })?.name || '',
        value: true,
      })).filter((a) => a.name)
    : [];

  const defaultFaqs: Faq[] = [
    {
      question: `Vị trí chính xác dự án ${project.name} ở đâu?`,
      answer: `${project.name} tọa lạc tại vị trí đắc địa ${project.location || 'mặt tiền đường Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh'}, kết nối trực tiếp đến khu đô thị mới Thủ Thiêm và Trung tâm Quận 1 chỉ trong 10-15 phút di chuyển.`,
    },
    {
      question: `Giá bán và chính sách thanh toán căn hộ ${project.name} như thế nào?`,
      answer: `Giá bán dự án ${project.name} dao động từ ${project.price_range || '120 - 135 triệu/m²'}. Chủ đầu tư hỗ trợ chính sách thanh toán linh hoạt chỉ 5% mỗi đợt, ngân hàng đối tác hỗ trợ vay đến 70% giá trị căn hộ với ưu đãi ân hạn nợ gốc và lãi suất 0% đến khi nhận nhà.`,
    },
    {
      question: `Thời gian dự kiến bàn giao căn hộ ${project.name} là khi nào?`,
      answer: `Dự án dự kiến cất nóc và bàn giao vào Quý IV/2026. Tiến độ thi công hiện đang được đẩy nhanh đảm bảo tiêu chuẩn chất lượng cao nhất.`,
    },
    {
      question: `Pháp lý dự án ${project.name} hiện tại ra sao?`,
      answer: `Dự án sở hữu pháp lý hoàn chỉnh với quy hoạch chi tiết 1/500 và giấy phép xây dựng. Khách hàng người Việt Nam được sở hữu lâu dài (sổ hồng), người nước ngoài sở hữu 50 năm theo quy định pháp luật.`,
    },
  ];

  const effectiveFaqs: Faq[] = [
    ...(project.seo_metadata?.faqs && project.seo_metadata.faqs.length > 0
      ? project.seo_metadata.faqs
      : defaultFaqs),
  ];
  if (effectiveFaqs.length > 0 && effectiveFaqs.length < 4) {
    const hasHandover = effectiveFaqs.some(f => f.question.toLowerCase().includes('bàn giao') || f.question.toLowerCase().includes('tiến độ'));
    if (!hasHandover) {
      effectiveFaqs.push({
        question: `Thời gian dự kiến bàn giao căn hộ ${project.name} là khi nào?`,
        answer: `Dự án dự kiến cất nóc và bàn giao vào Quý IV/2026. Tiến độ thi công hiện đang được đẩy nhanh đảm bảo tiêu chuẩn chất lượng cao nhất.`,
      });
    }
  }

  const tldrSummary =
    project.seo_metadata?.cornerstone_text ||
    `Tóm tắt dự án ${project.name}: Tổ hợp căn hộ cao cấp tại ${project.location || 'TP. Thủ Đức, TP.HCM'}, phát triển bởi ${project.developer || 'chủ đầu tư uy tín'}. Mức giá tham chiếu ${project.price_range || 'từ 120 triệu/m²'}, pháp lý minh bạch sở hữu lâu dài.`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        '@id': `${SITE_URL}/du_an/${project.slug}#listing`,
        url: `${SITE_URL}/du_an/${project.slug}`,
        name: project.name,
        description: tldrSummary,
        abstract: tldrSummary,
        disambiguatingDescription: tldrSummary,
        image: structuredImage,
        dateModified: project.updated_at,
        about: project.seo_metadata?.usps?.join(', ') || `Căn hộ cao cấp ${project.name}`,
        keywords: project.seo_metadata?.key_facts || [project.name, project.location, 'Căn hộ cao cấp', project.developer].filter(Boolean),
        citation: project.seo_metadata?.sources?.map((source) => source.url),
        address: {
          '@type': 'PostalAddress',
          streetAddress: project.location || 'TP. Hồ Chí Minh',
          addressLocality: 'Hồ Chí Minh',
          addressRegion: 'Thành phố Hồ Chí Minh',
          addressCountry: 'VN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: project.latitude || 10.7769,
          longitude: project.longitude || 106.7009,
        },
        ...(project.price_range ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'VND',
            price: project.price_range,
          },
        } : {}),
        ...(amenityList.length ? { amenityFeature: amenityList } : {}),
        provider: {
          '@type': 'Organization',
          name: project.developer || 'Maian Homes',
          url: SITE_URL,
          sameAs: [
            'https://www.facebook.com/maianhomes',
            'https://www.youtube.com/@maianhomes',
            'https://www.tiktok.com/@maianhomes',
            'https://www.instagram.com/maianhomes',
          ],
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Trang chủ',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Danh mục dự án',
            item: `${SITE_URL}/du_an`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: project.name,
            item: `${SITE_URL}/du_an/${project.slug}`,
          },
        ],
      },
      faqPage(effectiveFaqs),
    ].filter(Boolean),
  };
};

export const safeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');
