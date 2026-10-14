import type { ValidationReport } from '../contracts/generated';

export type ProjectStatus = 'AVAILABLE' | 'COMING_SOON' | 'PRE_SALE' | 'HANDING_OVER' | 'RESERVED' | 'SOLD';
export interface Tower { id: string; name: string; floors: number; units_per_floor: number; total_units: number; area_range: string; position_x: number; position_y: number; description: string; floor_plan_images: string[]; }
export interface AmenityItem { name: string; image_url: string; icon: string; description?: string; position_x?: number; position_y?: number; number?: number; category?: string; }
export interface AmenityFloor { floor_label: string; floor_map_image?: string; sub_categories?: string[]; amenities: AmenityItem[]; }
export interface Highlight { title: string; description: string; icon: string; image: string; }
export interface LocationDistance { destination: string; distance: string; distance_km: string; icon?: string; }
export interface UnitLayout { name: string; bedrooms: number; bathrooms: number; gross_area: number; net_area: number; door_direction: string; balcony_direction: string; view_direction: string; image_url: string; description: string; }
export interface FloorUnitHotspot { unit_code?: string; unit_number: string; position_x: number; position_y: number; layout_name: string; }
export interface FloorLayoutGroup { group_name: string; floors: number[]; floor_map_image: string; unit_layouts: UnitLayout[]; hotspots: FloorUnitHotspot[]; }
export interface AmenityGalleryItem { name: string; image_url: string; description: string; category: string; }
export interface StoryBlock { title: string; content: string; image_url: string; alignment: 'left' | 'right'; }
export interface ProjectImageAlt { url: string; alt_text: string; }
export interface ProjectImageEntry { field: string; label: string; url: string; }
export interface ProjectImageMetadata {
  field: string;
  media_id: string;
  url: string;
  alt_text: string;
  width: number;
  height: number;
  focal_x: number;
  focal_y: number;
  variants: Record<string, string>;
}
export interface ProjectUploadResponse {
  id: string;
  url: string;
  content_type: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  width: number;
  height: number;
  checksum: string;
  variants: Record<string, string>;
}
export interface ProjectSeoSource { title: string; url: string; }

export interface ProjectFormData {
  name: string; slug: string; slogan: string; tagline: string; developer: string;
  developer_description?: string;
  primary_color: string; accent_color: string;
  contact_phone: string; contact_email: string; contact_title: string; contact_description: string;
  location: string; location_description: string; map_embed_url: string; location_map_image: string; location_map_x?: number; location_map_y?: number; location_distances: LocationDistance[];
  location_distances_note?: string;
  hero_images: string[]; hero_video_url: string; master_plan_image: string; amenity_map_image: string; images: string[]; stats_bg_image: string; contact_bg_image: string; logo_url: string;
  price_range: string; status: ProjectStatus; description: string; stats: Record<string, string>;
  overview_image_position?: 'left' | 'right';
  location_map_position?: 'left' | 'right';
  overview_images?: string[];
  towers: Tower[]; amenity_floors: AmenityFloor[]; highlights: Highlight[]; floor_layouts: FloorLayoutGroup[];
  amenities: string[]; amenity_template: string; amenity_gallery: AmenityGalleryItem[];
  master_plan_description?: string; outdoor_amenities_description?: string; indoor_amenities_description?: string; interior_design_description?: string;
  seo_metadata: {
    title: string; description: string; canonical_url?: string; og_title?: string; og_description?: string; og_image?: string;
    keywords: string[]; focus_keyword: string;
    usps: string[]; key_facts: string[]; faqs: {question: string; answer: string}[];
    sources: ProjectSeoSource[]; image_alts: ProjectImageAlt[]; cornerstone_text: string;
  };
  marketing_tags: string[]; is_published: boolean; is_featured: boolean; story_blocks?: StoryBlock[]; section_colors: Record<string, string>;
  image_metadata: ProjectImageMetadata[];
}

export interface ProjectAdminResponse {
  project: ProjectFormData & { id: string; version: number; workflow_status?: string; publication_status?: string };
  live: (ProjectFormData & { id: string }) | null;
  validation: ValidationReport;
}

export interface ProjectListItem {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  location: string;
  price_range: string;
  status: ProjectStatus;
  seo_metadata?: Partial<ProjectFormData['seo_metadata']>;
  images?: string[];
  logo_url?: string;
  hero_images?: string[];
  is_published?: boolean;
  version?: number;
  workflow_status?: string;
  publication_status?: string;
  created_by?: string;
  author_id?: string;
  quality_summary?: { score: number; error_count: number; warning_count: number };
}

