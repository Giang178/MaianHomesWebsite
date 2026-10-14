import type { ValidationIssue, ValidationReport } from '../contracts/generated';
import { projectImageEntries, projectImageMetadata, type ProjectFormData } from '../projects/project-form-contract';

type UnknownRecord = Record<string, unknown>;

const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://maianhomes.vn';

const isInternalArticleMedia = (value: unknown) => {
  const url = String(value || '').trim();
  return /^\/api\/public\/marketing-media\/[a-f0-9]{32}(?:[?#].*)?$/.test(url)
    || /^\/images\//.test(url);
};

const issue = (code: string, field: string, message: string, group?: ValidationIssue['group']): ValidationIssue => ({
  code,
  field,
  message,
  group,
});

const lengthIssue = (
  value: unknown,
  minimum: number,
  maximum: number,
  code: string,
  field: string,
  label: string,
) => {
  const length = String(value || '').trim().length;
  return length < minimum || length > maximum
    ? issue(code, field, `${label} phải có từ ${minimum} đến ${maximum} ký tự.`)
    : null;
};

const report = (errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationReport => ({
  score: Math.max(0, 100 - errors.length * 15 - warnings.length * 5),
  errors,
  warnings,
});

export function validateArticleDraft(data: UnknownRecord): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seo = (data.seo || {}) as UnknownRecord;
  const geo = (data.geo || {}) as UnknownRecord;
  const gallery = Array.isArray(data.gallery) ? data.gallery as UnknownRecord[] : [];
  const checks = [
    lengthIssue(data.title, 20, 120, 'TITLE_LENGTH', 'title', 'Tiêu đề'),
    lengthIssue(data.sapo, 50, 250, 'SAPO_LENGTH', 'sapo', 'Sapo'),
    lengthIssue(seo.meta_title, 30, 60, 'META_TITLE_LENGTH', 'seo.meta_title', 'Meta title'),
    lengthIssue(seo.meta_description, 120, 160, 'META_DESCRIPTION_LENGTH', 'seo.meta_description', 'Meta description'),
    lengthIssue(geo.answer_summary, 50, 300, 'GEO_SUMMARY_LENGTH', 'geo.answer_summary', 'Answer summary'),
  ];
  checks.forEach((item) => item && errors.push(item));

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(data.slug || ''))) {
    errors.push(issue('INVALID_SLUG', 'slug', 'Slug chỉ được dùng chữ thường, số và dấu gạch ngang.'));
  }
  try {
    const canonical = new URL(String(seo.canonical_url || ''));
    const expectedOrigin = new URL(PUBLIC_SITE_URL).origin;
    if (canonical.protocol !== 'https:' || canonical.origin !== expectedOrigin) throw new Error('invalid canonical origin');
  } catch {
    errors.push(issue('INVALID_CANONICAL', 'seo.canonical_url', 'Canonical phải là URL HTTPS hợp lệ.'));
  }

  const html = String(data.content || '');
  const words = html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length < 300) errors.push(issue('CONTENT_TOO_SHORT', 'content', 'Nội dung phải có ít nhất 300 từ.'));
  if (/<h1\b/i.test(html)) errors.push(issue('CONTENT_HAS_H1', 'content', 'Nội dung không được chứa H1.'));
  const headings = Array.from(html.matchAll(/<h([1-4])\b/gi)).map(match => Number(match[1]));
  if (!headings.includes(2)) errors.push(issue('H2_MISSING', 'content', 'Nội dung phải có ít nhất một H2.'));
  if (headings.some((level, index) => index > 0 && level > headings[index - 1] + 1)) {
    errors.push(issue('HEADING_LEVEL_SKIPPED', 'content', 'Cấp heading không được nhảy bậc.'));
  }
  if (!/href=["']\//i.test(html)) warnings.push(issue('INTERNAL_LINK_MISSING', 'content', 'Nên có ít nhất một liên kết nội bộ.'));

  if (!gallery.length) errors.push(issue('FEATURED_IMAGE_MISSING', 'gallery', 'Bài viết phải có ít nhất một ảnh.'));
  gallery.forEach((image, index) => {
    if (image.url && !isInternalArticleMedia(image.url)) {
      errors.push(issue('EXTERNAL_IMAGE_URL', `gallery.${index}.url`, 'Ảnh bài viết phải thuộc kho media nội bộ.'));
    }
    if (!String(image.alt_text || '').trim()) {
      errors.push(issue('IMAGE_ALT_MISSING', `gallery.${index}.alt_text`, 'Mọi ảnh phải có alt text.'));
    }
    if (!String(image.credit || '').trim()) warnings.push(issue('IMAGE_CREDIT_MISSING', `gallery.${index}.credit`, 'Nên ghi nguồn ảnh.'));
  });
  Array.from(html.matchAll(/<img\b([^>]*)>/gi)).forEach((match, index) => {
    if (!/\balt=["'][^"']+["']/i.test(match[1])) {
      errors.push(issue('INLINE_IMAGE_ALT_MISSING', `content.image.${index}`, 'Ảnh trong nội dung phải có alt text.'));
    }
    const src = match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && !isInternalArticleMedia(src)) {
      errors.push(issue('INLINE_IMAGE_EXTERNAL_URL', `content.image.${index}`, 'Ảnh trong nội dung phải thuộc kho media nội bộ.'));
    }
  });
  const keyFacts = Array.isArray(geo.key_facts) ? geo.key_facts.filter((value) => String(value).trim()) : [];
  if (keyFacts.length < 3) errors.push(issue('GEO_KEY_FACTS_MISSING', 'geo.key_facts', 'Cần tối thiểu ba key facts.'));
  const faqs = Array.isArray(geo.faqs) ? geo.faqs as UnknownRecord[] : [];
  if (faqs.filter((item) => item.question && item.answer).length < 2) {
    errors.push(issue('GEO_FAQS_MISSING', 'geo.faqs', 'Cần tối thiểu hai FAQ đầy đủ.'));
  }
  const sources = Array.isArray(geo.sources) ? geo.sources as UnknownRecord[] : [];
  if (data.category === 'market' && !sources.length) {
    errors.push(issue('SOURCE_MISSING', 'geo.sources', 'Tin thị trường phải có nguồn tham khảo.'));
  }
  sources.forEach((source, index) => {
    try {
      const url = new URL(String(source.url || ''));
      if (!source.title || !['http:', 'https:'].includes(url.protocol)) throw new Error('invalid source');
    } catch {
      errors.push(issue('SOURCE_INVALID', `geo.sources.${index}`, 'Nguồn phải có tên và URL HTTP(S) hợp lệ.'));
    }
  });
  return report(errors, warnings);
}

