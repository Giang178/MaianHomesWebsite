import { Metadata } from 'next';
import PrivacyPolicyClient from '@/features/privacy/PrivacyPolicyClient';
import { buildCmsMetadata, getPublicPage, pageText } from '@/features/website/public/page-content';

export const revalidate = 3600; // ISR cache 1 giờ

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';
const PRIVACY_URL = `${SITE_URL}/chinh-sach-bao-mat`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const PAGE_ID = `${PRIVACY_URL}/#webpage`;
const LAST_MODIFIED = '2026-07-10';

const fallbackMetadata: Metadata = {
  title: {
    absolute: 'Chính Sách Bảo Mật & Bảo Vệ Dữ Liệu Cá Nhân | Maian Homes',
  },
  description: 'Chính sách bảo mật và bảo vệ dữ liệu cá nhân của Maian Homes theo Nghị định 13/2023/NĐ-CP. Cam kết minh bạch, bảo mật tuyệt đối, không bán dữ liệu cho bên thứ ba.',
  keywords: [
    'chính sách bảo mật Maian Homes',
    'bảo vệ dữ liệu cá nhân',
    'Nghị định 13/2023/NĐ-CP',
    'bảo mật thông tin khách hàng',
    'quyền chủ thể dữ liệu Maian Homes',
    'bảo mật bất động sản'
  ],
  openGraph: {
    title: 'Chính Sách Bảo Mật & Bảo Vệ Dữ Liệu Cá Nhân | Maian Homes',
    description: 'Cam kết bảo mật dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP, quyền của chủ thể dữ liệu và cơ chế xử lý thông tin tại Maian Homes.',
    url: PRIVACY_URL,
    siteName: 'Maian Homes',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/banner_gioithieu.jpg`,
        width: 1200,
        height: 630,
        alt: 'Chính Sách Bảo Mật Maian Homes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chính Sách Bảo Mật & Bảo Vệ Dữ Liệu Cá Nhân | Maian Homes',
    description: 'Cam kết bảo mật dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP và quyền lợi chủ thể dữ liệu tại Maian Homes.',
    images: [`${SITE_URL}/images/banner_gioithieu.jpg`],
  },
  alternates: {
    canonical: PRIVACY_URL,
  },
};

void fallbackMetadata;
export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('privacy', {
    title: 'Chính Sách Bảo Mật & Bảo Vệ Dữ Liệu Cá Nhân | Maian Homes',
    description: 'Chính sách bảo mật và bảo vệ dữ liệu cá nhân của Maian Homes theo Nghị định 13/2023/NĐ-CP.',
    canonicalPath: '/chinh-sach-bao-mat',
    image: '/images/banner_gioithieu.jpg',
  });
}

export default async function PrivacyPolicyPage() {
  const page = await getPublicPage('privacy');
  const content = page?.content || {};
  const fallbackFaqList = [
    {
      question: "Maian Homes thu thập những dữ liệu cá nhân nào khi tôi truy cập maianhomes.vn?",
      answer: "Chúng tôi chỉ thu thập các thông tin do khách hàng tự nguyện cung cấp (như Họ tên, Số điện thoại, Email, nhu cầu bất động sản, nội dung tư vấn) thông qua biểu mẫu đăng ký tư vấn, biểu mẫu liên hệ hoặc các kênh hotline/Zalo. Ngoài ra hệ thống ghi nhận thông tin kỹ thuật (IP, loại trình duyệt) nhằm tối ưu trải nghiệm website."
    },
    {
      question: "Dữ liệu cá nhân của tôi có bị bán hoặc chia sẻ cho bên thứ ba không?",
      answer: "Hoàn toàn KHÔNG. Maian Homes cam kết tuyệt đối không bán, cho thuê hay chuyển giao dữ liệu của bạn cho bên thứ ba vì mục đích thương mại. Thông tin chỉ được chia sẻ cho các đối tác hạ tầng kỹ thuật (email, server, tổng đài) trong phạm vi bảo mật nghiêm ngặt hoặc khi có yêu cầu của cơ quan pháp luật."
    },
    {
      question: "Tôi có thể yêu cầu xóa dữ liệu hoặc rút lại sự đồng ý xử lý thông tin như thế nào?",
      answer: "Theo Nghị định 13/2023/NĐ-CP, bạn có đầy đủ quyền truy cập, chỉnh sửa, yêu cầu xóa dữ liệu hoặc rút lại sự đồng ý bất kỳ lúc nào bằng cách gửi yêu cầu qua email email hỗ trợ, gọi hotline hotline hỗ trợ hoặc gửi trực tiếp qua Biểu mẫu 'Yêu cầu Quyền Chủ thể Dữ liệu' ngay trên trang web này."
    },
    {
      question: "Thời gian Maian Homes lưu trữ thông tin của khách hàng là bao lâu?",
      answer: "Thông tin cá nhân được lưu trữ trong suốt quá trình khách hàng sử dụng dịch vụ hoặc phát sinh nhu cầu giao dịch, và được duy trì thêm một khoảng thời gian hợp lý sau đó để thực hiện công tác chăm sóc khách hàng, bảo hành dịch vụ và tuân thủ quy định pháp luật hiện hành."
    }
  ];
  const geoFaqList = Array.isArray(page?.geo?.faqs) && page.geo.faqs.length ? page.geo.faqs as Array<{question: string; answer: string}> : fallbackFaqList;

  // Schema.org tối ưu SEO & GEO (Generative Engine Optimization)
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
        '@type': 'BreadcrumbList',
        '@id': `${PRIVACY_URL}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Chính sách bảo mật', item: PRIVACY_URL }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': PAGE_ID,
        url: PRIVACY_URL,
        name: 'Chính Sách Bảo Mật & Bảo Vệ Dữ Liệu Cá Nhân | Maian Homes',
        description: 'Chính sách bảo mật dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP của Maian Homes.',
        inLanguage: 'vi-VN',
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': ORGANIZATION_ID },
        dateModified: LAST_MODIFIED,
        breadcrumb: { '@id': `${PRIVACY_URL}/#breadcrumb` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${PRIVACY_URL}/#faq`,
        mainEntity: geoFaqList.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <PrivacyPolicyClient title={pageText(content, 'title', 'Chính Sách Bảo Mật')} introduction={pageText(content, 'introduction', 'Cam kết minh bạch tuyệt đối trong việc thu thập, lưu trữ và bảo vệ quyền chủ thể dữ liệu của quý khách hàng trên hệ sinh thái bất động sản Maian Homes.')} cmsSections={Array.isArray(content.sections) ? content.sections as Array<{id?: string; title?: string; content?: string | string[]}> : undefined} />
    </>
  );
}
