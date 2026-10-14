export const revalidate = 300;

import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getAssetUrl } from '@/lib/api';
import ProjectModernDetailView, { type ProjectModernData } from '@/features/projects/ProjectModernDetailView';
import { ProjectImageMetadataProvider } from '@/features/projects/ResponsiveProjectImage';
import { buildProjectStructuredData, safeJsonLd } from '@/features/content/public/structured-data';
import type { ProjectImageMetadata } from '@/features/content/projects/project-form-contract';

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

// Defer every project to its first runtime request so image builds never depend on the backend.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

type ProjectSeoFaq = {
  question: string;
  answer: string;
};

type ProjectSeoMetadata = {
  title?: string;
  description?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  keywords?: string[];
  focus_keyword?: string;
  cornerstone_text?: string;
  usps?: string[];
  key_facts?: string[];
  faqs?: ProjectSeoFaq[];
  sources?: Array<{title: string; url: string}>;
  image_alts?: Array<{url: string; alt_text: string}>;
};

type ImageItem = {
  name?: string;
  image_url?: string;
  description?: string;
  category?: string;
  icon?: string;
  bedrooms?: number;
  bathrooms?: number;
  gross_area?: number;
  net_area?: number;
  door_direction?: string;
  balcony_direction?: string;
  view_direction?: string;
  [key: string]: unknown;
};

type FloorLayoutGroup = {
  group_name?: string;
  floors?: number[];
  floor_map_image?: string;
  unit_layouts?: ImageItem[];
  hotspots?: unknown[];
  [key: string]: unknown;
};

type AmenityFloor = {
  floor_name?: string;
  floor_map_image?: string;
  amenities?: ImageItem[];
  [key: string]: unknown;
};

type ProjectData = {
  id: string;
  name: string;
  slug: string;
  slogan: string;
  tagline: string;
  description: string;
  location: string;
  location_description: string;
  developer: string;
  developer_description?: string;
  is_featured?: boolean;
  hero_images: string[];
  master_plan_image: string;
  amenity_map_image: string;
  images: string[];
  logo_url: string;
  primary_color: string;
  accent_color: string;
  price_range: string;
  status: string;
  stats: Record<string, string>;
  towers: unknown[];
  amenities: unknown[];
  amenity_floors: AmenityFloor[];
  amenity_template: string;
  highlights: unknown[];
  floor_layouts: FloorLayoutGroup[];
  location_distances: Array<{ destination?: string; distance?: string; distance_km?: string; icon?: string }>;
  location_distances_note?: string;
  map_embed_url: string;
  location_map_image: string;
  location_map_x: number;
  location_map_y: number;
  hero_video_url: string;
  overview_image_position?: 'left' | 'right';
  location_map_position?: 'left' | 'right';
  overview_images?: string[];
  stats_bg_image: string;
  contact_bg_image: string;
  contact_phone: string;
  contact_email: string;
  contact_title: string;
  contact_description: string;
  master_plan_description: string;
  seo_metadata: ProjectSeoMetadata;
  marketing_tags: unknown[];
  amenity_gallery: ImageItem[];
  outdoor_amenities_description: string;
  indoor_amenities_description: string;
  interior_design_description: string;
  story_blocks: unknown[];
  section_colors: Record<string, string>;
  image_metadata: ProjectImageMetadata[];
  updated_at: string;
};