export function validateProjectDraft(data: ProjectFormData): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seo = (data.seo_metadata || {}) as UnknownRecord;
  ([['name', 'Tên dự án'], ['description', 'Mô tả'], ['location', 'Vị trí'], ['developer', 'Chủ đầu tư']] as const).forEach(([field, label]) => {
    if (!String(data[field] || '').trim()) errors.push(issue(`${field.toUpperCase()}_MISSING`, field, `${label} là bắt buộc.`, 'CONTENT'));
  });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(data.slug || ''))) {
    errors.push(issue('INVALID_SLUG', 'slug', 'Slug chỉ được dùng chữ thường, số và dấu gạch ngang.', 'SEO'));
  }
  const heroImages = Array.isArray(data.hero_images) ? data.hero_images.filter(Boolean).map(String) : [];
  const galleryImages = Array.isArray(data.images) ? data.images.filter(Boolean).map(String) : [];
  if (!heroImages.length && !galleryImages.length && !data.hero_video_url) {
    errors.push(issue('HERO_MISSING', 'hero_images', 'Dự án phải có hero image hoặc video.', 'MEDIA'));
  }
  if (data.hero_video_url && !heroImages.length && !galleryImages.length) {
    errors.push(issue('OG_IMAGE_MISSING', 'hero_images', 'Dự án dùng video vẫn cần một ảnh hero cho Open Graph.', 'SEO'));
  }
  const lengthChecks = [
    [seo.title, 30, 60, 'META_TITLE_LENGTH', 'seo_metadata.title', 'SEO title', 'SEO'],
    [seo.description, 120, 160, 'META_DESCRIPTION_LENGTH', 'seo_metadata.description', 'SEO description', 'SEO'],
    [seo.cornerstone_text, 50, 1000, 'GEO_SUMMARY_LENGTH', 'seo_metadata.cornerstone_text', 'Cornerstone summary', 'GEO'],
  ] as const;
  lengthChecks.forEach(([value, min, max, code, field, label, group]) => {
    const found = lengthIssue(value, min, max, code, field, label);
    if (found) errors.push({...found, group});
  });
  const focusKeyword = String(seo.focus_keyword || '').trim();
  if (!focusKeyword) errors.push(issue('FOCUS_KEYWORD_MISSING', 'seo_metadata.focus_keyword', 'Focus keyword là bắt buộc.', 'SEO'));
  const keywords = new Set((Array.isArray(seo.keywords) ? seo.keywords : []).map(String).map(value => value.trim().toLocaleLowerCase()).filter(Boolean));
  if (keywords.size < 3) errors.push(issue('KEYWORDS_MISSING', 'seo_metadata.keywords', 'Cần tối thiểu ba keyword không trùng nhau.', 'SEO'));
  const usps = Array.isArray(seo.usps) ? seo.usps.filter((value) => String(value).trim()) : [];
  if (usps.length < 3) errors.push(issue('USP_MISSING', 'seo_metadata.usps', 'Cần tối thiểu ba USP.', 'GEO'));
  const keyFacts = Array.isArray(seo.key_facts) ? seo.key_facts.filter((value) => String(value).trim()) : [];
  if (keyFacts.length < 3) errors.push(issue('KEY_FACTS_MISSING', 'seo_metadata.key_facts', 'Cần tối thiểu ba key fact.', 'GEO'));
  const faqs = Array.isArray(seo.faqs) ? seo.faqs as UnknownRecord[] : [];
  if (faqs.filter((item) => item.question && item.answer).length < 2) {
    errors.push(issue('FAQ_MISSING', 'seo_metadata.faqs', 'Cần tối thiểu hai FAQ đầy đủ.', 'GEO'));
  }
  const sources = Array.isArray(seo.sources) ? seo.sources as UnknownRecord[] : [];
  let validSources = 0;
  sources.forEach((source, index) => {
    try {
      const url = new URL(String(source.url || ''));
      if (!source.title || !['http:', 'https:'].includes(url.protocol)) throw new Error('invalid source');
      validSources += 1;
    } catch {
      errors.push(issue('SOURCE_INVALID', `seo_metadata.sources.${index}`, 'Nguồn phải có tên và URL HTTP(S) hợp lệ.', 'GEO'));
    }
  });
  if (!validSources) errors.push(issue('SOURCE_MISSING', 'seo_metadata.sources', 'Cần tối thiểu một nguồn tham khảo.', 'GEO'));

  const imageEntries = projectImageEntries(data);
  const imageAlts = Array.isArray(seo.image_alts) ? seo.image_alts as UnknownRecord[] : [];
  const altByUrl = new Map(imageAlts.map(item => [String(item.url || '').trim(), String(item.alt_text || '').trim()]));
  imageEntries.forEach(({field, label, url}) => {
    const metadata = projectImageMetadata(data, field, url);
    if (!metadata.alt_text.trim() && !altByUrl.get(url)) {
      errors.push(issue('IMAGE_ALT_MISSING', field, `Thiếu alt ảnh tại: ${label}.`, 'MEDIA'));
    }
    if (/^https?:\/\//i.test(url) && !url.includes('/api/public/marketing-media/')) {
      errors.push(issue('EXTERNAL_IMAGE_URL', field, `${label} phải được tải lên kho media nội bộ.`, 'MEDIA'));
    }
    const planField = field.includes('floor_map_image') || field.includes('floor_plan_images') || field.includes('master_plan') || field.includes('map_image');
    const storyField = field.startsWith('story_blocks.');
    const unitLayoutField = field.includes('.unit_layouts.') && field.endsWith('.image_url');
    const globalAmenityPlanField = data.amenity_template === 'GLOBAL'
      && field.startsWith('amenity_floors.')
      && field.endsWith('.floor_map_image');
    const hasOverviewImages = Array.isArray(data.overview_images) && data.overview_images.some(Boolean);
    const backgroundField = ['hero_images.0', 'contact_bg_image'].includes(field)
      || (field === 'stats_bg_image' && !hasOverviewImages);
    const minWidth = unitLayoutField ? 600 : globalAmenityPlanField ? 1200 : planField || storyField ? 900 : backgroundField ? 1600 : field === 'logo_url' ? 480 : 1200;
    const minHeight = unitLayoutField ? 500 : globalAmenityPlanField ? 300 : planField || storyField || backgroundField ? 900 : field === 'logo_url' ? 480 : 0;
    if (metadata.media_id && (metadata.width < minWidth || (minHeight && metadata.height < minHeight))) {
      errors.push(issue('IMAGE_DIMENSIONS_TOO_SMALL', field, `${label}: ${metadata.width}×${metadata.height}px; yêu cầu tối thiểu ${minWidth}${minHeight ? `×${minHeight}` : ''}px.`, 'MEDIA'));
    }
    if (metadata.media_id && !['thumbnail_webp', 'medium_webp', 'large_webp'].every(name => metadata.variants[name])) {
      errors.push(issue('IMAGE_VARIANTS_MISSING', field, `${label} chưa có đủ biến thể ảnh tối ưu.`, 'MEDIA'));
    }
    if (field === 'hero_images.0' && metadata.media_id && !metadata.variants.og_webp) {
      errors.push(issue('OG_IMAGE_VARIANT_MISSING', field, `${label} thiếu biến thể Open Graph 1200×630.`, 'MEDIA'));
    }
  });

  if (!data.contact_phone && !data.contact_email) {
    warnings.push(issue('CONTACT_MISSING', 'contact_phone', 'Nên có thông tin liên hệ riêng cho dự án.', 'CONTENT'));
  }
  if (!String(data.price_range || '').trim() || String(data.price_range).trim().toLocaleLowerCase() === 'đang cập nhật') {
    warnings.push(issue('PRICE_PLACEHOLDER', 'price_range', 'Nên cập nhật khoảng giá cụ thể.', 'CONTENT'));
  }
  const searchable = `${String(seo.title || '')} ${String(seo.description || '')}`.toLocaleLowerCase();
  if (focusKeyword && !searchable.includes(focusKeyword.toLocaleLowerCase())) {
    warnings.push(issue('FOCUS_KEYWORD_NOT_USED', 'seo_metadata.focus_keyword', 'Focus keyword nên xuất hiện trong SEO title hoặc description.', 'SEO'));
  }
  const hasStories = Boolean(Array.isArray(data.story_blocks) && data.story_blocks.length);
  const hasAmenities = Boolean(Array.isArray(data.amenity_floors) && data.amenity_floors.length);
  if (!hasStories && !hasAmenities) {
    warnings.push(issue('PUBLIC_SECTION_THIN', 'story_blocks', 'Nên bổ sung câu chuyện và tiện ích để trang dự án đầy đủ hơn.', 'CONTENT'));
  } else if (!hasStories) {
    warnings.push(issue('PUBLIC_SECTION_THIN', 'story_blocks', 'Nên bổ sung thêm khối câu chuyện giới thiệu dự án.', 'CONTENT'));
  } else if (!hasAmenities) {
    warnings.push(issue('PUBLIC_SECTION_THIN', 'amenity_floors', 'Nên bổ sung thêm danh mục hoặc hình ảnh tiện ích dự án.', 'CONTENT'));
  }
  return report(errors, warnings);
}
