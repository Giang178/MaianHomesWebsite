import { Metadata } from 'next';
import KyGuiForm from './KyGuiForm';
import { buildCmsMetadata, getPublicPage, publicMediaUrl } from '@/features/website/public/page-content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

const fallbackMetadata: Metadata = {
  title: 'Ký Gửi & Chuyển Nhượng BĐS TP.HCM',
  description: 'Dịch vụ nhận ký gửi, chuyển nhượng căn hộ F2, biệt thự tại TP.HCM. Chốt giao dịch nhanh 14-30 ngày. Phí môi giới minh bạch 1%-3%. Hỗ trợ thẩm định giá bán.',
  alternates: {
    canonical: `${SITE_URL}/ky-gui`,
  },
  openGraph: {
    title: 'Ký Gửi & Chuyển Nhượng BĐS TP.HCM | Maian Homes',
    description: 'Chốt giao dịch nhanh 14-30 ngày. Phí môi giới minh bạch 1%-3%. Hỗ trợ thẩm định giá bán.',
    url: `${SITE_URL}/ky-gui`,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/banner_Kg.jpg`,
        width: 1200,
        height: 630,
        alt: 'Ký Gửi Bất Động Sản TP.HCM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ký Gửi Bất Động Sản TP.HCM | Maian Homes',
    description: 'Dịch vụ ký gửi chuyển nhượng cao cấp tại TP.HCM. Chốt giao dịch 14-30 ngày, phí 1-3%.',
    images: [`${SITE_URL}/images/Global/Global04.jpg`],
  },
};
void fallbackMetadata;
export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('consignment', {title: 'Ký gửi và chuyển nhượng bất động sản TP.HCM', description: 'Dịch vụ nhận ký gửi, chuyển nhượng bất động sản minh bạch cùng Maian Homes.', canonicalPath: '/ky-gui', image: '/images/banner_Kg.jpg'});
}

export default async function KyGuiPage() {
  const page = await getPublicPage('consignment');
  const heroImage = publicMediaUrl(page?.content?.hero_media_id, '/images/banner_Kg.jpg');
  const consignmentFaqs = Array.isArray(page?.geo?.faqs)
    ? page.geo.faqs.filter((faq): faq is { question: string; answer: string } => Boolean(faq?.question && faq?.answer))
    : [];
  const unifiedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Trang chủ", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "Ký gửi Bất động sản", "item": `${SITE_URL}/ky-gui` }
        ]
      },
      {
        "@type": "RealEstateAgent",
        "@id": `${SITE_URL}/#organization`,
        "name": "Maian Homes",
        "url": `${SITE_URL}`,
        "logo": `${SITE_URL}/images/logo_final.png`,
        "image": `${SITE_URL}/images/banner_Kg.jpg`,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "606/62 đường 3 Tháng 2, Phường Diên Hồng",
          "addressLocality": "Hồ Chí Minh",
          "addressCountry": "VN"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "areaServed": "VN",
          "availableLanguage": "Vietnamese"
        }
      },
      {
        "@type": "Service",
        "@id": `${SITE_URL}/ky-gui/#service`,
        "name": "Dịch vụ Ký gửi & Chuyển nhượng Bất động sản TP.HCM",
        "provider": { "@id": `${SITE_URL}/#organization` },
        "areaServed": {
          "@type": "City",
          "name": "Hồ Chí Minh"
        },
        "description": "Nhận ký gửi nhà đất, chuyển nhượng căn hộ F2, biệt thự tại TP.HCM. Chốt giao dịch nhanh chóng trong 14-30 ngày. Phí dịch vụ 1%-3%."
      },
      {
        "@type": "HowTo",
        "name": "Quy trình Ký gửi Bất động sản tại Maian Homes",
        "step": [
          { "@type": "HowToStep", "name": "Bước 1: Tiếp nhận thông tin", "text": "Cung cấp thông tin qua form hoặc hotline." },
          { "@type": "HowToStep", "name": "Bước 2: Khảo sát & Định giá", "text": "Thẩm định giá chuyển nhượng tối ưu nhất." },
          { "@type": "HowToStep", "name": "Bước 3: Tiếp thị & Tìm khách", "text": "Tiếp cận khách VIP và mạng lưới đối tác." },
          { "@type": "HowToStep", "name": "Bước 4: Chốt giao dịch", "text": "Ký kết hợp đồng và sang tên HĐMB/Sổ hồng." }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": consignmentFaqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(unifiedSchema).replace(/</g, '\\u003c') }}
      />
      <KyGuiForm heroImage={heroImage} faqs={consignmentFaqs} />
    </>
  );
}