const SAMPLE_EATON_PARK: ProjectData = {
  id: 'eaton-park-sample',
  name: 'Eaton Park Thủ Đức',
  slug: 'eaton-park',
  slogan: 'Biểu Tượng Sống Chuẩn Sinh Thái Quốc Tế',
  tagline: 'Kiệt Tác Kiến Trúc Ven Sông Của Gamuda Land',
  description: 'Eaton Park là tổ hợp căn hộ hạng sang được kiến tạo theo tiêu chuẩn sinh thái xanh quốc tế bởi chủ đầu tư danh tiếng Gamuda Land. Tọa lạc tại quỹ đất vàng đắc địa nhất khu vực, dự án hòa quyện hoàn hảo giữa không gian sống thanh bình ven sông cùng hệ thống tiện ích đẳng cấp vượt trội mang lại đặc quyền sống vương giả cho cộng đồng cư dân tinh hoa.',
  location: 'Mặt tiền Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh',
  location_description: 'Nằm ngay trục đại lộ Mai Chí Thọ giao với cao tốc TP.HCM - Long Thành - Dầu Giây, chỉ mất 10 phút về Quận 1.',
  developer: 'Gamuda Land',
  is_featured: true,
  developer_description: '',
  hero_images: [
    '/images/The_Prive/prive.jpg',
    '/images/The_Prive/theprive02.jpg',
    '/images/The_Prive/theprive03.jpg',
    '/images/The_Prive/theprive06.jpg',
    '/images/The_Prive/theprive10.jpg',
  ],
  master_plan_image: '/images/The_Prive/glb1.jpg',
  amenity_map_image: '',
  images: [
    '/images/The_Prive/prive.jpg',
    '/images/The_Prive/theprive02.jpg',
    '/images/The_Prive/theprive03.jpg',
  ],
  logo_url: '',
  primary_color: '#0F1E36',
  accent_color: '#C5A059',
  price_range: '120 - 135 triệu/m²',
  status: 'AVAILABLE',
  stats: {
    'Quy mô': '3.68 ha - 6 Tòa tháp',
    'Số căn hộ': '1,980 căn cao cấp',
    'Loại hình': 'Căn hộ 1-3PN, Shophouse, Duplex',
    'Pháp lý': 'Sổ hồng lâu dài',
    'Bàn giao': 'Dự kiến Quý IV/2026',
    'Mật độ xây dựng': '20.7%',
  },
  towers: [],
  amenities: [],
  amenity_floors: [],
  amenity_template: 'PRIVE',
  highlights: [],
  floor_layouts: [
    {
      group_name: 'Tháp Grove A5',
      floor_map_image: '/images/The_Prive/TANG-21_TW9.jpg',
      unit_layouts: [
        {
          name: 'Căn B6b - 2PN',
          bedrooms: 2,
          bathrooms: 2,
          gross_area: 79.5,
          net_area: 73.2,
          door_direction: 'Tây Bắc',
          balcony_direction: 'Đông Nam',
          view_direction: 'Sông Sài Gòn & Công viên nội khu',
          image_url: '/images/The_Prive/layout2PN.png',
          description: 'Thiết kế 2 phòng ngủ thông minh, tối ưu diện tích đón sáng tự nhiên và luồng gió đối lưu.',
        },
        {
          name: 'Căn A3.3b - 1PN',
          bedrooms: 1,
          bathrooms: 1,
          gross_area: 55.8,
          net_area: 50.4,
          door_direction: 'Tây Nam',
          balcony_direction: 'Đông Bắc',
          view_direction: 'Hồ bơi vô cực Lumina',
          image_url: '/images/The_Prive/layout1PN.png',
          description: 'Căn hộ 1 phòng ngủ cao cấp với phòng khách mở, ban công kính tràn viền panoramic.',
        },
        {
          name: 'Căn C2 - 3PN',
          bedrooms: 3,
          bathrooms: 2,
          gross_area: 104.8,
          net_area: 96.5,
          door_direction: 'Đông Bắc',
          balcony_direction: 'Tây Nam',
          view_direction: 'Trực diện Sông Sài Gòn & Landmark 81',
          image_url: '/images/The_Prive/layout3PN.png',
          description: 'Căn góc 3 phòng ngủ với 2 mặt thoáng view sông vĩnh viễn, ban công rộng 6m.',
        },
      ],
    },
    {
      group_name: 'Tháp Strait A6',
      floor_map_image: '/images/The_Prive/TANG-21_TW9.jpg',
      unit_layouts: [
        {
          name: 'Căn B4a - 2PN',
          bedrooms: 2,
          bathrooms: 2,
          gross_area: 76.8,
          net_area: 71.0,
          door_direction: 'Đông Nam',
          balcony_direction: 'Tây Bắc',
          view_direction: 'Đại lộ Mai Chí Thọ',
          image_url: '/images/The_Prive/layout2PN.png',
          description: 'Căn hộ 2 phòng ngủ hiện đại, bố trí bếp kín riêng biệt chống mùi tối đa.',
        },
        {
          name: 'Căn A2 - 1PN',
          bedrooms: 1,
          bathrooms: 1,
          gross_area: 52.4,
          net_area: 47.8,
          door_direction: 'Đông Bắc',
          balcony_direction: 'Tây Nam',
          view_direction: 'Khu công viên kênh sinh thái',
          image_url: '/images/The_Prive/layout1PN.png',
          description: 'Căn hộ 1 phòng ngủ nhỏ gọn, tối ưu công năng cho gia đình trẻ hoặc chuyên gia.',
        },
      ],
    },
    {
      group_name: 'Mặt bằng tổng thể',
      floor_map_image: '/images/The_Prive/glb1.jpg',
      unit_layouts: [],
    },
  ],
  location_distances: [
    { destination: 'Tuyến Metro số 1 Bến Thành - Suối Tiên', distance: '3 phút' },
    { destination: 'Cầu Ba Son & Trung tâm Quận 1', distance: '10 phút' },
    { destination: 'Trường Quốc tế AIS, BIS', distance: '5 phút' },
    { destination: 'Sân bay Quốc tế Long Thành', distance: '30 phút' },
  ],
  map_embed_url: '',
  location_map_image: '/images/The_Prive/prive_map.jpg',
  location_map_x: 50.0,
  location_map_y: 50.0,
  hero_video_url: '',
  stats_bg_image: '',
  contact_bg_image: '',
  contact_phone: '090 123 4567',
  contact_email: 'info@maianhomes.vn',
  contact_title: 'Đăng Ký Tư Vấn Dự Án Eaton Park',
  contact_description: 'Nhận bảng giá và tài liệu trực tiếp từ chuyên viên tư vấn.',
  master_plan_description: '100% Căn hộ sở hữu tầm view thoáng đãng hướng sông Sài Gòn',
  seo_metadata: {
    title: 'Dự Án Eaton Park Thủ Đức | Gamuda Land | Bảng Giá & Mặt Bằng Chi Tiết',
    description: 'Thông tin chi tiết dự án Eaton Park Gamuda Land tại Mai Chí Thọ Thủ Đức: Giá bán từ 120 triệu/m², mặt bằng 3 cấp độ, tiện ích và brochure chính thức.',
    keywords: ['Eaton Park', 'Eaton Park Thủ Đức', 'Gamuda Land', 'căn hộ Mai Chí Thọ', 'bảng giá Eaton Park'],
    faqs: [
      {
        question: 'Vị trí chính xác dự án Eaton Park ở đâu?',
        answer: 'Dự án tọa lạc tại mặt tiền đường Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, kết nối trực tiếp đến hầm Thủ Thiêm và Quận 1.',
      },
      {
        question: 'Giá bán dự kiến căn hộ Eaton Park là bao nhiêu?',
        answer: 'Giá bán rumor dao động từ 120 - 135 triệu/m² tùy tầng và hướng view.',
      },
      {
        question: 'Pháp lý dự án Eaton Park như thế nào?',
        answer: 'Dự án có đầy đủ quy hoạch 1/500, giấy phép xây dựng và sổ hồng sở hữu lâu dài cho người Việt Nam.',
      },
    ],
  },
  marketing_tags: ['Nổi bật', 'Mở bán đợt 1', 'Gamuda Land'],
  amenity_gallery: [
    {
      name: 'Hồ bơi vô cực Lumina',
      image_url: '/images/The_Prive/TPV - HỒ BƠI LUMINA.jpg',
      description: 'Hồ bơi tràn viền nước mặn chuẩn Olympic với công nghệ lọc điện phân muối khoáng.',
      category: 'Sống khỏe',
    },
    {
      name: 'Phòng gym The Long & Yoga',
      image_url: '/images/The_Prive/TPV - THE LONG GYM.jpg',
      description: 'Trang thiết bị Technogym nhập khẩu cao cấp, tầm nhìn trực diện hồ bơi và mảng xanh.',
      category: 'Sống khỏe',
    },
    {
      name: 'Phòng tiệc VIP Jumeirah',
      image_url: '/images/The_Prive/TPV - PHÒNG TIỆC JUMEIRAH.jpg',
      description: 'Không gian tổ chức tiệc riêng tư sang trọng chuẩn 5 sao dành cho cư dân.',
      category: 'Giải trí',
    },
    {
      name: 'Đài vọng cảnh Sky Panorama',
      image_url: '/images/The_Prive/TPV - ĐÀI VỌNG CẢNH.jpg',
      description: 'Tầm nhìn 360 độ ngắm trọn hoàng hôn Sài Gòn và pháo hoa Landmark 81.',
      category: 'Cảnh quan',
    },
  ],
  outdoor_amenities_description: '',
  indoor_amenities_description: '',
  interior_design_description: '',
  story_blocks: [],
  section_colors: {},
  image_metadata: [],
  updated_at: new Date().toISOString(),
};

