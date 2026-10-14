'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Phone, Mail, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Maximize2, X, Check, Building2, Sparkles,
  Layers, FileText, CheckCircle2,
  Share2, HelpCircle, Play,
  Clock, User, Send
} from 'lucide-react';
import { getAssetUrl } from '@/lib/api';

export interface UnitLayout {
  name: string;
  bedrooms: number;
  bathrooms: number;
  gross_area: number;
  net_area: number;
  door_direction?: string;
  balcony_direction?: string;
  view_direction?: string;
  image_url: string;
  description?: string;
}

export interface FloorLayoutGroup {
  group_name: string;
  floors?: number[];
  floor_map_image?: string;
  unit_layouts?: UnitLayout[];
  hotspots?: Array<{
    unit_code?: string;
    unit_number: string;
    position_x: number;
    position_y: number;
    layout_name: string;
  }>;
}

export interface ProjectAmenityItem {
  name: string;
  image_url: string;
  description?: string;
  category?: string;
  icon?: string;
}

export interface ProjectFaqItem {
  question: string;
  answer: string;
}

export interface ProjectModernData {
  id?: string;
  name: string;
  slug: string;
  slogan?: string;
  tagline?: string;
  description?: string;
  developer?: string;
  developer_description?: string;
  location?: string;
  location_description?: string;
  price_range?: string;
  status?: string;
  is_featured?: boolean;
  marketing_tags?: string[];
  primary_color?: string;
  accent_color?: string;
  hero_images?: string[];
  hero_video_url?: string;
  overview_images?: string[];
  images?: string[];
  logo_url?: string;
  master_plan_image?: string;
  master_plan_description?: string;
  location_map_image?: string;
  map_embed_url?: string;
  location_distances_note?: string;
  stats?: Record<string, string>;
  floor_layouts?: FloorLayoutGroup[];
  amenity_gallery?: ProjectAmenityItem[];
  amenities?: unknown[];
  outdoor_amenities_description?: string;
  indoor_amenities_description?: string;
  interior_design_description?: string;
  amenity_floors?: Array<{
    id?: string;
    floor_name?: string;
    floor_label?: string;
    floor_map_image: string;
    amenities: Array<{
      name: string;
      number?: number;
      position_x?: number;
      position_y?: number;
      description?: string;
      image_url?: string;
      category?: string;
    }>;
  }>;
  location_distances?: Array<{ destination?: string; distance?: string; distance_km?: string; icon?: string }>;
  contact_phone?: string;
  contact_email?: string;
  contact_title?: string;
  contact_description?: string;
  contact_bg_image?: string;
  story_blocks?: Array<{ title?: string; content?: string; image_url?: string; alignment?: 'left' | 'right' }>;
  section_colors?: Record<string, string>;
  seo_metadata?: {
    title?: string;
    description?: string;
    cornerstone_text?: string;
    faqs?: ProjectFaqItem[];
    usps?: string[];
    key_facts?: string[];
    keywords?: string[];
    sources?: Array<{ title: string; url: string }>;
  };
}

interface ProjectModernDetailViewProps {
  project: ProjectModernData;
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Đang mở bán', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  PRE_SALE: { label: 'Sắp mở bán', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  HANDING_OVER: { label: 'Đang bàn giao', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
};

