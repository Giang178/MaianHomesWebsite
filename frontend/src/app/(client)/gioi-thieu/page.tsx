import { Metadata } from 'next';
import Image from 'next/image';
import { ShieldCheck, GraduationCap, Users2, Sparkles } from 'lucide-react';
import {
  buildCmsMetadata,
  getPublicPage,
  getPublishedCompanyKnowledge,
  pageText,
  publicMediaUrl,
} from '@/features/website/public/page-content';

const SITE_URL = 'https://maianhomes.vn';
const ABOUT_URL = `${SITE_URL}/gioi-thieu`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const ABOUT_PAGE_ID = `${ABOUT_URL}/#webpage`;
const LOGO_URL = `${SITE_URL}/images/logo_final.png`;
const ABOUT_IMAGE_URL = `${SITE_URL}/images/banner_gioithieu.jpg`;
const CONTACT_PHONE_SCHEMA = '+84 969 10 50 59';
const CONTACT_EMAIL = 'maianhomes.vn@gmail.com';
const LAST_MODIFIED = '2026-07-09';

type CmsSection = {title: string; content: string};

function sectionList(content: Record<string, unknown>, key: string): CmsSection[] {
  const value = content[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CmsSection => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.title === 'string' && Boolean(record.title.trim())
      && typeof record.content === 'string' && Boolean(record.content.trim());
  });
}

const fallbackMetadata: Metadata = {
  title: {
    absolute: 'Giới thiệu Maian Homes - Bất động sản cao cấp TP.HCM',
  },
  description: 'Maian Homes là đơn vị tư vấn, phân phối, ký gửi và đầu tư bất động sản cao cấp tại TP.HCM, hoạt động dựa trên giá trị cốt lõi Tâm - Tín.',
  keywords: [
    'Maian Homes',
    'giới thiệu Maian Homes',
    'bất động sản cao cấp TP.HCM',
    'môi giới bất động sản',
    'phân phối dự án',
    'ký gửi bất động sản',
    'đầu tư bất động sản cao cấp'
  ],
  openGraph: {
    title: 'Giới thiệu Maian Homes - Bất động sản cao cấp TP.HCM',
    description: 'Tìm hiểu sứ mệnh, dịch vụ, giá trị cốt lõi, văn hóa doanh nghiệp và đối tác chiến lược của Maian Homes.',
    url: ABOUT_URL,
    siteName: 'Maian Homes',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: ABOUT_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'Giới thiệu Maian Homes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Giới thiệu Maian Homes - Bất động sản cao cấp TP.HCM',
    description: 'Tìm hiểu sứ mệnh, dịch vụ, giá trị cốt lõi, văn hóa doanh nghiệp và đối tác chiến lược của Maian Homes.',
    images: [ABOUT_IMAGE_URL],
  },
  alternates: {
    canonical: ABOUT_URL,
  },
};
void fallbackMetadata;
export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('about', {title: 'Giới thiệu Maian Homes - Bất động sản cao cấp TP.HCM', description: 'Maian Homes là đơn vị tư vấn, phân phối, ký gửi và đầu tư bất động sản cao cấp tại TP.HCM.', canonicalPath: '/gioi-thieu', image: '/images/banner_gioithieu.jpg'});
}