const fetchProject = cache(async (slug: string): Promise<ProjectData | null> => {
    try {
      const res = await fetch(`${API_URL}/api/public/projects/${encodeURIComponent(slug)}`, {
        cache: 'force-cache',
        next: { revalidate: 60, tags: ['projects', 'project-' + slug] },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) {
        if (slug === 'eaton-park' || slug === 'mau-du-an' || slug === 'demo') {
          return SAMPLE_EATON_PARK;
        }
        return null;
      }
      if (!res.ok) {
        if (slug === 'eaton-park' || slug === 'mau-du-an' || slug === 'demo') {
          return SAMPLE_EATON_PARK;
        }
        throw new Error(`Project API failed with status ${res.status}`);
      }
      const d = await res.json() as Partial<ProjectData> & { _id?: string; lastUpdated?: string };
      return {
        id: d.id || d._id || '',
        name: d.name || '', slug: d.slug || slug,
        slogan: d.slogan || '',
        tagline: d.tagline || '',
        description: d.description || '', location: d.location || '', location_description: d.location_description || '',
        developer: d.developer || '',
        developer_description: d.developer_description || '',
        is_featured: Boolean(d.is_featured),
        hero_images: d.hero_images?.length ? d.hero_images : d.images?.length ? d.images : [],
      master_plan_image: d.master_plan_image || '',
      amenity_map_image: d.amenity_map_image || '',
      images: d.images || [],
      logo_url: d.logo_url || '',
      primary_color: d.primary_color || '#1a3a5c',
      accent_color: d.accent_color || '#c9a85c',
      price_range: d.price_range || '',
      status: d.status || 'AVAILABLE',
      stats: d.stats || {},
      towers: d.towers || [],
      amenities: d.amenities || [],
      amenity_floors: d.amenity_floors || [],
      amenity_template: d.amenity_template || 'PRIVE',
      highlights: d.highlights || [],
      floor_layouts: d.floor_layouts || [],
      location_distances: d.location_distances || [],
      map_embed_url: d.map_embed_url || '',
      location_map_image: d.location_map_image || '',
      location_map_x: d.location_map_x ?? 50.0,
      location_map_y: d.location_map_y ?? 50.0,
      hero_video_url: d.hero_video_url || '',
      overview_image_position: (d.overview_image_position || d.stats?.['Vị trí ảnh'] || 'right') as 'left' | 'right',
      location_map_position: (d.location_map_position || d.stats?.['Vị trí bản đồ'] || 'right') as 'left' | 'right',
      overview_images: (() => {
        if (Array.isArray(d.overview_images) && d.overview_images.length > 0) {
          return d.overview_images.filter(Boolean);
        }
        if (d.stats?.['overview_images']) {
          try {
            const parsed = JSON.parse(d.stats['overview_images']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
          } catch {
            // ignore
          }
        }
        if (d.stats_bg_image) return [d.stats_bg_image];
        return [];
      })(),
      stats_bg_image: d.stats_bg_image || '',
      contact_bg_image: d.contact_bg_image || '',
      contact_phone: d.contact_phone || '',
      contact_email: d.contact_email || '',
      contact_title: d.contact_title || '',
      contact_description: d.contact_description || '',
      master_plan_description: d.master_plan_description || '',
      seo_metadata: d.seo_metadata || {},
      marketing_tags: d.marketing_tags || [],
      amenity_gallery: d.amenity_gallery || [],
      outdoor_amenities_description: d.outdoor_amenities_description || '',
      indoor_amenities_description: d.indoor_amenities_description || '',
      interior_design_description: d.interior_design_description || '',
      story_blocks: d.story_blocks || [],
      section_colors: d.section_colors || {},
      image_metadata: d.image_metadata || [],
      updated_at: d.updated_at || d.lastUpdated || '',
    };
  } catch {
    if (slug === 'eaton-park' || slug === 'mau-du-an' || slug === 'demo') {
      return SAMPLE_EATON_PARK;
    }
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchProject(slug);
  if (!p) return { title: 'Dự án không tồn tại' };
  const seo = p.seo_metadata || {};
  const canonical = seo.canonical_url || `${SITE_URL}/du_an/${p.slug}`;
  const heroMetadata = p.image_metadata.find(item => item.field === 'hero_images.0')
    || p.image_metadata.find(item => item.url === p.hero_images?.[0]);
  const socialImage = heroMetadata?.variants?.og_webp || seo.og_image || p.hero_images?.[0] || p.images?.[0] || '';
  const resolvedSocialImage = getAssetUrl(socialImage) || '';
  const rawTitle = seo.title || p.name || 'Dự án';
  const cleanTitle = rawTitle.replace(/\s*\|\s*Maian Homes.*$/i, '').trim();
  const pageTitle = `${cleanTitle} | Maian Homes`;
  return {
    title: cleanTitle,
    description: seo.description || p.description?.substring(0, 160),
    keywords: seo.keywords,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description: seo.og_description || seo.description || p.description,
      url: canonical,
      type: 'website',
      images: [{ url: resolvedSocialImage, width: 1200, height: 630, alt: heroMetadata?.alt_text || p.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: seo.description || p.description,
      images: [resolvedSocialImage],
    },
  };
}

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProject(slug);

  if (!p) {
    notFound();
  }

  const heroImg = getAssetUrl(p.hero_images?.[0] || p.images?.[0]) || '';
  const resolvedAmenityMapImage = p.amenity_map_image ? (getAssetUrl(p.amenity_map_image) || '') : '';
  const resolvedLocationMapImage = p.location_map_image ? (getAssetUrl(p.location_map_image) || '') : '';

  const resolvedFloorLayouts = p.floor_layouts?.map((group: FloorLayoutGroup) => ({
    ...group,
    floor_map_image: group.floor_map_image ? (getAssetUrl(group.floor_map_image) || '') : '',
    unit_layouts: group.unit_layouts?.map((layout: ImageItem) => ({
      ...layout,
      image_url: getAssetUrl(layout.image_url) || '',
    })) || [],
  })) || [];

  const resolvedAmenityGallery = p.amenity_gallery?.map((item: ImageItem) => ({
    ...item,
    image_url: getAssetUrl(item.image_url) || '',
  })) || [];

  const leanImageMetadata = p.image_metadata?.map((img) => ({
    field: (img as unknown as { field?: string }).field || '',
    url: (img as unknown as { url?: string; original_url?: string }).url || (img as unknown as { url?: string; original_url?: string }).original_url || '',
    focal_x: (img as unknown as { focal_x?: number }).focal_x ?? 50,
    focal_y: (img as unknown as { focal_y?: number }).focal_y ?? 50,
    variants: (img as unknown as { variants?: Record<string, string> }).variants || {},
    media_id: (img as unknown as { media_id?: string }).media_id || '',
    alt_text: (img as unknown as { alt_text?: string }).alt_text || '',
    width: (img as unknown as { width?: number }).width || 0,
    height: (img as unknown as { height?: number }).height || 0,
  }));

  const resolvedAmenityFloors = p.amenity_floors?.map((floor: AmenityFloor) => ({
    ...floor,
    floor_map_image: floor.floor_map_image ? (getAssetUrl(floor.floor_map_image) || '') : '',
    amenities: floor.amenities?.map((amenity: ImageItem) => ({
      ...amenity,
      image_url: getAssetUrl(amenity.image_url) || '',
    })) || [],
  })) || [];

  const clientProject = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    developer: p.developer,
    developer_description: p.developer_description,
    is_featured: p.is_featured,
    marketing_tags: (p.marketing_tags || []) as string[],
    slogan: p.slogan,
    tagline: p.tagline,
    logo_url: p.logo_url ? (getAssetUrl(p.logo_url) || p.logo_url) : '',
    description: p.description,
    location: p.location,
    location_description: p.location_description,
    location_distances: p.location_distances,
    location_distances_note: p.location_distances_note || p.stats?.['location_distances_note'] || '',
    stats: p.stats,
    price_range: p.price_range,
    status: p.status,
    location_map_position: p.location_map_position,
    overview_images: p.overview_images,
    primary_color: p.primary_color,
    accent_color: p.accent_color,
    section_colors: {},
    hero_video_url: p.hero_video_url,
    hero_images: p.hero_images,
    stats_bg_image: p.stats_bg_image,
    location_map_x: p.location_map_x,
    location_map_y: p.location_map_y,
    location_map_image: resolvedLocationMapImage,
    map_embed_url: p.map_embed_url,
    master_plan_image: p.master_plan_image ? (getAssetUrl(p.master_plan_image) || p.master_plan_image) : '',
    master_plan_description: p.master_plan_description,
    floor_layouts: resolvedFloorLayouts as unknown as ProjectModernData['floor_layouts'],
    amenities: p.amenities,
    amenity_template: p.amenity_template,
    amenity_map_image: resolvedAmenityMapImage,
    amenity_gallery: resolvedAmenityGallery as unknown as ProjectModernData['amenity_gallery'],
    amenity_floors: resolvedAmenityFloors as unknown as ProjectModernData['amenity_floors'],
    images: p.images,
    outdoor_amenities_description: p.outdoor_amenities_description,
    indoor_amenities_description: p.indoor_amenities_description,
    interior_design_description: p.interior_design_description,
    story_blocks: p.story_blocks,
    contact_bg_image: p.contact_bg_image ? (getAssetUrl(p.contact_bg_image) || '') : '',
    contact_title: p.contact_title,
    contact_description: p.contact_description,
    contact_phone: p.contact_phone,
    contact_email: p.contact_email,
    seo_metadata: p.seo_metadata,
  } as unknown as ProjectModernData;

  const schemaOrgJSONLD = buildProjectStructuredData(p, heroImg);
  return (
    <>
      {heroImg && (
        <link rel="preload" as="image" href={heroImg} fetchPriority="high" />
      )}
      {/* Tiêm JSON-LD Ẩn cho AI Bot & Google Bot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schemaOrgJSONLD) }}
      />
      <ProjectImageMetadataProvider metadata={leanImageMetadata}>
        <ProjectModernDetailView project={clientProject} />
      </ProjectImageMetadataProvider>
    </>
  );
}