export default function ProjectModernDetailView({ project }: ProjectModernDetailViewProps) {
  const accentColor = project.accent_color || '#C5A059';

  // Standard theme: Clean white background with dark text
  const getSectionTheme = () => ({
    bgStyle: {} as React.CSSProperties,
    isDark: false,
    containerClass: 'bg-white text-[#1E293B]',
    headingClass: 'text-[#0F1E36]',
    mutedClass: 'text-gray-500',
    subCardClass: 'bg-slate-50/70 text-gray-800',
    bodyTextClass: 'text-gray-600',
  });

  const heroTheme = getSectionTheme();
  const overviewTheme = getSectionTheme();
  const locationTheme = getSectionTheme();
  const matBangTheme = getSectionTheme();
  const tienIchTheme = getSectionTheme();
  const developerTheme = getSectionTheme();
  const faqTheme = getSectionTheme();

  // Sub-navigation state & scrollspy (5 mục chính)
  const [activeTab, setActiveTab] = useState<string>('tong-quan');
  const navRef = useRef<HTMLDivElement>(null);

  // Hero gallery 60% selected image
  const [heroSelectedImageIdx, setHeroSelectedImageIdx] = useState(0);

  // Consolidated gallery images (declared before hero / overview carousel effects)
  const allImages = useMemo(() => {
    const list: string[] = [];
    if (project.hero_images && project.hero_images.length > 0) {
      list.push(...project.hero_images.filter(Boolean));
    }
    if (project.images && project.images.length > 0) {
      project.images.forEach(img => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    // Fallback images if empty
    if (list.length === 0) {
      list.push(
        '/images/The_Prive/prive.jpg',
        '/images/The_Prive/theprive02.jpg',
        '/images/The_Prive/theprive03.jpg',
        '/images/The_Prive/theprive06.jpg',
        '/images/The_Prive/theprive10.jpg'
      );
    }
    return list;
  }, [project.hero_images, project.images]);

  // Popup Modal đăng ký nhận thông tin & báo giá
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Description expand/collapse state
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Gallery lightbox modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Video modal state & URL parser
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const embedVideoUrl = useMemo(() => {
    if (!project.hero_video_url) return null;
    const match = project.hero_video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` : null;
  }, [project.hero_video_url]);

  // Overview images list
  const overviewImagesList = useMemo(() => {
    return (project.overview_images || []).filter(Boolean) as string[];
  }, [project.overview_images]);
  const [overviewCarouselIdx, setOverviewCarouselIdx] = useState(0);
  const [isOverviewCarouselPaused, setIsOverviewCarouselPaused] = useState(false);

  // Auto-fading Carousel for Section 1 overview images (fade transition every 4s when >= 3 images)
  useEffect(() => {
    if (overviewImagesList.length < 3 || isOverviewCarouselPaused) return;
    const timer = setInterval(() => {
      setOverviewCarouselIdx(prev => (prev + 1) % overviewImagesList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [overviewImagesList.length, isOverviewCarouselPaused]);

  // Auto-fading Carousel for Hero top showcase when allImages >= 3 (4s interval)
  const [isHeroCarouselPaused, setIsHeroCarouselPaused] = useState(false);
  useEffect(() => {
    if (allImages.length < 3 || isHeroCarouselPaused) return;
    const timer = setInterval(() => {
      setHeroSelectedImageIdx(prev => (prev + 1) % Math.min(allImages.length, 5));
    }, 4000);
    return () => clearInterval(timer);
  }, [allImages.length, isHeroCarouselPaused]);

  const [isAmenitiesExpanded, setIsAmenitiesExpanded] = useState(false);

  // Floor plan interactive state
  const [activeTowerIdx, setActiveTowerIdx] = useState(0);
  const [floorPlanMode, setFloorPlanMode] = useState<'floor' | 'unit'>('unit');
  const [bedroomFilter, setBedroomFilter] = useState<number | null>(null);
  const [activeUnitIdx, setActiveUnitIdx] = useState(0);
  const [blueprintZoomOpen, setBlueprintZoomOpen] = useState(false);
  const [zoomAmenityImage, setZoomAmenityImage] = useState<{ url: string; name: string } | null>(null);

  // Location map view mode
  const [mapMode, setMapMode] = useState<'map' | 'google'>('map');

  // Consultation form state
  const [leadFormSubmitted, setLeadFormSubmitted] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    name: '',
    phone: '',
    email: '',
    unitType: '',
    purpose: 'Ở thực',
    notes: '',
  });



  // Floor plan groups (Always include Master Plan if uploaded, then Towers)
  const floorLayoutGroups = useMemo<FloorLayoutGroup[]>(() => {
    const list: FloorLayoutGroup[] = [];
    if (project.master_plan_image) {
      list.push({
        group_name: 'Mặt bằng tổng thể',
        floor_map_image: project.master_plan_image,
        unit_layouts: [],
      });
    }
    if (project.floor_layouts && project.floor_layouts.length > 0) {
      list.push(...project.floor_layouts);
    }
    if (list.length === 0) {
      // Realistic fallback data matching Eaton Park / The Prive luxury project
      return [
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
          floor_map_image: project.master_plan_image || '/images/The_Prive/glb1.jpg',
          unit_layouts: [],
        },
      ];
    }
    return list;
  }, [project.floor_layouts, project.master_plan_image]);

  const activeGroup = floorLayoutGroups[activeTowerIdx] || floorLayoutGroups[0];

  // Aggregated all unit layouts across all groups/towers (excluding pure master plan)
  const allUnitDesigns = useMemo<Array<UnitLayout & { towerName?: string }>>(() => {
    const list: Array<UnitLayout & { towerName?: string }> = [];
    floorLayoutGroups.forEach(group => {
      if (group.group_name === 'Mặt bằng tổng thể') return;
      (group.unit_layouts || []).forEach(u => {
        list.push({
          ...u,
          towerName: group.group_name,
        });
      });
    });
    if (list.length === 0) {
      // Fallback realistic layouts
      return [
        {
          name: 'Căn B6b - 2PN',
          towerName: 'Tháp Grove A5',
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
          towerName: 'Tháp Grove A5',
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
          towerName: 'Tháp Grove A5',
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
      ];
    }
    return list;
  }, [floorLayoutGroups]);

  // Available bedroom options across all unit designs
  const availableBedroomOptions = useMemo(() => {
    const set = new Set<number>();
    allUnitDesigns.forEach(u => {
      if (typeof u.bedrooms === 'number' && u.bedrooms > 0) {
        set.add(u.bedrooms);
      }
    });
    const sorted = Array.from(set).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [1, 2, 3];
  }, [allUnitDesigns]);

  // Dynamic unit types derived from project floor layouts and stats entered in CMS
  const availableUnitTypes = useMemo<string[]>(() => {
    const typesSet = new Set<string>();

    // 1. Extract from all unit layouts across all floor layout groups
    if (allUnitDesigns && allUnitDesigns.length > 0) {
      const bedroomsSet = new Set<number>();
      const specialTypes = new Set<string>();

      allUnitDesigns.forEach(u => {
        const lowerName = (u.name || '').toLowerCase();
        let isSpecial = false;

        if (lowerName.includes('penthouse')) {
          specialTypes.add('Penthouse');
          isSpecial = true;
        }
        if (lowerName.includes('duplex')) {
          specialTypes.add('Duplex');
          isSpecial = true;
        }
        if (lowerName.includes('shophouse')) {
          specialTypes.add('Shophouse');
          isSpecial = true;
        }
        if (lowerName.includes('studio')) {
          specialTypes.add('Căn Studio');
          isSpecial = true;
        }
        if (lowerName.includes('sky villa')) {
          specialTypes.add('Sky Villa');
          isSpecial = true;
        }
        if (lowerName.includes('officetel')) {
          specialTypes.add('Officetel');
          isSpecial = true;
        }

        // If it's a standard bedroom unit, collect the bedroom count
        if (typeof u.bedrooms === 'number' && u.bedrooms > 0) {
          if (!isSpecial || u.bedrooms <= 3) {
            bedroomsSet.add(u.bedrooms);
          }
        } else if (!isSpecial && u.name && u.name.trim().length <= 25) {
          specialTypes.add(u.name.trim());
        }
      });

      // Add bedrooms in numeric order: Căn 1 PN, Căn 2 PN, Căn 3 PN...
      Array.from(bedroomsSet)
        .sort((a, b) => a - b)
        .forEach(num => typesSet.add(`Căn ${num} PN`));

      // Add special types: Studio, Duplex, Penthouse, etc.
      specialTypes.forEach(t => typesSet.add(t));
    }

    // 2. Extract from project.stats: 'Loại hình', 'Loại hình sản phẩm', 'Cơ cấu sản phẩm'
    const statTypesStr = project.stats?.['Loại hình'] || project.stats?.['Loại hình sản phẩm'] || project.stats?.['Cơ cấu sản phẩm'] || project.stats?.['Cơ cấu căn hộ'];
    if (statTypesStr && typeof statTypesStr === 'string') {
      const tokens = statTypesStr.split(/[,;\n/•]+/).map(s => s.trim()).filter(Boolean);
      tokens.forEach(token => {
        if (token.length > 0 && token.length <= 30) {
          const lower = token.toLowerCase();
          if (lower.includes('cao cấp') || lower.includes('quỹ đất') || lower.includes('dự án') || lower.includes('tổng diện')) {
            return;
          }
          const pnMatch = token.match(/^(\d+)\s*pn$/i);
          if (pnMatch) {
            typesSet.add(`Căn ${pnMatch[1]} PN`);
          } else {
            typesSet.add(token);
          }
        }
      });
    }

    // 3. Fallback: If empty, use standard default apartment types
    if (typesSet.size === 0) {
      return ['Căn 1 PN', 'Căn 2 PN', 'Căn 3 PN', 'Penthouse'];
    }

    return Array.from(typesSet);
  }, [allUnitDesigns, project.stats]);



  // Filtered unit layouts:
  // When in 'unit' mode (Bản vẽ căn hộ), show ALL units across all towers filtered by bedrooms!
  // When in 'floor' mode, refer to active group's units.
  const filteredUnits = useMemo(() => {
    const list = floorPlanMode === 'unit'
      ? allUnitDesigns
      : (activeGroup?.unit_layouts || []);
    if (bedroomFilter === null) return list;
    return list.filter(u => u.bedrooms === bedroomFilter);
  }, [floorPlanMode, allUnitDesigns, activeGroup, bedroomFilter]);

  const selectedUnit = filteredUnits[activeUnitIdx] || filteredUnits[0] || null;

  // Amenities list
  const amenitiesList = useMemo<ProjectAmenityItem[]>(() => {
    if (project.amenity_gallery && project.amenity_gallery.length > 0) {
      return project.amenity_gallery;
    }
    return [
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
      {
        name: 'Hồ bơi nhiệt đới Palm Breeze',
        image_url: '/images/The_Prive/TPV - HỒ BƠI PALM BREEZE.jpg',
        description: 'Ốc đảo nghỉ dưỡng giữa lòng thành phố với ghế nằm dưới nước và quầy bar nổi.',
        category: 'Giải trí',
      },
      {
        name: 'Khu vui chơi trẻ em Kid Paradise',
        image_url: '/images/The_Prive/Ngoai-troi-1-1.png',
        description: 'Khu vui chơi sáng tạo ngoài trời đạt chuẩn an toàn quốc tế, phát triển thể chất trẻ nhỏ.',
        category: 'Gia đình',
      },
    ];
  }, [project.amenity_gallery]);

  // Bento Grid Amenity hierarchy: Featured signature amenity & satellite amenities
  const featuredAmenity = amenitiesList[0] || null;
  const secondaryAmenity1 = amenitiesList[1] || null;
  const secondaryAmenity2 = amenitiesList[2] || null;
  const remainingAmenities = useMemo(() => amenitiesList.slice(3), [amenitiesList]);

  // Gather all unique amenity names entered by staff
  const staffAmenityNames = useMemo<string[]>(() => {
    // 1. If explicit amenities list was entered in CMS, prioritize it directly
    if (project.amenities && Array.isArray(project.amenities)) {
      const explicit = project.amenities
        .map((a: unknown) => (typeof a === 'string' ? a.trim() : (a as { name?: string })?.name?.trim() || ''))
        .filter(Boolean);
      if (explicit.length > 0) {
        return Array.from(new Set(explicit));
      }
    }

    const namesSet = new Set<string>();

    // 2. From amenity_floors (từng tầng / phân khu tiện ích do nhân viên nhập)
    if (project.amenity_floors && project.amenity_floors.length > 0) {
      project.amenity_floors.forEach(floor => {
        if (floor.amenities && Array.isArray(floor.amenities)) {
          floor.amenities.forEach(a => {
            const trimmed = a.name?.trim();
            if (trimmed) namesSet.add(trimmed);
          });
        }
      });
    }

    // 3. From amenity_gallery (danh sách tiện ích đặc quyền)
    if (project.amenity_gallery && project.amenity_gallery.length > 0) {
      project.amenity_gallery.forEach(a => {
        const trimmed = a.name?.trim();
        if (trimmed) namesSet.add(trimmed);
      });
    }

    // 4. Fallback if empty: default rich amenities from The Privé
    if (namesSet.size === 0) {
      const defaultNames = [
        'Hồ bơi vô cực Lumina',
        'Phòng gym The Long & Yoga',
        'Phòng tiệc VIP Jumeirah',
        'Đài vọng cảnh Sky Panorama',
        'Hồ bơi nhiệt đới Palm Breeze',
        'Khu vui chơi trẻ em Kid Paradise',
        'Vườn thiền Zen Garden',
        'Sân tập đa năng thể thao ngoài trời',
        'Đường chạy bộ trên không Sky Walk',
        'Trạm sạc xe điện thông minh 24/7',
        'Phòng chiếu phim gia đình',
        'Khu BBQ ven hồ thượng lưu',
      ];
      defaultNames.forEach(n => namesSet.add(n));
    }

    return Array.from(namesSet);
  }, [project.amenity_floors, project.amenity_gallery, project.amenities]);

  const displayedAmenityNames = isAmenitiesExpanded ? staffAmenityNames : staffAmenityNames.slice(0, 6);

  // FAQs list with direct-answer optimization for GEO & AI search
  const faqsList = useMemo<ProjectFaqItem[]>(() => {
    const list: ProjectFaqItem[] = [];
    if (project.seo_metadata?.faqs && project.seo_metadata.faqs.length > 0) {
      list.push(...project.seo_metadata.faqs);
    }
    if (list.length === 0) {
      list.push(
        {
          question: `Vị trí chính xác dự án ${project.name} ở đâu?`,
          answer: `Dự án tọa lạc tại mặt tiền ${project.location || 'đường Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh'}. Vị trí kết nối trực tiếp đến khu đô thị mới Thủ Thiêm và Trung tâm Quận 1 chỉ trong 10-15 phút di chuyển.`,
        },
        {
          question: `Giá bán và chính sách thanh toán căn hộ ${project.name} như thế nào?`,
          answer: `Giá bán tham chiếu từ ${project.price_range || '120 - 135 triệu/m²'}. Chủ đầu tư áp dụng tiến độ thanh toán giãn 5% mỗi đợt, ngân hàng hỗ trợ vay 70% với lãi suất 0% và ân hạn nợ gốc đến khi nhận nhà.`,
        },
        {
          question: `Thời gian dự kiến bàn giao căn hộ ${project.name} là khi nào?`,
          answer: `Thời gian bàn giao dự kiến vào Quý IV/2026. Công trình đang được thi công đồng bộ đảm bảo đúng cam kết tiến độ và chất lượng bàn giao tiêu chuẩn cao cấp.`,
        },
        {
          question: `Pháp lý dự án ${project.name} hiện tại ra sao?`,
          answer: `Dự án sở hữu pháp lý hoàn chỉnh gồm Quy hoạch chi tiết 1/500 và Giấy phép xây dựng. Khách hàng người Việt Nam được cấp sổ hồng sở hữu lâu dài, người nước ngoài sở hữu 50 năm theo quy định pháp luật.`,
        }
      );
    } else if (list.length < 4) {
      const hasHandover = list.some(f => f.question.toLowerCase().includes('bàn giao') || f.question.toLowerCase().includes('tiến độ'));
      if (!hasHandover) {
        list.push({
          question: `Thời gian dự kiến bàn giao căn hộ ${project.name} là khi nào?`,
          answer: `Thời gian bàn giao dự kiến vào Quý IV/2026. Tiến độ thi công hiện đang được triển khai khẩn trương với các đơn vị tổng thầu hàng đầu.`,
        });
      }
    }
    return list;
  }, [project.seo_metadata, project.name, project.location, project.price_range]);

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Quick facts specifications (Thông số quy mô dự án)
  const quickFacts = useMemo<Array<{ label: string; value: React.ReactNode }>>(() => {
    const s = project.stats || {};
    return [
      {
        label: 'Trạng thái',
        value: s['Trạng thái'] && s['Trạng thái'] !== 'Chưa xác thực'
          ? s['Trạng thái']
          : (project.status && STATUS_MAP[project.status]?.label) || 'Đang mở bán',
      },
      {
        label: 'Loại hình',
        value: s['Loại hình'] || 'Duplex, Penthouse, Căn hộ',
      },
      {
        label: 'Diện tích',
        value: s['Diện tích'] || '67,000 m²',
      },
      {
        label: 'Số block',
        value: s['Số block'] || s['Số tháp'] || '12',
      },
      {
        label: 'Số tầng',
        value: s['Số tầng'] || '34',
      },
      {
        label: 'Số căn hộ',
        value: s['Số căn hộ'] || s['Số căn'] || '3,175',
      },
      {
        label: 'Mật độ xây dựng (%)',
        value: s['Mật độ xây dựng (%)'] || '24',
      },
      {
        label: 'Chủ đầu tư',
        value: project.developer || 'Đang cập nhật',
      },
    ];
  }, [project.stats, project.developer, project.status]);

  // Location infrastructure connections (Place, Time, Distance)
  const displayDistances = useMemo(() => {
    if (project.location_distances && project.location_distances.length > 0) {
      return project.location_distances.map(d => {
        let timeStr = d.distance || '';
        let kmStr = d.distance_km || '';
        if (!kmStr && timeStr) {
          const m = parseInt(timeStr);
          if (!isNaN(m)) kmStr = `${(m * 0.6).toFixed(1)} km`;
        }
        if (timeStr && !timeStr.toLowerCase().includes('phút') && !timeStr.toLowerCase().includes('km')) {
          timeStr = `${timeStr} phút`;
        }
        return {
          place: d.destination || 'Điểm kết nối',
          time: timeStr || '5 phút',
          distance_km: kmStr || '2.0 km',
        };
      });
    }
    return [
      { place: 'Tuyến Metro số 1 Bến Thành - Suối Tiên', time: '3 phút', distance_km: '1.2 km' },
      { place: 'Cầu Thủ Thiêm 2 (Cầu Ba Son) & Quận 1', time: '8 phút', distance_km: '4.5 km' },
      { place: 'Trường Quốc tế Úc (AIS) & Quốc tế Anh (BIS)', time: '5 phút', distance_km: '2.0 km' },
      { place: 'Khu đô thị mới Thủ Thiêm & Sala', time: '6 phút', distance_km: '3.2 km' },
      { place: 'Trung tâm tài chính Quận 1', time: '12 phút', distance_km: '6.5 km' },
      { place: 'Sân bay Quốc tế Long Thành', time: '30 phút', distance_km: '32 km' },
    ];
  }, [project.location_distances]);

  // Detect height of the fixed main site navbar (header[data-site-navbar])
  const [mainNavHeight, setMainNavHeight] = useState<number>(0);

  useEffect(() => {
    const updateNavHeight = () => {
      const mainNav = document.querySelector('header[data-site-navbar]') as HTMLElement | null;
      if (mainNav) {
        setMainNavHeight(mainNav.offsetHeight);
      } else {
        setMainNavHeight(0);
      }
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    const timer = setTimeout(updateNavHeight, 200);
    return () => {
      window.removeEventListener('resize', updateNavHeight);
      clearTimeout(timer);
    };
  }, []);

  // ScrollSpy listener (5 mục theo thứ tự trên navbar dính + các mục thông tin)
  useEffect(() => {
    const handleScroll = () => {
      const subNavEl = navRef.current;
      const subNavHeight = subNavEl ? subNavEl.offsetHeight : 52;
      const totalOffset = mainNavHeight + subNavHeight + 24;
      const scrollPos = window.scrollY + totalOffset;
      const sections = ['tong-quan', 'mat-bang', 'tien-ich', 'vi-tri', 'chu-dau-tu', 'faq'];

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveTab(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mainNavHeight]);

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      const subNavEl = navRef.current;
      const subNavHeight = subNavEl ? subNavEl.offsetHeight : 52;
      const totalOffset = mainNavHeight + subNavHeight + 12;
      const top = el.getBoundingClientRect().top + window.pageYOffset - totalOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadFormData.phone) return;
    setLeadFormSubmitted(true);
    setTimeout(() => {
      setLeadFormSubmitted(false);
    }, 4000);
  };

  return (
    <div
      style={{ paddingTop: mainNavHeight ? `${mainNavHeight}px` : undefined }}
      className="min-h-screen bg-[#FDFCFB] text-[#1E293B] antialiased selection:bg-[#C5A059]/20 selection:text-[#C5A059]"
    >
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. BREADCRUMB & HEADER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-gray-500">
          <nav className="flex items-center space-x-2">
            <Link href="/" className="hover:text-[#C5A059] transition-colors" aria-label="Về trang chủ Maian Homes">Trang chủ</Link>
            <span>/</span>
            <Link href="/du_an" className="hover:text-[#C5A059] transition-colors" aria-label="Xem danh sách tất cả dự án bất động sản">Danh mục dự án</Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold truncate max-w-[200px] sm:max-w-xs">{project.name}</span>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: project.name, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Đã sao chép liên kết dự án!');
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. NEW HERO SECTION: 60% IMAGE GALLERY - 40% PROJECT OVERVIEW & CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        style={heroTheme.bgStyle}
        className={`${heroTheme.isDark ? 'text-white border-b border-white/10' : 'bg-white text-[#1E293B] border-b border-[#E2E8F0]'} pt-6 pb-8 transition-colors`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ── PROJECT HEADER: Tên dự án & Địa chỉ nằm trên section đầu tiên (không có hình ảnh cạnh tên) ── */}
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div className="space-y-1.5">
              {project.marketing_tags && project.marketing_tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {project.marketing_tags.filter((t: string) => t !== 'Dự án nổi bật').map((tag: string, tIdx: number) => (
                    <span
                      key={tIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-bold rounded-md shadow-2xs"
                    >
                      <span className="text-[#C5A059] font-black">✓</span>
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight ${heroTheme.headingClass}`}>
                {project.name}
              </h1>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-[#C5A059] shrink-0" />
                <span>{project.location || 'Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* ── LEFT 60% COLUMN (IMAGE GALLERY) ── */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
              <div
                onMouseEnter={() => setIsHeroCarouselPaused(true)}
                onMouseLeave={() => setIsHeroCarouselPaused(false)}
                onClick={() => { setLightboxIndex(heroSelectedImageIdx); setLightboxOpen(true); }}
                className="relative w-full h-[320px] sm:h-[400px] lg:h-[440px] rounded-none overflow-hidden bg-slate-900 group cursor-pointer shadow-md"
              >
                <Image
                  key={heroSelectedImageIdx}
                  src={getAssetUrl(allImages[heroSelectedImageIdx] || allImages[0]) || allImages[0]}
                  alt={project.name}
                  fill
                  priority={heroSelectedImageIdx === 0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 65vw, 850px"
                  className="w-full h-full object-cover transition-all duration-1000 ease-in-out group-hover:scale-105 animate-in fade-in duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

                <div className="absolute bottom-4 right-4 flex items-center gap-2 text-white text-xs">
                  {embedVideoUrl && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setVideoModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-[#C5A059] text-white font-bold shadow-md hover:bg-[#b08d48] transition-all backdrop-blur-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Xem Video</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(heroSelectedImageIdx); setLightboxOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-white/95 text-gray-900 font-bold shadow-md hover:bg-white transition-all backdrop-blur-md"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Xem tất cả ({allImages.length})</span>
                    </button>
                  </div>
              </div>

              {/* Thumbnails row below main photo */}
              {allImages.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {allImages.slice(0, 5).map((img, idx) => {
                    const isSelected = heroSelectedImageIdx === idx;
                    const isLastSlot = idx === 4 && allImages.length > 5;
                    return (
                      <div
                        key={idx}
                        onClick={() => setHeroSelectedImageIdx(idx)}
                        className={`relative h-18 sm:h-20 rounded-none overflow-hidden cursor-pointer border-2 transition-all duration-200 bg-slate-900 ${
                          isSelected
                            ? 'border-[#C5A059] shadow-sm scale-102 ring-2 ring-[#C5A059]/30'
                            : 'border-transparent opacity-80 hover:opacity-100 hover:border-slate-300'
                        }`}
                      >
                        <Image
                          src={getAssetUrl(img) || img}
                          alt={`${project.name} thumbnail ${idx + 1}`}
                          fill
                          sizes="(max-width: 640px) 25vw, 120px"
                          className="w-full h-full object-cover"
                        />
                        {isLastSlot && (
                          <div
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(4); setLightboxOpen(true); }}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs font-bold"
                          >
                            +{allImages.length - 4} ảnh
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT 40% COLUMN (PROJECT OVERVIEW INFO & REGISTRATION CTA) ── */}
            <div className="lg:col-span-5 p-5 sm:p-6 rounded-none bg-slate-50/95 space-y-4">
              <div className="space-y-3">
                {/* Price Range Banner */}
                <div className="p-3.5 sm:p-4 rounded-none bg-gradient-to-r from-amber-500/10 via-[#C5A059]/10 to-transparent border-l-4 border-l-[#C5A059]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6A2F]">
                      Khoảng giá
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      {project.stats?.['Chiết khấu'] || 'Chiết khấu tới 8%'}
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#0F1E36] tracking-tight mt-1">
                    {project.price_range || '7 - 12 tỷ'}
                  </div>
                </div>

                {/* Quick Info Grid: Chủ đầu tư, Loại hình */}
                <div className="grid grid-cols-2 gap-3 text-xs py-1">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Chủ đầu tư</span>
                    <strong className="text-gray-900 truncate block mt-0.5 font-bold text-sm">
                      {project.developer || 'Đang cập nhật'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Loại hình</span>
                    <strong className="text-gray-900 truncate block mt-0.5 font-bold text-sm">
                      {project.stats?.['Loại hình'] || project.stats?.['Loại hình sản phẩm'] || 'Căn hộ cao cấp'}
                    </strong>
                  </div>
                </div>

                {/* Quick Contact / Hotline Bar */}
                <div className="flex items-center justify-between py-2 text-xs border-t border-slate-200/70">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-[#C5A059]" />
                    <span className="font-semibold">Hotline PKD:</span>
                  </div>
                  <a
                    href={`tel:${project.contact_phone || '0901234567'}`}
                    aria-label={`Gọi hotline tư vấn dự án ${project.name}`}
                    className="font-bold text-[#C5A059] hover:underline tracking-wide text-sm"
                  >
                    Hotline: {project.contact_phone || '090 123 4567'}
                  </a>
                </div>
              </div>

              {/* Big CTA Button */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="w-full py-3 px-4 rounded-none bg-gradient-to-r from-[#C5A059] to-[#D4AF37] hover:from-[#b59049] hover:to-[#c49f27] text-white font-extrabold text-xs sm:text-sm tracking-wider shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  <span>ĐĂNG KÝ NHẬN THÔNG TIN & BẢNG GIÁ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. STICKY SUB-NAVIGATION BAR (5 MỤC THEO YÊU CẦU)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        ref={navRef}
        style={{ top: mainNavHeight ? `${mainNavHeight}px` : undefined }}
        className="sticky top-14 sm:top-16 lg:top-[64px] z-40 bg-white border-b border-[#E2E8F0] transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto no-scrollbar py-3 text-xs sm:text-sm font-bold">
            {[
              { id: 'tong-quan', label: 'Tổng quan' },
              { id: 'mat-bang', label: 'Mặt bằng' },
              { id: 'tien-ich', label: 'Tiện ích' },
              { id: 'vi-tri', label: 'Vị trí' },
              { id: 'chu-dau-tu', label: 'Chủ đầu tư' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`relative whitespace-nowrap px-3.5 py-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#C5A059] font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#C5A059] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. MAIN CONTENT CONTAINER (2 COLUMNS)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* ───────────────────────────────────────
              LEFT MAIN CONTENT COLUMN (8 COLS)
          ─────────────────────────────────────── */}
          <main className="lg:col-span-8 space-y-12">
            {/* ── SECTION 1: TỔNG QUAN DỰ ÁN (COLLAPSIBLE) ── */}
            <section
              id="tong-quan"
              style={overviewTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${overviewTheme.containerClass}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${overviewTheme.headingClass}`}>
                  Giới thiệu {project.name || 'dự án'}
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#C5A059]/10 text-[#C5A059]">
                  Tổng quan chi tiết
                </span>
              </div>

              {/* ── GEO & AI EXECUTIVE SUMMARY (TL;DR) ── */}
              <div
                data-geo="tldr"
                itemScope
                itemType="https://schema.org/Thing"
                className={`mb-6 p-5 sm:p-6 rounded-2xl border transition-all duration-300 ${
                  overviewTheme.isDark
                    ? 'bg-slate-800/80 border-amber-400/30 text-slate-100 shadow-lg shadow-black/20'
                    : 'bg-gradient-to-br from-[#FDFBF7] via-[#FFFDF9] to-[#F7F3EA] border-[#EADBB6] text-[#1E293B] shadow-sm'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-amber-200/50">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-[#C5A059] text-white shadow-2xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      TL;DR • Tóm tắt nhanh dự án
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                      (Tối ưu cho trợ lý AI &amp; Khách hàng bận rộn)
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#C5A059] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Thông tin xác thực
                  </span>
                </div>

                <p itemProp="description" className="text-xs sm:text-sm leading-relaxed text-slate-700 font-normal mb-4">
                  {project.seo_metadata?.cornerstone_text || (
                    <>
                      <strong className="text-slate-900 font-bold">{project.name}</strong> là tổ hợp bất động sản cao cấp tọa lạc tại{' '}
                      <span className="font-semibold text-slate-900">{project.location || 'TP. Thủ Đức, TP. Hồ Chí Minh'}</span>, được phát triển bởi{' '}
                      <span className="font-semibold text-slate-900">{project.developer || 'chủ đầu tư uy tín'}</span>. Dự án có mức giá tham chiếu{' '}
                      <span className="font-bold text-[#C5A059]">{project.price_range || 'từ 120 triệu/m²'}</span>, pháp lý hoàn chỉnh với hình thức sở hữu lâu dài, bàn giao dự kiến vào Quý IV/2026 cùng chuỗi hơn 50 tiện ích đặc quyền chuẩn nghỉ dưỡng.
                    </>
                  )}
                </p>

                {/* Quick Key-Value Badges for AI Citation & Fast Readers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/80 border border-amber-100/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Vị trí</span>
                    <span className="font-bold text-slate-900 truncate block" title={project.location || 'TP. Thủ Đức, TP.HCM'}>
                      {project.location ? project.location.split(',')[0] : 'TP. Thủ Đức'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 border border-amber-100/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Mức giá</span>
                    <span className="font-black text-[#C5A059] truncate block">
                      {project.price_range || '120 - 135 tr/m²'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 border border-amber-100/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Chủ đầu tư</span>
                    <span className="font-bold text-slate-900 truncate block" title={project.developer || 'Chủ đầu tư'}>
                      {project.developer || 'Chủ đầu tư uy tín'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 border border-amber-100/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Pháp lý &amp; Bàn giao</span>
                    <span className="font-bold text-slate-900 truncate block">
                      {project.stats?.['Pháp lý'] || 'Sổ hồng lâu dài'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Content with Gradient Fade */}
              <div className="relative">
                <div
                  className={`prose prose-slate max-w-none text-sm sm:text-[15px] leading-relaxed transition-all duration-300 ${overviewTheme.bodyTextClass} ${
                    isDescExpanded ? 'max-h-none' : 'max-h-[170px] overflow-hidden'
                  }`}
                >
                  {project.description ? (
                    <div className="whitespace-pre-line leading-relaxed space-y-3">
                      {project.description}
                    </div>
                  ) : (
                    <>
                      <p>
                        {`${project.name} là tổ hợp căn hộ hạng sang được kiến tạo theo tiêu chuẩn sinh thái xanh quốc tế bởi chủ đầu tư danh tiếng ${project.developer || 'Đang cập nhật'}. Tọa lạc tại quỹ đất vàng đắc địa nhất khu vực, dự án hòa quyện hoàn hảo giữa không gian sống thanh bình ven sông cùng hệ thống tiện ích đẳng cấp vượt trội mang lại đặc quyền sống vương giả cho cộng đồng cư dân tinh hoa.`}
                      </p>
                      <p className="mt-3">
                        Được thiết kế bởi các đơn vị kiến trúc hàng đầu thế giới, 100% căn hộ tại {project.name} đều sở hữu tầm nhìn khoáng đạt ôm trọn cảnh quan sông nước và trung tâm tài chính phồn hoa. Các căn hộ được bàn giao với hệ thống vật liệu hoàn thiện cao cấp nhập khẩu từ các thương hiệu hàng đầu châu Âu, kết hợp công nghệ Smarthome tân tiến mang lại trải nghiệm tiện nghi tuyệt đối.
                      </p>
                      <p className="mt-3">
                        Bên cạnh đó, chuỗi hơn 50 tiện ích nội khu đỉnh cao từ hồ bơi vô cực điện phân muối khoáng, đường chạy bộ trên không, phòng tiệc VIP riêng biệt cho đến khu vui chơi sáng tạo trẻ em sẽ thỏa mãn trọn vẹn mọi nhu cầu sống, làm việc và hưởng thụ của gia đình bạn.
                      </p>
                    </>
                  )}
                </div>

                {/* Fade Mask when Collapsed */}
                {!isDescExpanded && (
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t ${
                      overviewTheme.isDark ? 'from-slate-900 via-slate-900/80' : 'from-white via-white/80'
                    } to-transparent pointer-events-none`}
                  />
                )}
              </div>

              {/* Expand / Collapse Button */}
              <div className={`mt-4 pt-2 border-t ${overviewTheme.isDark ? 'border-white/10' : 'border-gray-100'} flex justify-center`}>
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-[#C5A059] hover:bg-[#C5A059]/10 transition-colors"
                >
                  {isDescExpanded ? (
                    <>
                      <span>Thu gọn nội dung</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Xem thêm giới thiệu</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Thông số quy mô dự án (Hiển thị 2 cột dọc, không có kính bao) */}
              <div className={`mt-8 pt-6 border-t ${overviewTheme.isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${overviewTheme.mutedClass}`}>
                  Thông số quy mô dự án
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
                  {quickFacts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2.5 border-b border-slate-100/90 text-xs sm:text-sm"
                    >
                      <span className="text-gray-500 font-medium">{fact.label}</span>
                      <span className={`font-bold text-right ${overviewTheme.isDark ? 'text-white' : 'text-[#0F1E36]'}`}>
                        {fact.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overview Images Gallery / Auto-fade Carousel */}
              {overviewImagesList.length > 0 && (
                <div className={`mt-8 pt-6 border-t ${overviewTheme.isDark ? 'border-white/10' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${overviewTheme.mutedClass}`}>
                      Hình ảnh phối cảnh dự án
                    </h3>
                    {overviewImagesList.length >= 3 && (
                      <span className="text-[11px] font-medium text-[#C5A059] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Trình chiếu tự động (4s)</span>
                      </span>
                    )}
                  </div>

                  {overviewImagesList.length >= 3 ? (
                    /* Auto-fading Carousel for >= 3 images */
                    <div
                      onMouseEnter={() => setIsOverviewCarouselPaused(true)}
                      onMouseLeave={() => setIsOverviewCarouselPaused(false)}
                      className="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-none overflow-hidden bg-slate-950 group shadow-md"
                    >
                      {overviewImagesList.map((imgUrl, oIdx) => {
                        const isActive = oIdx === overviewCarouselIdx;
                        return (
                          <div
                            key={oIdx}
                            onClick={() => {
                              const fIdx = allImages.indexOf(imgUrl);
                              setLightboxIndex(fIdx !== -1 ? fIdx : 0);
                              setLightboxOpen(true);
                            }}
                            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out cursor-pointer ${
                              isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                            }`}
                          >
                            <Image
                              src={getAssetUrl(imgUrl) || imgUrl}
                              alt={`Phối cảnh ${project.name} ${oIdx + 1}`}
                              fill
                              sizes="(max-width: 1024px) 100vw, 65vw"
                              className="w-full h-full object-cover select-none"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                          </div>
                        );
                      })}

                      {/* Navigation arrows (Previous / Next) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverviewCarouselIdx(prev => (prev - 1 + overviewImagesList.length) % overviewImagesList.length);
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        aria-label="Hình trước"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverviewCarouselIdx(prev => (prev + 1) % overviewImagesList.length);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        aria-label="Hình tiếp theo"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      {/* Bottom Bar: Indicators & Counter */}
                      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-white pointer-events-none">
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          {overviewImagesList.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              onClick={() => setOverviewCarouselIdx(dotIdx)}
                              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                dotIdx === overviewCarouselIdx ? 'w-6 bg-[#C5A059]' : 'w-1.5 bg-white/50 hover:bg-white/80'
                              }`}
                              aria-label={`Chuyển đến hình ${dotIdx + 1}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-full pointer-events-auto">
                          <span>{overviewCarouselIdx + 1} / {overviewImagesList.length}</span>
                          <Maximize2
                            className="w-3.5 h-3.5 cursor-pointer hover:text-[#C5A059] transition-colors"
                            onClick={() => {
                              const currentImg = overviewImagesList[overviewCarouselIdx];
                              const fIdx = allImages.indexOf(currentImg);
                              setLightboxIndex(fIdx !== -1 ? fIdx : 0);
                              setLightboxOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 1 or 2 static images */
                    <div className={`grid grid-cols-1 ${overviewImagesList.length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-3.5`}>
                      {overviewImagesList.map((imgUrl, oIdx) => (
                        <div
                          key={oIdx}
                          onClick={() => {
                            const fIdx = allImages.indexOf(imgUrl);
                            setLightboxIndex(fIdx !== -1 ? fIdx : 0);
                            setLightboxOpen(true);
                          }}
                          className="h-44 sm:h-52 rounded-none overflow-hidden bg-slate-900 relative group cursor-pointer"
                        >
                          <Image
                            src={getAssetUrl(imgUrl) || imgUrl}
                            alt={`Phối cảnh ${project.name} ${oIdx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 35vw"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                          <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* USPs (Lý do lựa chọn & Giá trị độc bản) */}
              {project.seo_metadata?.usps && project.seo_metadata.usps.length > 0 && (
                <div className={`mt-8 pt-6 border-t ${overviewTheme.isDark ? 'border-white/10' : 'border-gray-100'} space-y-4`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${overviewTheme.mutedClass}`}>
                    Lý do lựa chọn & Giá trị độc bản (USPs)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {project.seo_metadata.usps.map((usp, uIdx) => (
                      <div key={uIdx} className="flex items-start gap-2.5 py-1">
                        <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                        <span className={`text-xs sm:text-sm font-medium leading-relaxed ${overviewTheme.isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                          {usp}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── SECTION 2: MẶT BẰNG & THIẾT KẾ KIẾN TRÚC ── */}
            <section
              id="mat-bang"
              style={matBangTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${matBangTheme.containerClass}`}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${matBangTheme.headingClass}`}>
                    Mặt bằng và Thiết kế
                  </h2>
                  <p className={`text-xs sm:text-sm mt-1 ${matBangTheme.mutedClass}`}>
                    Khám phá mặt bằng tổng thể, sơ đồ tầng điển hình và thiết kế chi tiết từng mẫu căn hộ
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFloorPlanMode('floor')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      floorPlanMode === 'floor'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Mặt bằng tầng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFloorPlanMode('unit')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      floorPlanMode === 'unit'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Bản vẽ căn hộ</span>
                  </button>
                </div>
              </div>

              {/* Tower / Phân khu Tabs - CHỈ HIỂN THỊ TRONG CHẾ ĐỘ MẶT BẰNG TẦNG */}
              {floorPlanMode === 'floor' && floorLayoutGroups.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-gray-100">
                  {floorLayoutGroups.map((group, idx) => {
                    const isActive = activeTowerIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setActiveTowerIdx(idx);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-none text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-[#0F1E36] text-white shadow-sm ring-1 ring-[#0F1E36]'
                            : 'bg-slate-50 text-gray-600 hover:bg-slate-100 hover:text-gray-900'
                        }`}
                      >
                        <Building2 className={`w-3.5 h-3.5 ${isActive ? 'text-[#C5A059]' : 'text-gray-400'}`} />
                        <span>{group.group_name || `Tháp ${idx + 1}`}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* View Rendering Container */}
              <div className="mt-6">
                {floorPlanMode === 'floor' ? (
                  /* Mode 1: Sơ đồ mặt bằng tầng (Floorplate / Master Plan) */
                  <div className="space-y-4">
                    {/* Architectural Canvas: Không bo góc (`rounded-none`) */}
                    <div className="relative w-full min-h-[420px] sm:min-h-[500px] lg:min-h-[540px] bg-slate-950 rounded-none overflow-hidden flex items-center justify-center p-4 sm:p-6 group">
                      <Image
                        src={
                          getAssetUrl(activeGroup.floor_map_image) ||
                          '/images/The_Prive/TANG-21_TW9.jpg'
                        }
                        alt={`Mặt bằng tầng ${activeGroup.group_name}`}
                        width={1200}
                        height={800}
                        sizes="(max-width: 1024px) 100vw, 65vw"
                        className="max-h-[480px] w-auto max-w-full object-contain rounded-none select-none transition-transform duration-500 group-hover:scale-102"
                      />

                      {/* Hotspot Pins */}
                      {activeGroup.hotspots && activeGroup.hotspots.length > 0 && activeGroup.hotspots.map((hs, hIdx) => (
                        <div
                          key={hIdx}
                          onClick={() => {
                            const uIdx = allUnitDesigns.findIndex(u => u.name === hs.layout_name);
                            if (uIdx !== -1) {
                              setBedroomFilter(null);
                              setActiveUnitIdx(uIdx);
                              setFloorPlanMode('unit');
                            }
                          }}
                          style={{ left: `${hs.position_x}%`, top: `${hs.position_y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 group/pin cursor-pointer z-10"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C5A059] text-white text-xs font-black shadow-lg ring-2 ring-white hover:scale-125 transition-transform animate-pulse">
                            {hs.unit_number || hs.unit_code || hIdx + 1}
                          </span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/pin:flex flex-col items-center whitespace-nowrap bg-gray-950/95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xl border border-white/10 z-20 pointer-events-none">
                            <span>{hs.unit_number ? `Căn số ${hs.unit_number}` : 'Căn hộ'}</span>
                            <span className="text-[11px] text-[#C5A059]">{hs.layout_name}</span>
                          </div>
                        </div>
                      ))}

                      {/* Canvas Controls Toolbar */}
                      <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        {allUnitDesigns.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBedroomFilter(null);
                              setActiveUnitIdx(0);
                              setFloorPlanMode('unit');
                            }}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-white/90 hover:bg-white text-gray-900 text-xs font-bold backdrop-blur-md transition-all shadow-md cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>Xem bản vẽ căn hộ ({allUnitDesigns.length})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setBlueprintZoomOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-black/80 hover:bg-black text-white text-xs font-bold backdrop-blur-md transition-all shadow-md cursor-pointer border border-white/10"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>Phóng to sơ đồ</span>
                        </button>
                      </div>

                      {/* Floor Indicator Badge */}
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-none bg-black/75 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                          {activeGroup.group_name}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mode 2: Studio Thiết kế bản vẽ từng căn hộ (Unit Layout Studio) */
                  <div className="space-y-5">
                    {/* Bedroom Filter Bar */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-400 mr-1">Số phòng ngủ:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setBedroomFilter(null);
                            setActiveUnitIdx(0);
                          }}
                          className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all cursor-pointer ${
                            bedroomFilter === null
                              ? 'bg-[#C5A059] text-white shadow-xs'
                              : 'bg-slate-100 text-gray-600 hover:bg-slate-200 hover:text-gray-900'
                          }`}
                        >
                          Tất cả
                        </button>
                        {availableBedroomOptions.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setBedroomFilter(num);
                              setActiveUnitIdx(0);
                            }}
                            className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all cursor-pointer ${
                              bedroomFilter === num
                                ? 'bg-[#C5A059] text-white shadow-xs'
                                : 'bg-slate-100 text-gray-600 hover:bg-slate-200 hover:text-gray-900'
                            }`}
                          >
                            {num} Phòng ngủ
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2-Column Architectural Studio */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left: Unit Selector List (5 Cols) */}
                      <div className="lg:col-span-5 space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                        {filteredUnits.length > 0 ? (
                          filteredUnits.map((unit, idx) => {
                            const isSelected = activeUnitIdx === idx;
                            return (
                              <div
                                key={idx}
                                onClick={() => setActiveUnitIdx(idx)}
                                className={`p-3.5 transition-all cursor-pointer rounded-none relative border-l-2 ${
                                  isSelected
                                    ? 'bg-[#FAF8F5] border-l-[#C5A059]'
                                    : 'hover:bg-slate-50/70 border-l-transparent'
                                }`}
                              >
                                {/* Header: Tên căn */}
                                <div className="pb-2 border-b border-slate-100">
                                  <h3 className="font-black text-sm sm:text-base text-[#0F1E36]">
                                    {unit.name}
                                  </h3>
                                </div>

                                {/* Thông số căn hộ: Mỗi nội dung nằm trên 1 dòng, không có khung bao */}
                                <div className="mt-2.5 space-y-1.5 text-xs">
                                  {/* Thông thủy */}
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-gray-500">Thông thủy:</span>
                                    <strong className="text-gray-900 font-bold">{unit.net_area} m²</strong>
                                  </div>

                                  {/* Tim tường */}
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-gray-500">Tim tường:</span>
                                    <strong className="text-gray-900 font-bold">{unit.gross_area} m²</strong>
                                  </div>

                                  {/* Phòng ngủ */}
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-gray-500">Phòng ngủ:</span>
                                    <strong className="text-gray-900 font-bold">{unit.bedrooms} PN</strong>
                                  </div>

                                  {/* Phòng tắm */}
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-gray-500">Phòng tắm:</span>
                                    <strong className="text-gray-900 font-bold">{unit.bathrooms || 1} WC</strong>
                                  </div>

                                  {/* Cửa */}
                                  {unit.door_direction && (
                                    <div className="flex items-center justify-between py-0.5">
                                      <span className="text-gray-500">Cửa:</span>
                                      <strong className="text-gray-900 font-bold uppercase">{unit.door_direction}</strong>
                                    </div>
                                  )}

                                  {/* Ban công */}
                                  {unit.balcony_direction && (
                                    <div className="flex items-center justify-between py-0.5">
                                      <span className="text-gray-500">Ban công:</span>
                                      <strong className="text-gray-900 font-bold uppercase">{unit.balcony_direction}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-xs text-gray-500 bg-slate-50 border border-dashed border-slate-200">
                            Chưa có căn hộ nào phù hợp với bộ lọc này.
                          </div>
                        )}
                      </div>

                      {/* Right: Architectural 2D Blueprint Viewer (7 Cols) */}
                      <div className="lg:col-span-7 bg-white p-4 sm:p-5 space-y-3">
                        {selectedUnit ? (
                          <>
                            {/* Blueprint Image Display: Không bo góc (`rounded-none`), thoáng đãng và trực quan */}
                            <div
                              onClick={() => setBlueprintZoomOpen(true)}
                              className="w-full min-h-[420px] sm:min-h-[480px] lg:min-h-[520px] bg-slate-50 rounded-none flex items-center justify-center p-4 sm:p-6 cursor-zoom-in relative group"
                            >
                              <Image
                                src={
                                  getAssetUrl(selectedUnit.image_url) ||
                                  '/images/The_Prive/layout2PN.png'
                                }
                                alt={selectedUnit.name}
                                width={640}
                                height={420}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 640px"
                                className="max-h-[480px] max-w-full w-auto h-auto object-contain rounded-none transition-transform duration-300 group-hover:scale-102"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

                              {/* Floating Zoom Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBlueprintZoomOpen(true);
                                }}
                                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white border border-slate-200 text-xs font-bold text-gray-800 shadow-sm transition-colors cursor-pointer rounded-none"
                              >
                                <Maximize2 className="w-3.5 h-3.5 text-[#C5A059]" />
                                <span>Phóng to</span>
                              </button>
                            </div>

                            {/* Quick Action Button */}
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setLeadFormData({ ...leadFormData, unitType: `${selectedUnit.bedrooms}PN` });
                                  setIsRegisterModalOpen(true);
                                }}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] hover:from-[#b59049] hover:to-[#c49f27] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer rounded-none"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Nhận báo giá & chính sách căn {selectedUnit.name}</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-xs text-gray-400">
                            Chọn mẫu căn ở danh sách bên trái để xem ảnh bản vẽ
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION 4: TIỆN ÍCH ĐẶC QUYỀN ── */}
            <section
              id="tien-ich"
              style={tienIchTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${tienIchTheme.containerClass}`}
            >
              <div className="mb-6">
                <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${tienIchTheme.headingClass}`}>
                  Không gian tiện ích
                </h2>
                <p className={`text-xs sm:text-sm mt-1 ${tienIchTheme.mutedClass}`}>
                  Chuỗi tiện ích nghỉ dưỡng 5 sao kiến tạo trải nghiệm sống vượt bậc
                </p>
              </div>

              {/* Architectural Bento Grid Photo Layout */}
              <div className="space-y-4">
                {/* Top 60/40 Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left 60%: Featured Amenity */}
                  {featuredAmenity && (
                    <div
                      className="lg:col-span-7 relative h-[380px] sm:h-[450px] lg:h-[500px] rounded-none overflow-hidden bg-slate-900 group shadow-sm"
                    >
                      <Image
                        src={getAssetUrl(featuredAmenity.image_url) || featuredAmenity.image_url}
                        alt={featuredAmenity.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 45vw"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                      {/* Tên tiện ích trên ảnh */}
                      <div className="absolute bottom-3 left-3.5 right-3.5 text-white z-10">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-normal drop-shadow-sm">
                          {featuredAmenity.name?.trim() || 'Hồ bơi vô cực'}
                        </h3>
                      </div>
                    </div>
                  )}

                  {/* Right 40%: Secondary Amenities Stack (2 cards) */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    {secondaryAmenity1 && (
                      <div
                        className="relative flex-1 min-h-[182px] sm:min-h-[217px] lg:min-h-[242px] rounded-none overflow-hidden bg-slate-900 group shadow-sm"
                      >
                        <Image
                          src={getAssetUrl(secondaryAmenity1.image_url) || secondaryAmenity1.image_url}
                          alt={secondaryAmenity1.name || 'Phòng tiệc VIP & Lounge'}
                          fill
                          sizes="(max-width: 1024px) 100vw, 25vw"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

                        {/* Tên tiện ích trên ảnh */}
                        <div className="absolute bottom-2.5 left-3 right-3 text-white z-10">
                          <h4 className="text-xs sm:text-[13px] font-semibold text-white tracking-normal drop-shadow-sm truncate">
                            {secondaryAmenity1.name?.trim() || 'Phòng tiệc VIP & Lounge'}
                          </h4>
                        </div>
                      </div>
                    )}

                    {secondaryAmenity2 && (
                      <div
                        className="relative flex-1 min-h-[182px] sm:min-h-[217px] lg:min-h-[242px] rounded-none overflow-hidden bg-slate-900 group shadow-sm"
                      >
                        <Image
                          src={getAssetUrl(secondaryAmenity2.image_url) || secondaryAmenity2.image_url}
                          alt={secondaryAmenity2.name || 'Phòng ngủ sang trọng'}
                          fill
                          sizes="(max-width: 1024px) 100vw, 25vw"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

                        {/* Tên tiện ích trên ảnh */}
                        <div className="absolute bottom-2.5 left-3 right-3 text-white z-10">
                          <h4 className="text-xs sm:text-[13px] font-semibold text-white tracking-normal drop-shadow-sm truncate">
                            {secondaryAmenity2.name?.trim() || 'Phòng ngủ sang trọng'}
                          </h4>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Remaining Amenities (3 columns) */}
                {remainingAmenities.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {remainingAmenities.map((amenity, idx) => (
                      <div
                        key={idx}
                        className="group rounded-none overflow-hidden bg-slate-900 shadow-sm relative h-48 sm:h-52"
                      >
                        <Image
                          src={getAssetUrl(amenity.image_url) || amenity.image_url}
                          alt={amenity.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

                        {/* Tên tiện ích trên ảnh */}
                        <div className="absolute bottom-2.5 left-3 right-3 text-white z-10">
                          <h4 className="text-xs font-semibold text-white tracking-normal drop-shadow-sm truncate">
                            {amenity.name}
                          </h4>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Danh sách tên các tiện ích do nhân viên nhập (tối đa 5 và có thể bấm mở rộng để xem) */}
                {staffAmenityNames.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#C5A059]" />
                        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0F1E36]">
                          Danh mục tiện ích ({staffAmenityNames.length} tiện ích)
                        </h3>
                      </div>
                      {staffAmenityNames.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setIsAmenitiesExpanded(!isAmenitiesExpanded)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#C5A059] hover:underline cursor-pointer"
                        >
                          {isAmenitiesExpanded ? (
                            <>
                              <span>Thu gọn</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Mở rộng xem tất cả ({staffAmenityNames.length})</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
                      {displayedAmenityNames.map((name, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 py-1.5 transition-colors"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#C5A059]/15 text-[#C5A059] text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-slate-800 truncate" title={name}>
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {staffAmenityNames.length > 6 && (
                      <div className="mt-3.5 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIsAmenitiesExpanded(!isAmenitiesExpanded)}
                          className="inline-flex items-center gap-1.5 py-2 text-xs font-bold text-[#C5A059] hover:text-[#8A6A2F] hover:underline transition-colors cursor-pointer"
                        >
                          {isAmenitiesExpanded ? (
                            <>
                              <span>Thu gọn danh sách</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Xem thêm {staffAmenityNames.length - 6} tiện ích khác</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION 5: VỊ TRÍ & KẾT NỐI KHU VỰC ── */}
            <section
              id="vi-tri"
              style={locationTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${locationTheme.containerClass}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${locationTheme.headingClass}`}>
                    Vị trí dự án
                  </h2>
                  <p className={`text-xs sm:text-sm mt-1 ${locationTheme.mutedClass}`}>
                    {project.location || 'Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh'}
                  </p>
                </div>

                {/* View Mode Toggle: Map vs Google Embed */}
                <div className={`inline-flex p-1 rounded-none self-start ${locationTheme.isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <button
                    onClick={() => setMapMode('map')}
                    className={`px-3 py-1 rounded-none text-xs font-bold transition-all ${
                      mapMode === 'map' ? 'bg-white text-gray-900 shadow-xs' : locationTheme.isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Bản đồ vị trí
                  </button>
                  <button
                    onClick={() => setMapMode('google')}
                    className={`px-3 py-1 rounded-none text-xs font-bold transition-all ${
                      mapMode === 'google' ? 'bg-white text-gray-900 shadow-xs' : locationTheme.isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Google Maps
                  </button>
                </div>
              </div>

              {/* Map Canvas */}
              <div className="w-full h-[320px] sm:h-[400px] rounded-none overflow-hidden relative bg-slate-100">
                {mapMode === 'map' ? (
                  <div className="relative w-full h-full group">
                    <Image
                      src={
                        getAssetUrl(project.location_map_image) ||
                        '/images/The_Prive/prive_map.jpg'
                      }
                      alt={`Bản đồ vị trí dự án ${project.name}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  </div>
                ) : (
                  <iframe
                    src={
                      project.map_embed_url ||
                      `https://www.google.com/maps?q=${encodeURIComponent(
                        `${project.name} ${project.location || 'Mai Chí Thọ Thủ Đức'}`
                      )}&output=embed`
                    }
                    width="100%"
                    height="100%"
                    className="w-full h-full border-0"
                    loading="lazy"
                    title={`Google Map ${project.name}`}
                  />
                )}
              </div>

              {/* Kết nối hạ tầng giao thông (Hiện theo dòng với tên địa điểm, thời gian, khoảng cách - Hiện tối đa 4 tiện ích, nhiều hơn sẽ cuộn) */}
              <div className={`mt-6 pt-6 border-t ${locationTheme.isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${locationTheme.mutedClass}`}>
                    Kết nối hạ tầng giao thông
                  </h3>
                  {displayDistances.length > 4 && (
                    <span className="text-[11px] text-gray-400 font-medium">
                      Cuộn để xem thêm ({displayDistances.length} điểm kết nối)
                    </span>
                  )}
                </div>

                <div className="rounded-none overflow-hidden bg-white">
                  {/* Tiêu đề cột */}
                  <div className="bg-slate-50/70 border-b border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <span className="flex-1">Tên địa điểm</span>
                    <span className="w-28 text-center">Thời gian</span>
                    <span className="w-24 text-right">Khoảng cách</span>
                  </div>

                  {/* Danh sách dòng kết nối: max-h-[196px] để hiển thị vừa vặn 4 dòng (~48px/dòng), nhiều hơn sẽ cuộn */}
                  <div className="max-h-[196px] overflow-y-auto divide-y divide-slate-100">
                    {displayDistances.map((dist, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Tên địa điểm */}
                        <div className="flex-1 flex items-center gap-2 min-w-0 pr-2">
                          <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                          <span className="text-xs sm:text-sm font-semibold text-[#0F1E36] truncate">
                            {dist.place}
                          </span>
                        </div>

                        {/* Thời gian */}
                        <div className="w-28 text-center shrink-0">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded-none">
                            <Clock className="w-3 h-3 text-[#C5A059]" />
                            {dist.time}
                          </span>
                        </div>

                        {/* Khoảng cách */}
                        <div className="w-24 text-right shrink-0">
                          <span className="text-xs font-medium text-gray-600">
                            {dist.distance_km}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location Distances Note (if configured in CMS) */}
                {project.location_distances_note && (
                  <div className="mt-3.5 py-2 text-xs text-gray-600 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{project.location_distances_note}</span>
                  </div>
                )}
              </div>
            </section>



            {/* ── SECTION 5: CHỦ ĐẦU TƯ ── */}
            <section
              id="chu-dau-tu"
              style={developerTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${developerTheme.containerClass}`}
            >
              <div className="mb-6">
                <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${developerTheme.headingClass}`}>
                  Chủ đầu tư
                </h2>
                <p className={`text-xs sm:text-sm mt-1 ${developerTheme.mutedClass}`}>
                  Uy tín và năng lực phát triển bất động sản quốc tế
                </p>
              </div>

              {/* Developer Profile Info */}
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center border-y border-slate-100 py-4">
                  <div>
                    <div className="text-lg sm:text-2xl font-black text-[#0F1E36]">
                      {project.stats?.['Kinh nghiệm CĐT'] || project.stats?.['developer_experience'] || '28+ Năm'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold mt-0.5">Kinh nghiệm quốc tế</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-black text-[#0F1E36]">
                      {project.stats?.['Quy mô CĐT'] || project.stats?.['developer_projects_count'] || '11+'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold mt-0.5">Khu đô thị sinh thái</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-black text-[#0F1E36]">
                      {project.stats?.['Giải thưởng CĐT'] || project.stats?.['developer_awards'] || '75+'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold mt-0.5">Giải thưởng danh giá</div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                  {project.developer_description ||
                    project.stats?.['developer_description'] ||
                    project.stats?.['Mô tả CĐT'] ||
                    `${project.developer || 'Gamuda Land'} là một trong những nhà phát triển bất động sản hàng đầu khu vực với triết lý kiến tạo các khu đô thị sinh thái xanh, tôn trọng thiên nhiên và gắn kết cộng đồng. Với tiềm lực tài chính vững mạnh và uy tín đã được khẳng định qua hàng loạt dự án đại đô thị mẫu mực tại Việt Nam, chủ đầu tư cam kết mang đến những công trình trường tồn cùng thời gian.`}
                </p>

                {/* Notable projects */}
                {(() => {
                  const rawNotable = project.stats?.['developer_notable_projects'] || project.stats?.['Dự án tiêu biểu CĐT'];
                  const notableList = rawNotable
                    ? rawNotable.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean)
                    : ['Celadon City (TP.HCM)', 'Gamuda City (Hà Nội)', 'Elysian (TP. Thủ Đức)'];
                  if (notableList.length === 0) return null;
                  return (
                    <div className="pt-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                        Dự án tiêu biểu đã phát triển thành công
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold text-gray-800">
                        {notableList.map((pj: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 py-1">
                            <Building2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                            <span className="truncate">{pj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* ── SECTION 6: CÂU HỎI THƯỜNG GẶP (FAQ) ── */}
            <section
              id="faq"
              style={faqTheme.bgStyle}
              className={`scroll-mt-28 transition-colors ${faqTheme.containerClass}`}
              itemScope
              itemType="https://schema.org/FAQPage"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight ${faqTheme.headingClass}`}>
                    Câu hỏi thường gặp (FAQ)
                  </h2>
                  <p className={`text-xs sm:text-sm mt-1 ${faqTheme.mutedClass}`}>
                    Giải đáp nhanh những thắc mắc của khách hàng về dự án {project.name}
                  </p>
                </div>
                <HelpCircle className="w-6 h-6 text-[#C5A059]" />
              </div>

              {/* ── DIRECT ANSWERS SUMMARY (Dành cho AI trích dẫn & Khách hàng tra cứu nhanh) ── */}
              <div className="mb-6 p-4 sm:p-5 rounded-xl bg-[#FBF9F5] border border-[#E8DFC9] text-xs sm:text-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tóm tắt câu trả lời trực tiếp (Direct Answers)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {faqsList.map((f, i) => {
                    const directAnswer = f.answer.split('.')[0] + '.';
                    return (
                      <div key={i} className="p-3 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1">
                        <h3 className="font-bold text-slate-900 text-xs line-clamp-1">{f.question}</h3>
                        <p className="text-[12px] text-slate-600 leading-snug">
                          <strong className="text-slate-900 font-semibold">Trả lời nhanh: </strong>
                          {directAnswer}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── INTERACTIVE ACCORDION WITH FULL DOM PRESENCE & MICRODATA ── */}
              <div className="divide-y divide-slate-100">
                {faqsList.map((faq, idx) => {
                  const isOpen = openFaqIdx === idx;
                  const firstSentence = faq.answer.split('.')[0] + '.';
                  const restAnswer = faq.answer.substring(firstSentence.length).trim();

                  return (
                    <div
                      key={idx}
                      className="py-3.5 transition-colors"
                      itemScope
                      itemProp="mainEntity"
                      itemType="https://schema.org/Question"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#0F1E36] hover:text-[#C5A059] transition-colors cursor-pointer"
                      >
                        <span itemProp="name">{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#C5A059]' : ''
                          }`}
                        />
                      </button>

                      <div
                        itemScope
                        itemProp="acceptedAnswer"
                        itemType="https://schema.org/Answer"
                        className={`pt-2.5 text-xs sm:text-sm text-gray-600 leading-relaxed transition-all duration-200 ${
                          isOpen ? 'block' : 'hidden'
                        }`}
                      >
                        <div itemProp="text" className="space-y-2">
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60 text-slate-900 font-medium">
                            <span className="font-bold text-[#C5A059] mr-1.5">[Câu trả lời trực tiếp]</span>
                            <span className="font-semibold text-slate-900">{firstSentence}</span>
                          </div>
                          {restAnswer && (
                            <p className="text-gray-600 pl-0.5">
                              {restAnswer}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          {/* ───────────────────────────────────────
              RIGHT STICKY SIDEBAR COLUMN (4 COLS)
          ─────────────────────────────────────── */}
          <aside
            style={{ top: mainNavHeight ? `${mainNavHeight + 48}px` : undefined }}
            className="lg:col-span-4 sticky top-20 sm:top-24 space-y-4"
          >
            {/* Price & Lead Consultation Card */}
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-900/5 overflow-hidden transition-all duration-300">
              {/* Luxury Accent Top Border */}
              <div className="h-1.5 bg-gradient-to-r from-[#0F1E36] via-[#C5A059] to-[#D4AF37]" />

              <div className="p-4 sm:p-5 space-y-3">
                {/* 1. Price & Exclusive Offer Block */}
                <div className="pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                      Giá bán tham chiếu
                    </span>
                  </div>

                  <div className="text-xl sm:text-2xl font-black text-[#0F1E36] tracking-tight">
                    {project.price_range || '7 - 12 tỷ'}
                  </div>

                  <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-emerald-50/90 border border-emerald-200/70 text-[11px] text-emerald-800 font-semibold shadow-xs">
                    <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span className="leading-tight">
                      {project.stats?.['Chiết khấu chi tiết'] ||
                        project.stats?.['Chiết khấu'] ||
                        'Chính sách chiết khấu tới 8% đợt mở bán'}
                    </span>
                  </div>
                </div>

                {/* 2. Consultation Lead Form */}
                <div>
                  <div className="mb-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
                      <h2 className="text-xs sm:text-sm font-extrabold text-[#0F1E36] uppercase tracking-wide">
                        {project.contact_title || 'Đăng ký tư vấn & Báo giá'}
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {project.contact_description || 'Để lại thông tin để nhận bảng giá chi tiết từng căn và mặt bằng qua Zalo/Email.'}
                    </p>
                  </div>

                  {leadFormSubmitted ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-in fade-in duration-200">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="text-xs font-bold text-emerald-800">Đăng ký thành công!</div>
                      <p className="text-[11px] text-emerald-700 leading-relaxed">
                        Chuyên viên Maian Homes sẽ liên hệ gửi tài liệu dự án {project.name} qua Zalo cho quý khách trong 5 phút.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLeadFormSubmitted(false)}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Gửi lại yêu cầu khác
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleLeadSubmit} className="space-y-2">
                      {/* Name Input */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Họ và tên của bạn *"
                          value={leadFormData.name}
                          onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                        />
                      </div>

                      {/* Phone Input */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="Số điện thoại / Zalo *"
                          value={leadFormData.phone}
                          onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                        />
                      </div>

                      {/* Email Input */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="email"
                          placeholder="Email nhận bảng giá & tài liệu"
                          value={leadFormData.email}
                          onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                        />
                      </div>

                      {/* Unit & Purpose Dropdowns */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <select
                            value={leadFormData.unitType || availableUnitTypes[0]}
                            onChange={(e) => setLeadFormData({ ...leadFormData, unitType: e.target.value })}
                            className="w-full pl-2.5 pr-6 py-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all cursor-pointer appearance-none"
                          >
                            {availableUnitTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <select
                            value={leadFormData.purpose}
                            onChange={(e) => setLeadFormData({ ...leadFormData, purpose: e.target.value })}
                            className="w-full pl-2.5 pr-6 py-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all cursor-pointer appearance-none"
                          >
                            <option value="Ở thực">Nhu cầu: Ở</option>
                            <option value="Đầu tư">Nhu cầu: Đầu tư</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Submit CTA Button */}
                      <button
                        type="submit"
                        className="group w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md shadow-[#C5A059]/25 hover:shadow-lg hover:shadow-[#C5A059]/40 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B8860B] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-0.5"
                      >
                        <Send className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        <span>Nhận Báo Giá & Mặt Bằng Ngay</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* 3. Direct Hotline & PKD Card */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-[#C5A059] shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Hotline PKD
                      </div>
                      <a
                        href={`tel:${project.contact_phone || '0901234567'}`}
                        aria-label={`Hotline phòng kinh doanh dự án ${project.name}`}
                        className="text-xs font-black text-[#0F1E36] hover:text-[#C5A059] transition-colors"
                      >
                        {project.contact_phone || '090 123 4567'}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Hỗ trợ 24/7</span>
                  </div>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          5. MOBILE FLOATING ACTION BAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 flex items-center gap-3 shadow-lg">
        <a
          href={`tel:${project.contact_phone || '0901234567'}`}
          aria-label={`Gọi hotline tư vấn nhanh dự án ${project.name}`}
          className="flex-1 py-2.5 rounded-xl bg-slate-100 text-[#0F1E36] font-bold text-xs flex items-center justify-center gap-2 border border-slate-200"
        >
          <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Gọi hotline</span>
        </a>
        <button
          onClick={() => scrollToSection('lien-he')}
          className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
          style={{ backgroundColor: accentColor }}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Nhận báo giá</span>
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          6. LIGHTBOX MODAL: FULL GALLERY
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-white">
            <span className="text-xs font-bold">
              {lightboxIndex + 1} / {allImages.length}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative my-4">
            <Image
              src={getAssetUrl(allImages[lightboxIndex]) || allImages[lightboxIndex]}
              alt={`${project.name} preview`}
              width={1600}
              height={1000}
              sizes="90vw"
              className="max-h-[80vh] max-w-full w-auto h-auto object-contain rounded-xl"
            />
          </div>

          <div className="flex items-center justify-center gap-4 text-white">
            <button
              onClick={() => setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
            >
              Ảnh trước
            </button>
            <button
              onClick={() => setLightboxIndex((lightboxIndex + 1) % allImages.length)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
            >
              Ảnh sau
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          7. LIGHTBOX MODAL: BLUEPRINT ZOOM
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {blueprintZoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-sm font-bold">
                {floorPlanMode === 'floor'
                  ? `Sơ đồ mặt bằng ${activeGroup.group_name}`
                  : `Bản vẽ thiết kế ${selectedUnit?.name}`}
              </h2>
              <p className="text-xs text-gray-400">Dùng cuộn chuột hoặc ngón tay để thu phóng chi tiết</p>
            </div>
            <button
              onClick={() => setBlueprintZoomOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative my-4 overflow-auto">
            <Image
              src={
                floorPlanMode === 'floor'
                  ? getAssetUrl(activeGroup.floor_map_image) || '/images/The_Prive/TANG-21_TW9.jpg'
                  : getAssetUrl(selectedUnit?.image_url) || '/images/The_Prive/layout2PN.png'
              }
              alt="Zoom layout"
              width={1800}
              height={1200}
              sizes="90vw"
              className="max-h-[85vh] max-w-full w-auto h-auto object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <span>© Maian Homes Design & Architecture</span>
            <button
              onClick={() => setBlueprintZoomOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold"
            >
              Đóng xem
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          7B. LIGHTBOX MODAL: AMENITY PHOTO ZOOM
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {zoomAmenityImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{zoomAmenityImage.name}</h2>
              <p className="text-xs text-gray-400">Tiện ích đặc quyền {project.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setZoomAmenityImage(null)}
              className="p-2 rounded-none bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative my-4 overflow-auto">
            <Image
              src={zoomAmenityImage.url}
              alt={zoomAmenityImage.name}
              width={1600}
              height={1000}
              sizes="90vw"
              className="max-h-[85vh] max-w-full w-auto h-auto object-contain rounded-none select-none"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <span>© {project.name} Resort Living</span>
            <button
              type="button"
              onClick={() => setZoomAmenityImage(null)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 font-bold rounded-none cursor-pointer"
            >
              Đóng xem
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          8. VIDEO MODAL: YOUTUBE PLAYER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {videoModalOpen && embedVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <div className="flex items-center justify-between p-3.5 bg-zinc-900 text-white border-b border-zinc-800">
              <span className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <Play className="w-4 h-4 text-[#C5A059] fill-current" />
                <span>Video giới thiệu: {project.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={embedVideoUrl}
                title={`Video giới thiệu ${project.name}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CONSULTATION REGISTRATION POPUP MODAL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top gold bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#0F1E36] via-[#C5A059] to-[#D4AF37]" />

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                  {project.name}
                </span>
                <h2 className="text-base font-extrabold text-[#0F1E36]">
                  {project.contact_title || 'Đăng Ký Tư Vấn & Báo Giá'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {leadFormSubmitted ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-sm font-bold text-emerald-800">Đăng ký thành công!</div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Chuyên viên Maian Homes sẽ gửi trọn bộ tài liệu dự án {project.name} qua Zalo/Email cho quý khách trong ít phút.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadFormSubmitted(false);
                      setIsRegisterModalOpen(false);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Họ và tên quý khách <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={leadFormData.name}
                        onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Số điện thoại / Zalo <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="090 123 4567"
                          value={leadFormData.phone}
                          onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Email nhận tài liệu
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={leadFormData.email}
                          onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Loại căn quan tâm
                      </label>
                      <div className="relative">
                        <select
                          value={leadFormData.unitType || availableUnitTypes[0]}
                          onChange={(e) => setLeadFormData({ ...leadFormData, unitType: e.target.value })}
                          className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all cursor-pointer appearance-none"
                        >
                          {availableUnitTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Mục đích
                      </label>
                      <div className="relative">
                        <select
                          value={leadFormData.purpose}
                          onChange={(e) => setLeadFormData({ ...leadFormData, purpose: e.target.value })}
                          className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all cursor-pointer appearance-none"
                        >
                          <option value="Ở thực">Nhu cầu: Ở</option>
                          <option value="Đầu tư">Nhu cầu: Đầu tư</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="group w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#C5A059]/25 hover:shadow-xl hover:shadow-[#C5A059]/40 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B8860B] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    <span>Gửi Đăng Ký & Nhận Báo Giá Ngay</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