export default async function AboutUsPage() {
  const [page, company] = await Promise.all([getPublicPage('about'), getPublishedCompanyKnowledge()]);
  const content = page?.content || {};
  const heroImage = publicMediaUrl(content.hero_media_id, '/images/banner.jpg');
  const storyImage = publicMediaUrl(content.story_media_id, '/images/banner_gioithieu.jpg');
  const cultureImage = publicMediaUrl(content.culture_media_id, '/images/Global/culture_banner.png');
  const storyTitle = pageText(content, 'story_title', '');
  const storyContent = pageText(content, 'story_content', '');
  const introSummary = pageText(content, 'intro_summary', '');
  const missionLabel = pageText(content, 'mission_label', '');
  const coreEyebrow = pageText(content, 'core_eyebrow', '');
  const coreTitle = pageText(content, 'core_title', '');
  const coreValues = sectionList(content, 'core_values');
  const coreValueImages = [
    '/images/partner/about_1.jpg',
    '/images/partner/about_3.jpg',
    '/images/partner/about_tantam.jpg',
    '/images/partner/about_2.jpg',
  ];
  const cultureEyebrow = pageText(content, 'culture_eyebrow', '');
  const cultureTitle = pageText(content, 'culture_title', '');
  const cultureContent = pageText(content, 'culture_content', '');
  const cultureValues = sectionList(content, 'culture_values');
  const partnersEyebrow = pageText(content, 'partners_eyebrow', '');
  const partnersTitle = pageText(content, 'partners_title', '');
  const philosophyEyebrow = pageText(content, 'philosophy_eyebrow', '');
  const philosophyTitle = pageText(content, 'philosophy_title', '');
  const philosophyQuote = pageText(content, 'philosophy_quote', '');
  const philosophyPoints = sectionList(content, 'philosophy_points');
  const faqList = company?.faqs || [];
  const companyName = company?.company_name?.trim() || 'Maian Homes';
  const companyOverview = company?.overview?.trim() || '';

  // Schema.org tối ưu SEO & GEO cho doanh nghiệp bất động sản
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: companyName,
        url: SITE_URL,
        inLanguage: 'vi-VN',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${ABOUT_URL}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Giới thiệu', item: ABOUT_URL }
        ]
      },
      {
        '@type': ['RealEstateAgent', 'Organization'],
        '@id': ORGANIZATION_ID,
        name: companyName,
        legalName: 'CÔNG TY TNHH MAIAN HOMES',
        url: SITE_URL,
        logo: LOGO_URL,
        image: LOGO_URL,
        description: companyOverview,
        telephone: CONTACT_PHONE_SCHEMA,
        email: CONTACT_EMAIL,
        taxID: '0319287798',
        identifier: {
          '@type': 'PropertyValue',
          name: 'Mã số thuế',
          value: '0319287798'
        },
        priceRange: '$$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Số 606/62 đường 3 Tháng 2, Phường Diên Hồng',
          addressLocality: 'TP. Hồ Chí Minh',
          addressRegion: 'Hồ Chí Minh',
          postalCode: '700000',
          addressCountry: 'VN'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 10.771239,
          longitude: 106.666991
        },
        openingHours: 'Mo-Sa 08:30-17:30',
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            opens: '08:30',
            closes: '17:30'
          }
        ],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            telephone: CONTACT_PHONE_SCHEMA,
            email: CONTACT_EMAIL,
            contactType: 'customer service',
            areaServed: 'VN',
            availableLanguage: ['vi-VN', 'vi']
          },
          {
            '@type': 'ContactPoint',
            telephone: CONTACT_PHONE_SCHEMA,
            email: CONTACT_EMAIL,
            contactType: 'sales',
            areaServed: 'TP. Hồ Chí Minh',
            availableLanguage: ['vi-VN', 'vi']
          }
        ],
        areaServed: (company?.service_areas?.length ? company.service_areas : ['TP. Hồ Chí Minh'])
          .map(name => ({ '@type': 'AdministrativeArea', name })),
        knowsAbout: company?.services?.length ? company.services : [
          'Bất động sản cao cấp',
          'Tư vấn đầu tư bất động sản',
          'Phân phối dự án bất động sản',
          'Ký gửi bất động sản',
          'Quản lý tài sản bất động sản'
        ],
        sameAs: [
          'https://www.facebook.com/MaianHomes',
          'https://www.instagram.com/maianhomes',
          'https://www.tiktok.com/@maianhomes'
        ]
      },
      {
        '@type': 'AboutPage',
        '@id': ABOUT_PAGE_ID,
        url: ABOUT_URL,
        name: 'Giới thiệu Maian Homes',
        description: 'Trang giới thiệu sứ mệnh, dịch vụ, giá trị cốt lõi, văn hóa doanh nghiệp và đối tác chiến lược của Maian Homes.',
        inLanguage: 'vi-VN',
        dateModified: LAST_MODIFIED,
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORGANIZATION_ID },
        mainEntity: { '@id': ORGANIZATION_ID },
        breadcrumb: { '@id': `${ABOUT_URL}/#breadcrumb` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: ABOUT_IMAGE_URL,
          width: 1200,
          height: 630
        }
      },
      {
        '@type': 'FAQPage',
        '@id': `${ABOUT_URL}/#faq`,
        inLanguage: 'vi-VN',
        isPartOf: { '@id': ABOUT_PAGE_ID },
        mainEntity: faqList.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      }
    ]
  };

  return (
    <main className="bg-white selection:bg-[#D4AF37] selection:text-white pb-0 pt-[var(--navbar-h,61px)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <h1 className="sr-only">Giới thiệu Maian Homes</h1>

      {/* 1. HERO BANNER - Tối ưu Next.js Image & LCP Performance */}
      <section className="relative w-full h-[200px] min-[400px]:h-[230px] min-[500px]:h-[270px] sm:h-[320px] md:h-[400px] lg:h-[470px] xl:h-[540px] min-[1367px]:h-[600px] 2xl:h-[700px] overflow-hidden bg-slate-900">
        <Image
          src={heroImage}
          alt="Giới thiệu Maian Homes"
          fill
          priority
          quality={90}
          className="object-cover object-left lg:object-center [image-rendering:-webkit-optimize-contrast]"
          sizes="100vw"
        />
      </section>

      {/* Answer-Engine Ready Summary Snippet cho AI Search */}
      <section className="bg-[#FAF8F2] border-b border-[#E5E2D9] py-4 px-4 sm:py-5 sm:px-6 md:py-6 md:px-10 lg:px-16 xl:px-12 min-[1367px]:px-20">
        <div className="mx-auto max-w-4xl min-[1367px]:max-w-5xl text-left sm:text-center">
          <p className="text-sm sm:text-base font-serif text-[#2D1B14] leading-7 sm:leading-8 md:leading-relaxed italic">
            {introSummary}
          </p>
        </div>
      </section>

      {/* 2. INTRODUCTION (SỨ MỆNH & DỊCH VỤ) */}
      <section className="bg-white py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 xl:px-8 min-[1367px]:px-16 2xl:py-16 2xl:px-0">
        <div className="mx-auto max-w-6xl xl:max-w-7xl min-[1367px]:max-w-screen-xl 2xl:max-w-screen-2xl grid grid-cols-1 gap-10 md:gap-12 lg:grid-cols-2 lg:gap-14 xl:gap-16 2xl:gap-24 items-center">
          <div className="space-y-6 md:space-y-8 2xl:space-y-12 lg:flex lg:flex-col lg:justify-center">
            <div>
              <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-2 md:mb-3 block">Maian Homes</span>
              <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl xl:text-[2rem] min-[1367px]:text-[2.25rem] 2xl:text-[2.5rem] font-bold text-[#1A1A1A] font-serif uppercase tracking-wide leading-tight">{storyTitle}</h2>
            </div>

            <div className="space-y-6 md:space-y-8 2xl:space-y-10 text-gray-600 leading-7 md:leading-8 lg:leading-loose text-left md:text-justify font-light text-sm sm:text-base md:text-lg 2xl:text-xl">
              <div className="border-l-2 border-[#D4AF37] pl-6 2xl:pl-8">
                <h3 className="text-lg md:text-xl 2xl:text-2xl font-bold text-[#1A1A1A] mb-2 md:mb-3 2xl:mb-4 font-serif uppercase tracking-wider">{missionLabel}</h3>
                <p className="whitespace-pre-line">{storyContent}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end items-center mt-2 sm:mt-4 lg:mt-0">
            <div className="relative w-full max-w-[340px] sm:max-w-[400px] md:max-w-[440px] lg:max-w-[460px] xl:max-w-[500px] min-[1367px]:max-w-[520px] 2xl:max-w-[560px] aspect-[3/4] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100 bg-slate-100 group">
            <Image
              src={storyImage}
              alt="Đại diện thương hiệu Maian Homes"
              fill
              quality={90}
              sizes="(min-width: 1536px) 560px, (min-width: 1367px) 520px, (min-width: 1280px) 500px, (min-width: 1024px) 460px, (min-width: 768px) 440px, (min-width: 640px) 400px, 340px"
              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105 [image-rendering:-webkit-optimize-contrast]"
              priority
            />
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE VALUES */}
      <section className="bg-[#F9F9F9] py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 xl:px-8 min-[1367px]:px-16 2xl:py-16 2xl:px-0 border-t border-gray-200">
        <div className="mx-auto max-w-6xl xl:max-w-7xl min-[1367px]:max-w-screen-xl 2xl:max-w-screen-2xl">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-2 md:mb-3 block">{coreEyebrow}</span>
            <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl xl:text-[2rem] min-[1367px]:text-[2.25rem] 2xl:text-[2.5rem] font-bold text-[#1A1A1A] font-serif uppercase tracking-wide leading-tight">{coreTitle}</h2>
            <div className="w-16 h-[2px] bg-[#D4AF37] mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6 md:gap-8 xl:gap-5 min-[1367px]:gap-6 2xl:gap-12">
            {coreValues.map((value, index) => (
              <div key={value.title} className="bg-white p-5 sm:p-6 md:p-7 xl:p-5 min-[1367px]:p-7 2xl:p-10 rounded-xl md:rounded-2xl shadow-lg border border-gray-100 hover:border-[#D4AF37] transition-all duration-500 hover:-translate-y-1 md:hover:-translate-y-2 group flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <h3 className="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold text-[#1A1A1A] font-serif uppercase tracking-wide leading-snug">{value.title}</h3>
                  <div className="text-[#D4AF37] font-serif text-3xl sm:text-4xl 2xl:text-5xl opacity-30 group-hover:opacity-100 transition-opacity duration-500">{String(index + 1).padStart(2, '0')}</div>
                </div>
                <div className="w-full aspect-[16/10] relative overflow-hidden rounded-xl mb-5 md:mb-6 bg-slate-100">
                  <Image
                    src={coreValueImages[index] || '/images/partner/about_1.jpg'}
                    alt={value.title}
                    fill
                    quality={90}
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700 [image-rendering:-webkit-optimize-contrast]"
                  />
                </div>
                <p className="text-gray-600 leading-6 md:leading-relaxed font-light text-sm md:text-[15px] xl:text-base 2xl:text-lg flex-grow text-left sm:text-justify">{value.content}</p>
                <div className="w-12 h-[2px] bg-[#D4AF37] mt-6 2xl:mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* 3.5. CORPORATE CULTURE */}
      <section id="culture" className="bg-[#FAF8F2] py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 xl:px-8 min-[1367px]:px-16 2xl:py-16 2xl:px-0 border-t border-[#E5E2D9]">
        <div className="mx-auto max-w-6xl xl:max-w-7xl min-[1367px]:max-w-screen-xl 2xl:max-w-screen-2xl grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 lg:gap-14 xl:gap-16 2xl:gap-24 items-center lg:items-stretch">
          <div className="relative order-2 lg:order-1 px-0 sm:px-6 md:px-10 lg:px-0 w-full h-[300px] sm:h-[360px] md:h-[460px] lg:h-auto lg:min-h-[440px] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900">
            <Image src={cultureImage} alt="Văn hóa doanh nghiệp Maian Homes" fill quality={90} sizes="(min-width: 1536px) 48vw, (min-width: 1024px) 44vw, 100vw" className="object-cover object-center relative z-10 [image-rendering:-webkit-optimize-contrast]" />
          </div>
          <div className="order-1 lg:order-2 space-y-6 md:space-y-8 2xl:space-y-12 lg:flex lg:flex-col lg:justify-center">
            <div>
              <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-2 md:mb-3 block">{cultureEyebrow}</span>
              <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl xl:text-[2rem] min-[1367px]:text-[2.25rem] 2xl:text-[2.5rem] font-bold text-[#1A1A1A] font-serif uppercase tracking-wide leading-tight">{cultureTitle}</h2>
            </div>
            <p className="text-gray-600 font-light text-sm sm:text-base md:text-lg 2xl:text-xl leading-7 md:leading-8 lg:leading-loose text-left md:text-justify">{cultureContent}</p>
            <div className="space-y-6">
              {cultureValues.map((value, index) => {
                const Icon = [ShieldCheck, GraduationCap, Users2, Sparkles][index % 4];
                return (
                  <div key={value.title} className="flex gap-4 items-start">
                    <div className="p-3 bg-[#D4AF37]/10 rounded-xl text-[#D4AF37] mt-1 shrink-0"><Icon className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold text-[#1A1A1A] font-serif uppercase tracking-wider mb-1">{value.title}</h3>
                      <p className="text-gray-500 font-light text-xs sm:text-sm md:text-base 2xl:text-lg leading-relaxed text-justify">{value.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {/* 3.6. STRATEGIC PARTNERS (ĐỐI TÁC CHIẾN LƯỢC) */}
      <section className="bg-white py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 xl:px-8 min-[1367px]:px-16 2xl:py-16 2xl:px-0 border-t border-gray-200 overflow-hidden">
        <style>{`
          @keyframes marquee-left {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marquee-right {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0%); }
          }
          .animate-marquee-left {
            display: flex;
            width: max-content;
            animation: marquee-left 25s linear infinite;
          }
          .animate-marquee-right {
            display: flex;
            width: max-content;
            animation: marquee-right 25s linear infinite;
          }
          .animate-marquee-left:hover, .animate-marquee-right:hover {
            animation-play-state: paused;
          }
        `}</style>
        <div className="mx-auto max-w-6xl xl:max-w-7xl min-[1367px]:max-w-screen-xl 2xl:max-w-screen-2xl">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-2 md:mb-3 block">{partnersEyebrow}</span>
            <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl xl:text-[2rem] min-[1367px]:text-[2.25rem] 2xl:text-[2.5rem] font-bold text-[#1A1A1A] font-serif uppercase tracking-wide leading-tight">{partnersTitle}</h2>
            <div className="w-16 h-[2px] bg-[#D4AF37] mx-auto mt-4"></div>
          </div>

          <div className="relative w-full overflow-hidden select-none">
            {/* Hàng 1 chạy sang trái */}
            <div className="overflow-hidden mb-5 sm:mb-6 relative">
              <div className="animate-marquee-left gap-5 sm:gap-6">
                {[
                  { name: 'Vingroup', logo: '/images/partner/banner-GT01.png' },
                  { name: 'Masterise Homes', logo: '/images/partner/banner-GT02.png' },
                  { name: 'Keppel Land', logo: '/images/partner/banner-GT03.png' },
                  { name: 'Gamuda Land', logo: '/images/partner/banner-GT04.png' },
                ].map((partner) => (
                  <div
                    key={`p1-prime-${partner.name}`}
                    className="shrink-0 w-36 h-16 sm:w-48 sm:h-22 md:w-56 md:h-24 flex items-center justify-center border border-gray-200 bg-white rounded-xl md:rounded-2xl p-3 sm:p-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="relative w-full max-w-[140px] sm:max-w-[160px] h-10 sm:h-12 md:h-14 mx-auto grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300">
                      <Image
                        src={partner.logo}
                        alt={partner.name}
                        fill
                        quality={90}
                        className="object-contain [image-rendering:-webkit-optimize-contrast]"
                        sizes="(min-width: 1280px) 160px, (min-width: 768px) 140px, 120px"
                      />
                    </div>
                  </div>
                ))}
                {[
                  { name: 'Vingroup', logo: '/images/partner/banner-GT01.png' },
                  { name: 'Masterise Homes', logo: '/images/partner/banner-GT02.png' },
                  { name: 'Keppel Land', logo: '/images/partner/banner-GT03.png' },
                  { name: 'Gamuda Land', logo: '/images/partner/banner-GT04.png' },
                  { name: 'Vingroup', logo: '/images/partner/banner-GT01.png' },
                  { name: 'Masterise Homes', logo: '/images/partner/banner-GT02.png' },
                  { name: 'Keppel Land', logo: '/images/partner/banner-GT03.png' },
                  { name: 'Gamuda Land', logo: '/images/partner/banner-GT04.png' },
                  { name: 'Vingroup', logo: '/images/partner/banner-GT01.png' },
                  { name: 'Masterise Homes', logo: '/images/partner/banner-GT02.png' },
                  { name: 'Keppel Land', logo: '/images/partner/banner-GT03.png' },
                  { name: 'Gamuda Land', logo: '/images/partner/banner-GT04.png' },
                ].map((partner, index) => (
                  <div
                    key={`p1-clone-${index}`}
                    aria-hidden="true"
                    className="shrink-0 w-36 h-16 sm:w-48 sm:h-22 md:w-56 md:h-24 flex items-center justify-center border border-gray-200 bg-white rounded-xl md:rounded-2xl p-3 sm:p-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="relative w-full max-w-[140px] sm:max-w-[160px] h-10 sm:h-12 md:h-14 mx-auto grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300">
                      <Image
                        src={partner.logo}
                        alt=""
                        aria-hidden="true"
                        fill
                        quality={90}
                        className="object-contain [image-rendering:-webkit-optimize-contrast]"
                        sizes="(min-width: 1280px) 160px, (min-width: 768px) 140px, 120px"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Fade overlay 2 đầu */}
              <div className="absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
              <div className="absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>

            {/* Hàng 2 chạy sang phải */}
            <div className="overflow-hidden relative">
              <div className="animate-marquee-right gap-5 sm:gap-6">
                {[
                  { name: 'CapitaLand', logo: '/images/partner/banner-GT05.png' },
                  { name: 'SonKim Land', logo: '/images/partner/banner-GT06.jpg' },
                  { name: 'Nam Long', logo: '/images/partner/banner-GT07.jpg' },
                  { name: 'Khang Điền', logo: '/images/partner/banner-GT08.jpg' },
                ].map((partner) => (
                  <div
                    key={`p2-prime-${partner.name}`}
                    className="shrink-0 w-36 h-16 sm:w-48 sm:h-22 md:w-56 md:h-24 flex items-center justify-center border border-gray-200 bg-white rounded-xl md:rounded-2xl p-3 sm:p-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="relative w-full max-w-[140px] sm:max-w-[160px] h-10 sm:h-12 md:h-14 mx-auto grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300">
                      <Image
                        src={partner.logo}
                        alt={partner.name}
                        fill
                        quality={90}
                        className="object-contain [image-rendering:-webkit-optimize-contrast]"
                        sizes="(min-width: 1280px) 160px, (min-width: 768px) 140px, 120px"
                      />
                    </div>
                  </div>
                ))}
                {[
                  { name: 'CapitaLand', logo: '/images/partner/banner-GT05.png' },
                  { name: 'SonKim Land', logo: '/images/partner/banner-GT06.jpg' },
                  { name: 'Nam Long', logo: '/images/partner/banner-GT07.jpg' },
                  { name: 'Khang Điền', logo: '/images/partner/banner-GT08.jpg' },
                  { name: 'CapitaLand', logo: '/images/partner/banner-GT05.png' },
                  { name: 'SonKim Land', logo: '/images/partner/banner-GT06.jpg' },
                  { name: 'Nam Long', logo: '/images/partner/banner-GT07.jpg' },
                  { name: 'Khang Điền', logo: '/images/partner/banner-GT08.jpg' },
                  { name: 'CapitaLand', logo: '/images/partner/banner-GT05.png' },
                  { name: 'SonKim Land', logo: '/images/partner/banner-GT06.jpg' },
                  { name: 'Nam Long', logo: '/images/partner/banner-GT07.jpg' },
                  { name: 'Khang Điền', logo: '/images/partner/banner-GT08.jpg' },
                ].map((partner, index) => (
                  <div
                    key={`p2-clone-${index}`}
                    aria-hidden="true"
                    className="shrink-0 w-36 h-16 sm:w-48 sm:h-22 md:w-56 md:h-24 flex items-center justify-center border border-gray-200 bg-white rounded-xl md:rounded-2xl p-3 sm:p-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="relative w-full max-w-[140px] sm:max-w-[160px] h-10 sm:h-12 md:h-14 mx-auto grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300">
                      <Image
                        src={partner.logo}
                        alt=""
                        aria-hidden="true"
                        fill
                        quality={90}
                        className="object-contain [image-rendering:-webkit-optimize-contrast]"
                        sizes="(min-width: 1280px) 160px, (min-width: 768px) 140px, 120px"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Fade overlay 2 đầu */}
              <div className="absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
              <div className="absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. TEAM & PARTNERS SECTION */}
      <section className="bg-white py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 xl:px-8 min-[1367px]:px-16 2xl:py-16 2xl:px-0">
        <div className="mx-auto max-w-6xl xl:max-w-7xl min-[1367px]:max-w-screen-xl 2xl:max-w-screen-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 lg:gap-14 xl:gap-16 2xl:gap-24 items-start lg:items-stretch">
            <div>
              <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-2 md:mb-3 block">{philosophyEyebrow}</span>
              <h2 className="text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl xl:text-[2rem] min-[1367px]:text-[2.25rem] 2xl:text-[2.5rem] font-bold tracking-wide font-serif mb-4 md:mb-6 leading-tight uppercase text-[#1A1A1A]">{philosophyTitle}</h2>
              <div className="w-16 h-[2px] bg-[#D4AF37] mb-6 md:mb-8" />
              <div className="bg-[#F8F9FA] p-5 sm:p-6 md:p-8 lg:p-10 2xl:p-14 rounded-xl md:rounded-2xl border-l-4 border-[#D4AF37] shadow-sm relative">
                <div className="absolute -top-4 -left-2 text-6xl 2xl:text-8xl text-[#D4AF37] font-serif opacity-40">&quot;</div>
                <p className="font-serif text-[#1A1A1A] text-base sm:text-lg md:text-xl 2xl:text-2xl italic leading-7 md:leading-relaxed tracking-wide relative z-10 text-left md:text-justify">{philosophyQuote}</p>
              </div>
            </div>
            <div className="space-y-5 md:space-y-6 2xl:space-y-8 text-gray-600 text-sm sm:text-base 2xl:text-lg leading-7 md:leading-8 lg:leading-loose font-light text-left md:text-justify bg-white p-5 sm:p-6 md:p-8 2xl:p-12 rounded-xl md:rounded-2xl border border-gray-100 shadow-xl lg:flex lg:flex-col lg:justify-center">
              {philosophyPoints.map((point) => (
                <div key={point.title} className="flex gap-4 2xl:gap-6 items-start">
                  <div className="mt-2 w-2 h-2 2xl:w-3 2xl:h-3 rounded-full bg-[#D4AF37] flex-shrink-0" />
                  <div className="flex-grow"><strong className="font-bold text-[#1A1A1A] block mb-1 2xl:mb-2 text-base sm:text-lg xl:text-xl 2xl:text-2xl">{point.title}</strong><p className="text-gray-500 font-light text-xs sm:text-sm md:text-base xl:text-lg leading-relaxed">{point.content}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* 4. Q&A / CÂU HỎI THƯỜNG GẶP (GEO OPTIMIZED) */}
      <section id="faq" className="bg-white py-8 px-4 sm:px-6 md:py-10 md:px-10 lg:py-12 lg:px-12 max-w-5xl mx-auto pb-12 sm:pb-16">
        <div className="text-center mb-6 sm:mb-8 md:mb-10">
          <span className="text-sm sm:text-base md:text-lg 2xl:text-xl font-semibold tracking-[0.1em] text-[#D4AF37] uppercase mb-3 block">Giải Đáp Thắc Mắc</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#1A1A1A] uppercase leading-tight">Câu Hỏi Thường Gặp Về Maian Homes</h2>
          <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mt-4"></div>
        </div>

        <div className="space-y-6">
          {faqList.map((faq, idx) => (
            <details key={idx} className="group bg-[#FAF8F2] border border-[#E5E2D9] rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 transition-all duration-300 open:shadow-md">
              <summary className="font-serif font-bold text-[#1A1A1A] text-base sm:text-lg md:text-xl cursor-pointer list-none flex items-center justify-between gap-3 sm:gap-4">
                <span>{faq.question}</span>
                <span className="w-8 h-8 rounded-full bg-white border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center font-sans group-open:rotate-180 transition-transform shrink-0">+</span>
              </summary>
              <p className="mt-4 text-gray-600 font-light leading-relaxed border-t border-[#E5E2D9] pt-4 text-sm md:text-base whitespace-pre-line">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
