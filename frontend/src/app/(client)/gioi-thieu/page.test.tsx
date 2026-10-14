/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AboutUsPage from './page';
import { getPublishedCompanyKnowledge } from '@/features/website/public/page-content';

// Mock next/image to inspect props passed to it
vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'> & {fill?: boolean; priority?: boolean; quality?: number}) => {
    return (
      <img
        alt={props.alt}
        src={props.src}
        data-sizes={props.sizes}
        data-quality={props.quality}
        data-priority={props.priority ? 'true' : 'false'}
        data-fill={props.fill ? 'true' : 'false'}
        className={props.className}
      />
    );
  },
}));
vi.mock('@/features/website/public/page-content', () => ({
  buildCmsMetadata: vi.fn(),
  getPublicPage: vi.fn().mockResolvedValue({
    page_key: 'about',
    version: 1,
    content: {
      story_title: 'Câu Chuyện Thương Hiệu',
      story_content: 'Nội dung sứ mệnh.',
      mission_label: 'Sứ Mệnh',
      core_eyebrow: 'Định hướng',
      core_title: 'Giá Trị Cốt Lõi',
      core_values: [
        { title: 'Chính Trực', content: 'Minh bạch.' },
        { title: 'Chuyên Nghiệp', content: 'Am hiểu.' },
        { title: 'Tận Tâm', content: 'Lắng nghe.' },
        { title: 'Bền vững', content: 'Giá trị lâu dài.' },
      ],
      culture_eyebrow: 'Môi trường làm việc',
      culture_title: 'Văn Hóa Doanh Nghiệp',
      culture_content: 'Văn hóa Maian Homes.',
      culture_values: [{ title: 'Chính Trực', content: 'Minh bạch.' }],
      partners_eyebrow: 'Đồng hành',
      partners_title: 'Đối Tác Chiến Lược',
      philosophy_eyebrow: 'Triết lý kinh doanh',
      philosophy_title: 'Ưu Tiên Lợi Ích Khách Hàng',
      philosophy_quote: 'Tâm – Tín.',
      philosophy_points: [{ title: 'Người Bạn Đồng Hành', content: 'Đồng hành.' }],
    },
    seo: {},
    geo: {},
  }),  getPublishedCompanyKnowledge: vi.fn().mockResolvedValue({ company_name: 'Maian Homes', faqs: [] }),
  pageText: (content: Record<string, unknown>, key: string, fallback: string) =>
    typeof content[key] === 'string' && String(content[key]).trim() ? String(content[key]).trim() : fallback,
  publicMediaUrl: (_mediaId: unknown, fallback: string) => fallback,
}));

