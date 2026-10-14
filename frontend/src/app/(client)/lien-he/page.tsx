import { Metadata } from 'next';
import ContactLayout from './ContactLayout';
import { buildCmsMetadata, getPublicPage, pageText } from '@/features/website/public/page-content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';
const CONTACT_URL = `${SITE_URL}/lien-he`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const CONTACT_PAGE_ID = `${CONTACT_URL}/#webpage`;
const LOGO_URL = `${SITE_URL}/images/logo_final.png`;
const CONTACT_IMAGE_URL = `${SITE_URL}/images/Global/Global04.jpg`;
const CONTACT_LAST_MODIFIED = '2026-07-08';

const API_URL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

type PublicContact = { phone?: string | null; email?: string | null; address?: string | null; working_hours?: string | null; social_links?: Record<string, string> };

async function getPublicContact(): Promise<PublicContact> {
  try {
    const response = await fetch(API_URL + '/api/public/contact-settings', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return {};
    return (await response.json()) as PublicContact;
  } catch {
    return {};
  }
}

const fallbackMetadata: Metadata = {
  title: 'Liên hệ',
  description: 'Thông tin liên hệ chính thức của Maian Homes.',
  keywords: [
    'liên hệ Maian Homes',
    'Maian Homes hotline',
    'thông tin liên hệ Maian Homes',
    'văn phòng Maian Homes TP HCM',
    'bất động sản cao cấp',
  ],
  alternates: {
    canonical: CONTACT_URL,
  },
  openGraph: {
    title: 'Liên hệ Maian Homes',
    description: 'Thông tin liên hệ chính thức của Maian Homes.',
    url: CONTACT_URL,
    siteName: 'Maian Homes',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: CONTACT_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'Thông tin liên hệ Maian Homes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liên hệ Maian Homes',
    description: 'Thông tin liên hệ chính thức của Maian Homes.',
    images: [CONTACT_IMAGE_URL],
  },
};
void fallbackMetadata;
export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('contact', {title: 'Liên hệ Maian Homes', description: 'Thông tin liên hệ chính thức của Maian Homes.', canonicalPath: '/lien-he', image: '/images/Global/Global04.jpg'});
}

export default async function ContactPage() {
  const [contact, page] = await Promise.all([getPublicContact(), getPublicPage('contact')]);
  const content = page?.content || {};
  const contactFaqs = Array.isArray(page?.geo?.faqs)
    ? page.geo.faqs.filter((faq): faq is { question: string; answer: string } => Boolean(faq?.question && faq?.answer))
    : [];
  const interestOptions = Array.isArray((content as { interest_options?: unknown }).interest_options)
    ? ((content as { interest_options: unknown[] }).interest_options.filter((item): item is string => typeof item === 'string'))
    : [];
  const contactPhone = contact.phone || undefined;
  const contactEmail = contact.email || undefined;
  const contactAddress = contact.address || undefined;
  const unifiedSchema = {
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
        '@type': 'BreadcrumbList',
        '@id': `${CONTACT_URL}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Liên hệ', item: CONTACT_URL },
        ],
      },
      {
        '@type': ['RealEstateAgent', 'Organization'],
        '@id': ORGANIZATION_ID,
        name: 'Maian Homes',
        url: SITE_URL,
        logo: LOGO_URL,
        image: LOGO_URL,
        description: 'Thông tin liên hệ chính thức của Maian Homes.',
        telephone: contactPhone,
        email: contactEmail,
        address: {
          '@type': 'PostalAddress',
          streetAddress: contactAddress,
          addressCountry: 'VN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 10.7719,
          longitude: 106.6668,
        },
        sameAs: Object.values(contact.social_links || {}).filter(Boolean),
        contactPoint: [
          {
            '@type': 'ContactPoint',
            telephone: contactPhone,
            email: contactEmail,
            contactType: 'customer service',
            availableLanguage: ['vi-VN', 'vi'],
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${CONTACT_URL}/#faq`,
        mainEntity: contactFaqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
      {
        '@type': 'ContactPage',
        '@id': CONTACT_PAGE_ID,
        url: CONTACT_URL,
        name: 'Liên hệ Maian Homes',
        description: 'Trang thông tin liên hệ và gửi yêu cầu tư vấn tại Maian Homes.',
        inLanguage: 'vi-VN',
        dateModified: CONTACT_LAST_MODIFIED,
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORGANIZATION_ID },
        mainEntity: { '@id': ORGANIZATION_ID },
        breadcrumb: { '@id': `${CONTACT_URL}/#breadcrumb` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: CONTACT_IMAGE_URL,
          width: 1200,
          height: 630,
        },
        potentialAction: {
          '@type': 'CommunicateAction',
          name: 'Liên hệ tư vấn Maian Homes',
          target: CONTACT_URL,
          recipient: { '@id': ORGANIZATION_ID },
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(unifiedSchema).replace(/</g, '\\u003c') }}
      />
      <ContactLayout title={pageText(content, 'title', 'LIÊN HỆ MAIAN HOMES')} description={pageText(content, 'description', 'Chúng tôi luôn sẵn sàng lắng nghe và giải đáp mọi thắc mắc của Quý khách về các dự án bất động sản cao cấp, dịch vụ ký gửi và quản lý tài sản.')} interestOptions={interestOptions} faqs={contactFaqs} />
    </>
  );
}