export const DEFAULT_PROJECT_FORM: ProjectFormData = {
  name: '', slug: '', slogan: '', tagline: '', developer: '', developer_description: '',
  primary_color: '#1a3a5c', accent_color: '#c9a85c',
  contact_phone: '', contact_email: '', contact_title: '', contact_description: '',
  location: '', location_description: '', map_embed_url: '', location_map_image: '', location_map_x: 50, location_map_y: 50, location_distances: [], location_distances_note: '',
  hero_images: [''], hero_video_url: '', master_plan_image: '', amenity_map_image: '', images: [''], stats_bg_image: '', contact_bg_image: '', logo_url: '',
  overview_images: ['', '', ''],
  overview_image_position: 'right',
  location_map_position: 'right',
  price_range: '', status: 'AVAILABLE', description: '', stats: {}, towers: [], amenity_floors: [], highlights: [], floor_layouts: [],
  amenities: [], amenity_template: 'PRIVE', amenity_gallery: [], master_plan_description: '', outdoor_amenities_description: '', indoor_amenities_description: '', interior_design_description: '',
  seo_metadata: {title: '', description: '', keywords: [], focus_keyword: '', usps: [], key_facts: [], faqs: [], sources: [], image_alts: [], cornerstone_text: ''},
  marketing_tags: [], is_published: false, is_featured: false, story_blocks: [], section_colors: {}, image_metadata: [],
};

export function normalizeProjectForm(input?: Partial<ProjectFormData>): ProjectFormData {
  const source = input || {};
  const seo = source.seo_metadata || DEFAULT_PROJECT_FORM.seo_metadata;
  const rawOverview = Array.isArray(source.overview_images)
    ? source.overview_images
    : (source.stats?.overview_images ? (() => { try { return JSON.parse(source.stats.overview_images); } catch { return []; } })() : (source.stats_bg_image ? [source.stats_bg_image] : []));
  const overview_images = [
    String(rawOverview?.[0] || source.stats_bg_image || ''),
    String(rawOverview?.[1] || ''),
    String(rawOverview?.[2] || ''),
  ];

  return {
    ...DEFAULT_PROJECT_FORM,
    ...source,
    location_distances_note: source.location_distances_note || source.stats?.['location_distances_note'] || '',
    developer_description: source.developer_description || source.stats?.['developer_description'] || source.stats?.['Mô tả CĐT'] || '',
    overview_image_position: (source.overview_image_position || source.stats?.['Vị trí ảnh'] || 'right') as 'left' | 'right',
    location_map_position: (source.location_map_position || source.stats?.['Vị trí bản đồ'] || 'right') as 'left' | 'right',
    stats: source.stats && typeof source.stats === 'object' ? source.stats : {},
    section_colors: source.section_colors && typeof source.section_colors === 'object' ? source.section_colors : {},
    hero_images: Array.isArray(source.hero_images) ? source.hero_images : [''],
    images: Array.isArray(source.images) ? source.images : [''],
    overview_images,
    location_distances: Array.isArray(source.location_distances) ? source.location_distances : [],
    towers: Array.isArray(source.towers) ? source.towers : [],
    amenity_floors: Array.isArray(source.amenity_floors) ? source.amenity_floors : [],
    highlights: Array.isArray(source.highlights) ? source.highlights : [],
    floor_layouts: Array.isArray(source.floor_layouts) ? source.floor_layouts : [],
    amenities: Array.isArray(source.amenities) ? source.amenities : [],
    amenity_gallery: Array.isArray(source.amenity_gallery) ? source.amenity_gallery : [],
    marketing_tags: Array.isArray(source.marketing_tags) ? source.marketing_tags : [],
    story_blocks: Array.isArray(source.story_blocks) ? source.story_blocks : [],
    image_metadata: Array.isArray(source.image_metadata) ? source.image_metadata : [],
    seo_metadata: {
      ...DEFAULT_PROJECT_FORM.seo_metadata,
      ...seo,
      keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
      usps: Array.isArray(seo.usps) ? seo.usps : [],
      key_facts: Array.isArray(seo.key_facts) ? seo.key_facts : [],
      faqs: Array.isArray(seo.faqs) ? seo.faqs : [],
      sources: Array.isArray(seo.sources) ? seo.sources : [],
      image_alts: Array.isArray(seo.image_alts) ? seo.image_alts : [],
    },
  };
}