describe('AboutUsPage (/gioi-thieu)', () => {
  it('uses the published company FAQ as the visible and structured source', async () => {
    vi.mocked(getPublishedCompanyKnowledge).mockResolvedValueOnce({
      company_name: 'Maian Homes',
      faqs: [{ question: 'FAQ đã xuất bản?', answer: 'Nội dung chuẩn từ kho kiến thức.' }],
    });

    const { container } = render(await AboutUsPage());
    expect(screen.getByText('FAQ đã xuất bản?')).toBeInTheDocument();
    expect(screen.getByText('Nội dung chuẩn từ kho kiến thức.')).toBeInTheDocument();
    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent || '{}');
    const faqPage = jsonLd['@graph'].find((item: {'@type': string}) => item['@type'] === 'FAQPage');
    expect(faqPage.mainEntity[0].name).toBe('FAQ đã xuất bản?');
  });

  it('renders all key sections and headings correctly', async () => {
    render(await AboutUsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Giới thiệu Maian Homes' })).toBeInTheDocument();
    expect(screen.getByText(/Câu Chuyện/i)).toBeInTheDocument();
    expect(screen.getByText(/Thương Hiệu/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Giá Trị Cốt Lõi/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Văn Hóa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Đối Tác Chiến Lược/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Ưu Tiên Lợi Ích/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Câu Hỏi Thường Gặp Về Maian Homes/i })).toBeInTheDocument();
  });

  it('configures Hero Banner with quality=90, priority, and 100vw sizes for crisp high-DPI rendering', async () => {
    render(await AboutUsPage());

    const heroImg = screen.getByRole('img', { name: 'Giới thiệu Maian Homes' });
    expect(heroImg).toBeInTheDocument();
    expect(heroImg).toHaveAttribute('src', '/images/banner.jpg');
    expect(heroImg).toHaveAttribute('data-quality', '90');
    expect(heroImg).toHaveAttribute('data-priority', 'true');
    expect(heroImg).toHaveAttribute('data-sizes', '100vw');
    expect(heroImg.className).toContain('image-rendering');
  });

  it('renders Brand Story image with quality=90 and responsive sizes', async () => {
    render(await AboutUsPage());

    const storyImg = screen.getByRole('img', { name: 'Đại diện thương hiệu Maian Homes' });
    expect(storyImg).toBeInTheDocument();
    expect(storyImg).toHaveAttribute('src', '/images/banner_gioithieu.jpg');
    expect(storyImg).toHaveAttribute('data-quality', '90');
    expect(storyImg).toHaveAttribute('data-sizes', '(min-width: 1536px) 560px, (min-width: 1367px) 520px, (min-width: 1280px) 500px, (min-width: 1024px) 460px, (min-width: 768px) 440px, (min-width: 640px) 400px, 340px');
  });

  it('uses high-resolution about_tantam.jpg (not blurry layer4.png) for Core Value 03 - Tận Tâm', async () => {
    render(await AboutUsPage());

    const tantamImg = screen.getByRole('img', { name: 'Tận Tâm' });
    expect(tantamImg).toBeInTheDocument();
    // Verify layer4.png is completely eliminated
    expect(tantamImg).toHaveAttribute('src', '/images/partner/about_tantam.jpg');
    expect(tantamImg).not.toHaveAttribute('src', '/images/layer4.png');
    expect(tantamImg).toHaveAttribute('data-quality', '90');
    expect(tantamImg).toHaveAttribute('data-sizes', '(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw');
  });

  it('configures all 4 Core Values cards with high-res settings and quality=90', async () => {
    render(await AboutUsPage());

    const cardNames = ['Chính Trực', 'Chuyên Nghiệp', 'Tận Tâm', 'Bền vững'];
    cardNames.forEach((name) => {
      const img = screen.getByRole('img', { name });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('data-quality', '90');
      expect(img).toHaveAttribute('data-sizes', '(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw');
    });
  });

  it('renders Corporate Culture image with quality=90 and contrast rendering', async () => {
    render(await AboutUsPage());

    const cultureImg = screen.getByRole('img', { name: 'Văn hóa doanh nghiệp Maian Homes' });
    expect(cultureImg).toBeInTheDocument();
    expect(cultureImg).toHaveAttribute('src', '/images/Global/culture_banner.png');
    expect(cultureImg).toHaveAttribute('data-quality', '90');
  });

  it('renders all 8 Strategic Partner logos with quality=90 and exact responsive pixel mapping', async () => {
    render(await AboutUsPage());

    const partnerLogos = [
      { name: 'Vingroup', src: '/images/partner/banner-GT01.png' },
      { name: 'Masterise Homes', src: '/images/partner/banner-GT02.png' },
      { name: 'Keppel Land', src: '/images/partner/banner-GT03.png' },
      { name: 'Gamuda Land', src: '/images/partner/banner-GT04.png' },
      { name: 'CapitaLand', src: '/images/partner/banner-GT05.png' },
      { name: 'SonKim Land', src: '/images/partner/banner-GT06.jpg' },
      { name: 'Nam Long', src: '/images/partner/banner-GT07.jpg' },
      { name: 'Khang Điền', src: '/images/partner/banner-GT08.jpg' },
    ];

    partnerLogos.forEach(({ name, src }) => {
      const logoImg = screen.getByRole('img', { name });
      expect(logoImg).toBeInTheDocument();
      expect(logoImg).toHaveAttribute('src', src);
      expect(logoImg).toHaveAttribute('data-quality', '90');
      expect(logoImg).toHaveAttribute('data-sizes', '(min-width: 1280px) 160px, (min-width: 768px) 140px, 120px');
    });
  });
});
