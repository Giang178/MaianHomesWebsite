import { describe, expect, it } from 'vitest';

import { validateArticleDraft, validateProjectDraft } from './client-validation';
import { DEFAULT_PROJECT_FORM, normalizeProjectForm } from '../projects/project-form-contract';


const baseArticle = () => ({
  title: 'Phân tích thị trường bất động sản Việt Nam 2026',
  slug: 'phan-tich-thi-truong-bat-dong-san-viet-nam-2026',
  category: 'market',
  sapo: 'Tổng hợp dữ liệu thị trường và các xu hướng quan trọng dành cho khách hàng trong năm 2026.',
  content: '<h2>Tổng quan</h2><p>' + 'thị trường '.repeat(310) + '</p>',
  gallery: [{ url: '/images/test.jpg', alt_text: 'Toàn cảnh thị trường', credit: 'Maian Homes' }],
  seo: {
    meta_title: 'Phân tích thị trường bất động sản Việt Nam 2026',
    meta_description: 'Báo cáo chuyên sâu về thị trường bất động sản Việt Nam, nguồn cung, nhu cầu, pháp lý và những cơ hội đầu tư đáng chú ý trong năm 2026.',
    canonical_url: 'https://maianhomes.vn/tin_tuc/phan-tich-thi-truong-2026',
  },
  geo: {
    answer_summary: 'Thị trường năm 2026 phân hóa theo vị trí, pháp lý, chất lượng sản phẩm và năng lực của chủ đầu tư.',
    key_facts: ['Nguồn cung chọn lọc', 'Nhu cầu ổn định', 'Pháp lý được ưu tiên'],
    faqs: [
      { question: 'Thị trường ra sao?', answer: 'Nguồn cung đang được chọn lọc.' },
      { question: 'Yếu tố quan trọng?', answer: 'Vị trí và pháp lý.' },
    ],
    sources: [{ title: 'Báo cáo thị trường', url: 'https://example.com/report' }],
  },
});


describe('validateArticleDraft', () => {
  it('blocks H1 and skipped heading levels', () => {
    const article = baseArticle();
    article.content = '<h1>Sai H1</h1><h2>Mục chính</h2><h4>Nhảy cấp</h4><p>' + 'nội dung '.repeat(310) + '</p>';
    const codes = validateArticleDraft(article).errors.map(item => item.code);
    expect(codes).toContain('CONTENT_HAS_H1');
    expect(codes).toContain('HEADING_LEVEL_SKIPPED');
  });

  it('blocks an inline image without alt text', () => {
    const article = baseArticle();
    article.content += '<figure><img src="/images/inline.jpg"></figure>';
    const codes = validateArticleDraft(article).errors.map(item => item.code);
    expect(codes).toContain('INLINE_IMAGE_ALT_MISSING');
  });
});

describe('validateProjectDraft', () => {
  it('reports SEO, GEO and media gaps with stable groups', () => {
    const result = validateProjectDraft(normalizeProjectForm({
      name: 'Dự án mẫu',
      slug: 'du-an-mau',
      developer: 'Maian Homes',
      description: 'Mô tả',
      location: 'TP.HCM',
      hero_images: ['/hero.jpg'],
      seo_metadata: {...DEFAULT_PROJECT_FORM.seo_metadata, title: '', description: '', keywords: [], image_alts: []},
    }));
    expect(result.errors.some(item => item.group === 'SEO')).toBe(true);
    expect(result.errors.some(item => item.group === 'GEO')).toBe(true);
    const altIssue = result.errors.find(item => item.code === 'IMAGE_ALT_MISSING');
    expect(altIssue).toMatchObject({
      field: 'hero_images.0',
      group: 'MEDIA',
      message: 'Thiếu alt ảnh tại: Hero - ảnh 1.',
    });
    expect(altIssue?.message).not.toContain('/hero.jpg');
  });

  it('accepts a 1200x300 wide amenity floor plan in GLOBAL layout', () => {
    const field = 'amenity_floors.0.floor_map_image';
    const project = normalizeProjectForm({
      amenity_template: 'GLOBAL',
      amenity_floors: [{
        floor_label: 'Phân khu hồ bơi',
        floor_map_image: '/api/public/marketing-media/global-plan',
        amenities: [],
      }],
      image_metadata: [{
        field,
        media_id: 'global-plan',
        url: '/api/public/marketing-media/global-plan',
        alt_text: 'Mặt bằng tiện ích phân khu hồ bơi',
        width: 1200,
        height: 300,
        focal_x: 50,
        focal_y: 50,
        variants: {
          thumbnail_webp: '/media/global-plan?variant=thumbnail_webp',
          medium_webp: '/media/global-plan?variant=medium_webp',
          large_webp: '/media/global-plan?variant=large_webp',
        },
      }],
    });

    const dimensionIssues = validateProjectDraft(project).errors.filter(
      item => item.field === field && item.code === 'IMAGE_DIMENSIONS_TOO_SMALL',
    );
    expect(dimensionIssues).toEqual([]);
  });
});