export function projectImageEntries(project: ProjectFormData): ProjectImageEntry[] {
  const entries: ProjectImageEntry[] = [];
  const add = (field: string, label: string, value?: string) => {
    const url = value?.trim();
    if (!url) return;
    entries.push({field, label, url});
  };
  add('logo_url', 'Logo dự án', project.logo_url);
  project.hero_images.forEach((url, index) => add(`hero_images.${index}`, `Hero - ảnh ${index + 1}`, url));
  project.images.forEach((url, index) => add(`images.${index}`, `Thư viện chung - ảnh ${index + 1}`, url));
  const overviewList = (Array.isArray(project.overview_images) && project.overview_images.length > 0)
    ? project.overview_images
    : (project.stats?.overview_images ? (() => { try { return JSON.parse(project.stats.overview_images); } catch { return []; } })() : (project.stats_bg_image ? [project.stats_bg_image] : []));
  [0, 1, 2].forEach(index => {
    const u = overviewList?.[index];
    if (u && typeof u === 'string' && u.trim()) {
      add(`overview_images.${index}`, `Ảnh tổng quan ${index + 1}`, u.trim());
    }
  });
  if (project.stats_bg_image) {
    add('stats_bg_image', 'Tổng quan - ảnh nền', project.stats_bg_image);
  }
  add('contact_bg_image', 'Liên hệ - ảnh nền', project.contact_bg_image);
  add('location_map_image', 'Vị trí - bản đồ tĩnh', project.location_map_image);
  add('master_plan_image', 'Mặt bằng - master plan', project.master_plan_image);
  add('amenity_map_image', 'Sơ đồ tiện ích chung', project.amenity_map_image);
  project.story_blocks?.forEach((block, index) => add(`story_blocks.${index}.image_url`, `Câu chuyện - khối ${index + 1}`, block.image_url));
  project.highlights.forEach((item, index) => add(`highlights.${index}.image`, `Điểm nổi bật - ${item.title || `mục ${index + 1}`}`, item.image));
  project.amenity_floors.forEach((floor, floorIndex) => {
    const floorLabel = floor.floor_label || `tầng/khu ${floorIndex + 1}`;
    add(`amenity_floors.${floorIndex}.floor_map_image`, `Sơ đồ tiện ích - ${floorLabel}`, floor.floor_map_image);
    floor.amenities.forEach((item, itemIndex) => add(
      `amenity_floors.${floorIndex}.amenities.${itemIndex}.image_url`,
      `Tiện ích ${floorLabel} - ${item.name || `mục ${itemIndex + 1}`}`,
      item.image_url,
    ));
  });
  project.amenity_gallery.forEach((item, index) => add(
    `amenity_gallery.${index}.image_url`,
    `Thư viện tiện ích - ${item.name || `ảnh ${index + 1}`}`,
    item.image_url,
  ));
  project.floor_layouts.forEach((group, groupIndex) => {
    const groupLabel = group.group_name || `nhóm ${groupIndex + 1}`;
    add(`floor_layouts.${groupIndex}.floor_map_image`, `Mặt bằng - ${groupLabel}`, group.floor_map_image);
    group.unit_layouts.forEach((item, itemIndex) => add(
      `floor_layouts.${groupIndex}.unit_layouts.${itemIndex}.image_url`,
      `Mẫu căn ${groupLabel} - ${item.name || `mẫu ${itemIndex + 1}`}`,
      item.image_url,
    ));
  });
  project.towers.forEach((tower, towerIndex) => tower.floor_plan_images.forEach((url, imageIndex) => add(
    `towers.${towerIndex}.floor_plan_images.${imageIndex}`,
    `Tháp ${tower.name || tower.id || towerIndex + 1} - mặt bằng ${imageIndex + 1}`,
    url,
  )));
  return entries;
}

export function projectImageUrls(project: ProjectFormData): string[] {
  return [...new Set(projectImageEntries(project).map(entry => entry.url))];
}

export function projectImageMetadata(
  project: Pick<ProjectFormData, 'image_metadata' | 'seo_metadata'>,
  field: string,
  url = '',
): ProjectImageMetadata {
  const exact = project.image_metadata.find(item => item.field === field);
  if (exact) return exact;
  return {
    field,
    media_id: '',
    url,
    alt_text: project.seo_metadata.image_alts.find(item => item.url === url)?.alt_text || '',
    width: 0,
    height: 0,
    focal_x: 50,
    focal_y: 50,
    variants: {},
  };
}

export function reconcileProjectImageMetadata(project: ProjectFormData): ProjectFormData {
  const existing = Array.isArray(project.image_metadata) ? project.image_metadata : [];
  const image_metadata = projectImageEntries(project).map(({field, url}) => {
    const source = existing.find(item => item.field === field && item.url === url)
      || existing.find(item => item.url === url);
    if (source) return {...source, field, url};
    return projectImageMetadata(project, field, url);
  });
  const image_alts = Array.from(new Map(
    image_metadata.map(item => [item.url, {url: item.url, alt_text: item.alt_text}]),
  ).values());
  return {
    ...project,
    image_metadata,
    seo_metadata: {...project.seo_metadata, image_alts},
  };
}
