import type { Metadata } from 'next';
import Image from 'next/image';
import { getAssetUrl } from '@/lib/api';
import { connection } from 'next/server';
import FeaturedProjectsSection from '@/components/home/FeaturedProjectsSection';
import { selectProjectCardImage } from '@/features/projects/project-card-data';
import WhyChooseMaian from '@/components/home/WhyChooseMaian';
import ConsultationProcess from '@/components/home/ConsultationProcess';
import PartnersSection from '@/components/home/PartnersSection';
import ContactFormSection from '@/components/home/ContactFormSection';
import TeamSection from '@/components/home/TeamSection';
import PublicDataUnavailable from '@/components/system/PublicDataUnavailable';
import { getPublicTeam, TeamApiError } from '@/features/team/api';
import { getPublicPage, pageText, publicMediaUrl } from '@/features/website/public/page-content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicPage('home');
  const title = pageText(page?.seo || {}, 'title', 'Maian Homes - Tư vấn đúng giá trị, chọn đúng bất động sản');
  const description = pageText(page?.seo || {}, 'description', 'Tư vấn dự án bất động sản cao cấp, căn hộ hạng sang tại TP.HCM. Liên hệ trực tiếp với Maian Homes.');
  const ogPath = '/images/banner_index.png';
  const ogUrl = ogPath.startsWith('http') ? ogPath : `${SITE_URL}${ogPath}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: pageText(page?.seo || {}, 'canonical_url', SITE_URL) },
    openGraph: {
      title, description, url: SITE_URL, siteName: 'Maian Homes',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
      locale: 'vi_VN', type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
    robots: pageText(page?.seo || {}, 'robots', 'index,follow'),
    other: {
      'geo.region': 'VN-SG',
      'geo.placename': 'Hồ Chí Minh',
      'geo.position': '10.771239;106.666991',
      ICBM: '10.771239, 106.666991',
    },
  };
}

interface DBProject {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  logo_url?: string;
  images?: string[];
  hero_images?: string[];
  marketing_tags?: string[];
  location?: string;
  status?: string;
  price_range?: string;
  is_featured?: boolean;
}

interface NormalizedProject {
  id: string;
  name: string;
  slug: string;
  shortDesc: string;
  location: string;
  image: string;
  status: string;
  priceRange: string;
  isFeatured?: boolean;
}

async function getMergedProjects() {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    const res = await fetch(`${cleanBase}/api/public/projects?view=summary&is_featured=true`, {
      cache: 'force-cache',
      next: { revalidate: 300, tags: ['projects'] },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`API Warning (${res.status}): Unable to load public projects`);
      return { projects: [], error: true };
    }
    const resData = await res.json();
    const dbProjects: DBProject[] = resData.data || [];

    // Chỉ cho phép hiển thị các dự án có phân loại là dự án nổi bật (is_featured: true)
    const strictlyFeatured = dbProjects.filter(p => p.is_featured === true);

    const dbProjNormalized: NormalizedProject[] = strictlyFeatured.map((p) => {
      const imgPath = selectProjectCardImage(p);
      return {
        id: p._id || p.id || '',
        name: p.name,
        slug: p.slug,
        shortDesc: p.marketing_tags?.[0] || 'Căn hộ cao cấp',
        location: p.location || '',
        image: getAssetUrl(imgPath) || '/images/default-project.jpg',
        status: p.status || 'AVAILABLE',
        priceRange: p.price_range || '',
        isFeatured: true,
      };
    });

    const combined: NormalizedProject[] = [];
    for (const p of dbProjNormalized) {
      if (!combined.some(c => c.slug === p.slug)) {
        combined.push(p);
      }
    }
    // Giới hạn tối đa 3 dự án nổi bật
    return { projects: combined.slice(0, 3), error: false };
  } catch (err) {
    console.warn('Timeout or network issue fetching public projects, falling back to empty list:', err instanceof Error ? err.message : err);
    return { projects: [], error: true };
  }
}

async function getHomeTeam() {
  try {
    const featured = await getPublicTeam({ featured: true, limit: 4 });
    const data = featured.data.length > 0
      ? featured
      : await getPublicTeam({ home: true, limit: 4 });
    return { data, failure: null };
  } catch (error) {
    const apiError = error instanceof TeamApiError ? error : null;
    return {
      data: { data: [], total: 0 },
      failure: {
        status: apiError?.status,
        requestId: apiError?.requestId,
      },
    };
  }
}

export default async function Home() {
  await connection();
  const [{ projects: mergedProjects, error }, teamResult, cmsPage] = await Promise.all([
    getMergedProjects(),
    getHomeTeam(),
    getPublicPage('home'),
  ]);
  const content = cmsPage?.content || {};
  const heroImage = publicMediaUrl(content.hero_media_id, '/images/banner_sec1.png');
  const contactBanner = publicMediaUrl(content.contact_banner_media_id, '/images/banner_sec.png');
  const heroEyebrow = pageText(content, 'hero_eyebrow', 'Maian Homes');
  const heroTitleLine1 = pageText(content, 'hero_title_line_1', 'TƯ VẤN ĐÚNG GIÁ TRỊ');
  const heroTitleLine2 = pageText(content, 'hero_title_line_2', 'CHỌN ĐÚNG BẤT ĐỘNG SẢN');
  const heroDescription = pageText(content, 'hero_description', 'Maian Homes - Không bán điều chúng tôi có · Tư vấn điều khách hàng thực sự cần');
  const heroCtaLabel = pageText(content, 'hero_cta_label', 'Khám Phá Dự Án');
  const heroCtaHref = pageText(content, 'hero_cta_href', '#du-an');
  const featuredProjectsTitle = pageText(content, 'featured_projects_title', 'Dự Án Nổi Bật');
  const featuredProjectsDescription = pageText(content, 'featured_projects_description', 'Tuyển tập những dự án bất động sản cao cấp sở hữu vị trí đắc địa, pháp lý hoàn chỉnh và tiềm năng sinh lời vượt trội được bảo chứng bởi Maian Homes.');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}`,
        name: 'Maian Homes',
        description: 'Tư vấn bất động sản cao cấp tại TP.HCM và các tỉnh miền Nam',
        inLanguage: 'vi-VN',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/du_an?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: `${SITE_URL}`,
        name: 'Maian Homes - Tư vấn đúng giá trị chọn đúng bất động sản',
        description: 'Tư vấn dự án bất động sản cao cấp tại TP.HCM. Liên hệ trực tiếp với Maian Homes.',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'vi-VN',
        breadcrumb: {
          '@type': 'BreadcrumbList',
          '@id': `${SITE_URL}/#breadcrumb`,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Trang chủ',
              item: `${SITE_URL}`,
            },
          ],
        },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/images/banner_sec1.png`,
          width: 1200,
          height: 630,
        },
      },
      {
        '@type': ['Organization', 'RealEstateAgent'],
        '@id': `${SITE_URL}/#organization`,
        name: 'Maian Homes',
        legalName: 'CÔNG TY TNHH MAIAN HOMES',
        alternateName: 'Maian Homes Enterprise',
        url: `${SITE_URL}`,
        logo: {
          '@type': 'ImageObject',
          '@id': `${SITE_URL}/#logo`,
          url: `${SITE_URL}/images/logo_final_transparent.png`,
          width: 350,
          height: 130,
          caption: 'Maian Homes Logo',
        },
        image: { '@id': `${SITE_URL}/#logo` },
        taxID: '0319287798',
        priceRange: '$$$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Số 606/62 đường 3 Tháng 2, Phường Diên Hồng',
          addressLocality: 'TP. Hồ Chí Minh',
          addressRegion: 'Hồ Chí Minh',
          postalCode: '700000',
          addressCountry: 'VN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 10.771239,
          longitude: 106.666991,
        },
        hasMap: 'https://maps.google.com/?q=10.771239,106.666991',
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            opens: '08:30',
            closes: '17:30',
          },
        ],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            areaServed: 'VN',
            availableLanguage: ['Vietnamese', 'English'],
            contactOption: 'TollFree',
          },
          {
            '@type': 'ContactPoint',
            contactType: 'sales',
            areaServed: 'TP. Hồ Chí Minh',
            availableLanguage: ['Vietnamese', 'English'],
          },
        ],
        areaServed: [
          { '@type': 'AdministrativeArea', name: 'TP. Hồ Chí Minh' },
          { '@type': 'AdministrativeArea', name: 'Thủ Đức' },
          { '@type': 'AdministrativeArea', name: 'Quận 1' },
          { '@type': 'AdministrativeArea', name: 'Quận 2' },
          { '@type': 'AdministrativeArea', name: 'Quận 7' },
          { '@type': 'AdministrativeArea', name: 'Bình Dương' },
          { '@type': 'AdministrativeArea', name: 'Đồng Nai' },
          { '@type': 'AdministrativeArea', name: 'Long An' },
        ],
        knowsAbout: [
          'Bất động sản cao cấp',
          'Căn hộ hạng sang',
          'Tư vấn đầu tư bất động sản',
          'Dự án căn hộ TP.HCM',
          'Masterise Homes',
          'The Global City',
          'Grand Marina Saigon',
        ],
        sameAs: [
          `${SITE_URL}`,
        ],
      },
      ...(mergedProjects.length > 0
        ? [
            {
              '@type': 'ItemList',
              '@id': `${SITE_URL}/#featured-projects`,
              name: 'Dự án bất động sản nổi bật',
              numberOfItems: mergedProjects.length,
              itemListElement: mergedProjects.map((p, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                name: p.name,
                url: `${SITE_URL}/du_an/${p.slug}`,
                image: p.image.startsWith('http') ? p.image : `${SITE_URL}${p.image}`,
                description: p.shortDesc || p.name,
              })),
            },
          ]
        : []),
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Maian Homes tư vấn những dự án bất động sản nào?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Maian Homes chuyên tư vấn các dự án căn hộ cao cấp và hạng sang tại TP.HCM và các tỉnh lân cận như Bình Dương, Đồng Nai từ các chủ đầu tư lớn như Masterise Homes, Vingroup, Keppel Land, Gamuda Land, CapitaLand.',
            },
          },
          {
            '@type': 'Question',
            name: 'Quy trình tư vấn mua căn hộ của Maian Homes như thế nào?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Quy trình gồm 4 bước: (1) Tiếp nhận nhu cầu và ngân sách; (2) Phân tích và đề xuất dự án phù hợp; (3) Sắp xếp tham quan, trải nghiệm căn hộ mẫu; (4) Hỗ trợ ký kết và đồng hành sau giao dịch.',
            },
          },
          {
            '@type': 'Question',
            name: 'Hotline liên hệ tư vấn bất động sản Maian Homes là bao nhiêu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Quý khách có thể liên hệ Maian Homes qua Hotline hotline hỗ trợ (tất cả các ngày trong tuần, 8:30 – 17:30) hoặc gửi email về email hỗ trợ.',
            },
          },
          {
            '@type': 'Question',
            name: 'Căn hộ hạng sang tại TP.HCM giá bao nhiêu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Giá căn hộ cao cấp tại TP.HCM từ các dự án Maian Homes tư vấn dao động từ 3 tỷ đến hơn 20 tỷ đồng tùy dự án, vị trí, diện tích và chủ đầu tư. Liên hệ Maian Homes để nhận bảng giá mới nhất.',
            },
          },
          {
            '@type': 'Question',
            name: 'Maian Homes có hỗ trợ vay mua nhà không?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Có, Maian Homes hỗ trợ khách hàng tư vấn các gói vay mua căn hộ với lãi suất ưu đãi từ các ngân hàng đối tác, cùng các chính sách thanh toán linh hoạt theo tiến độ xây dựng.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="homepage-root overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      {/* Hero Section - Phong cách Maian */}
      <section className="relative h-screen min-[1368px]:h-[110vh] min-[1368px]:min-h-[900px] flex flex-col justify-between overflow-hidden pt-16 sm:pt-20 md:pt-24 lg:pt-24 min-[1368px]:pt-28">
        {/* Background Image */}
        <div className="absolute inset-0 z-0 bg-black">
          <Image
            src={heroImage}
            alt="Kiệt tác bất động sản cao cấp Maian Homes"
            fill
            sizes="100vw"
            quality={75}
            preload
            className="pointer-events-none object-cover object-[50%_25%] sm:object-center lg:object-[50%_35%] min-[1368px]:object-center animate-in fade-in duration-1000 transform scale-105 transition-transform duration-[10000ms] ease-out"
          />
          {/* Overlay to ensure text readability */}
          <div className="absolute inset-0 bg-black/50 sm:bg-black/40 bg-gradient-to-t from-black via-black/30 sm:via-transparent to-black/70 sm:to-black/60"></div>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-5xl">
            <div className="uppercase tracking-[0.25em] sm:tracking-[0.35em] text-[#D4AF37] text-xs sm:text-sm min-[1368px]:text-sm mb-4 sm:mb-6 font-medium animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {heroEyebrow}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-5xl min-[1368px]:text-6xl font-bold leading-[1.25] sm:leading-[1.15] lg:leading-[1.12] mb-4 sm:mb-6 tracking-tight text-balance animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              {heroTitleLine1} <br />
              <span className="text-preserve inline-block text-3xl sm:text-5xl md:text-6xl lg:text-6xl min-[1368px]:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] tracking-normal leading-tight py-1 sm:py-2">
                {heroTitleLine2}
              </span>
            </h1>
            <p className="text-preserve text-xs sm:text-base lg:text-lg min-[1368px]:text-xl text-gray-200 max-w-2xl mx-auto mb-6 sm:mb-8 lg:mb-10 px-2 font-light tracking-normal leading-relaxed text-pretty animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              {heroDescription}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
              <a href={heroCtaHref} className="group relative overflow-hidden bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] w-fit mx-auto sm:mx-0 px-6 py-2 sm:px-7 sm:py-2.5 rounded-full font-bold hover:shadow-[0_0_25px_rgba(212,175,55,0.55)] transition-all duration-300 text-xs sm:text-sm tracking-wide whitespace-nowrap" aria-label={heroCtaLabel}>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {heroCtaLabel}
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 h-full w-full bg-white/30 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out skew-x-12 z-0"></div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Dự án nổi bật */}
      <section id="du-an" className="scroll-mt-20 pt-12 sm:pt-16 lg:pt-16 min-[1368px]:pt-20 pb-10 sm:pb-14 lg:pb-16 bg-[#FAF9F5] text-slate-900 relative">
        <span id="can-ho-chuyen-nhuong" className="absolute -top-20 left-0 w-full h-1 invisible pointer-events-none"></span>
        <div className="w-full max-w-[96%] xl:max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="text-center mb-7 sm:mb-9 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <h2 className="text-preserve text-2xl sm:text-3xl lg:text-4xl min-[1368px]:text-4xl font-serif font-bold tracking-tight text-slate-900 mb-2 sm:mb-3 uppercase leading-snug">
              <span className="text-preserve inline-block py-1 text-transparent bg-clip-text bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#AA771C]">
                {featuredProjectsTitle}
              </span>
            </h2>
            <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#D4AF37]"></div>
              <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]"></div>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#D4AF37]"></div>
            </div>
            <p className="text-slate-600 text-xs sm:text-sm lg:text-sm min-[1368px]:text-base font-light leading-relaxed max-w-2xl mx-auto text-pretty">
              {featuredProjectsDescription}
            </p>
          </div>

          <FeaturedProjectsSection projects={mergedProjects} error={error} />
        </div>
      </section>

      {/* Why Choose Maian Section */}
      <WhyChooseMaian />

      {teamResult.failure ? (
        <section className="bg-white px-6 py-16">
          <PublicDataUnavailable
            title="Chưa thể tải thông tin đội ngũ"
            requestId={teamResult.failure.requestId}
            status={teamResult.failure.status}
          />
        </section>
      ) : (
        <TeamSection members={teamResult.data.data} />
      )}

      {/* Consultation Process Section */}
      <ConsultationProcess />

      {/* Partners & Developers Section */}
      <PartnersSection />

      {/* Contact Consultation Form Section */}
      <ContactFormSection projects={mergedProjects} backgroundImage={contactBanner} />
    </div>
  );
}
