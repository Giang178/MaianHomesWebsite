export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
export type AvailabilityStatus =
  | 'AVAILABLE'
  | 'UPCOMING'
  | 'NEGOTIATING'
  | 'RENTED'
  | 'SUSPENDED'
  | 'PENDING';
export type BuildingGrade = 'A' | 'B' | 'C';

export interface WorkspaceAmenity {
  id?: string;
  icon: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
}

export interface WorkspaceGalleryImage {
  id?: string;
  url: string;
  alt_text: string;
  caption?: string;
  is_primary?: boolean;
  display_order?: number;
}

export interface WorkspaceSEOMetadata {
  title: string;
  description: string;
  canonical_url?: string;
  robots?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  focus_keyword?: string;
  keywords?: string[] | string;
  h1?: string;
}

export interface WorkspaceFAQ {
  id?: string;
  _id?: string;
  entity_type?: 'COWORKING' | 'OFFICE_LANDING' | 'BUILDING';
  entity_id?: string;
  category?: string;
  question: string;
  answer: string;
  display_order?: number;
  status?: 'PUBLISHED' | 'HIDDEN';
}

export interface SeatType {
  id?: string;
  _id?: string;
  space_key?: string;
  name: string;
  code?: string;
  description: string;
  target_audience?: string;
  features?: string[];
  image_url?: string | null;
  alt_text?: string;
  capacity?: number | null;
  reference_price?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  display_order?: number;
}

export interface PricingPlan {
  id?: string;
  _id?: string;
  space_key?: string;
  seat_type_id?: string | null;
  seat_type_name?: string | null;
  name: string;
  code?: string;
  plan_code?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  billing_period?: string; // NGAY, TUAN, THANG, NAM, LIEN_HE
  cycle?: string;
  duration?: string;
  benefits?: string[];
  features?: string[];
  extra_fees?: string | null;
  is_featured?: boolean;
  is_popular?: boolean;
  is_contact_price?: boolean;
  badge?: string;
  status?: 'ACTIVE' | 'HIDDEN';
  display_order?: number;
}

export interface CoworkingData {
  id?: string;
  key: string;
  name: string;
  slug: string;
  status: PublicationStatus;
  version: number;
  published_version?: number;
  hero: {
    title: string;
    subtitle: string;
    description: string;
    image_url: string;
    cta_tour_label: string;
    cta_consult_label: string;
  };
  introduction: {
    title: string;
    short_desc: string;
    full_desc: string;
    target_audience: string[];
    highlights: string[];
    image_url: string;
  };
  location: {
    address: string;
    district: string;
    city: string;
    latitude?: number;
    longitude?: number;
    map_embed_url: string;
    directions_url: string;
    contact_phone: string;
    contact_email: string;
    operating_hours: string;
  };
  amenities?: WorkspaceAmenity[] | any[];
  gallery?: WorkspaceGalleryImage[] | any[];
  seo_metadata: WorkspaceSEOMetadata;
  seat_types?: SeatType[];
  pricing_plans?: PricingPlan[];
  faqs?: WorkspaceFAQ[];
  has_draft?: boolean;
  draft_snapshot?: Record<string, unknown> | null;
}

export interface DistrictSpotlight {
  id: string;
  name: string;
  districtQuery?: string;
  district_query?: string;
  subtitle: string;
  badge: string;
  priceRange?: string;
  price_range?: string;
  description: string;
  imageUrl?: string;
  image_url?: string;
  alt_text?: string;
  image_alt?: string;
  highlights: string[];
}

export interface GradeSpotlight {
  id: string;
  grade: 'A' | 'B' | 'C' | string;
  name: string;
  subtitle: string;
  badge: string;
  priceRange?: string;
  price_range?: string;
  ceiling_height?: string;
  air_conditioning?: string;
  elevators?: string;
  electricity_backup?: string;
  management_company?: string;
  target_audience?: string;
  description: string;
  imageUrl?: string;
  image_url?: string;
  alt_text?: string;
  image_alt?: string;
  specs?: Array<{ label: string; value: string; desc: string }>;
  criteriaList?: Array<{ title: string; desc: string }>;
  highlights: string[];
}

export interface OfficeProcessStep {
  step: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface HeroCounter {
  value: string;
  label: string;
  sublabel: string;
}

export interface OfficeLandingData {
  id?: string;
  key: string;
  hero_title: string;
  hero_subtitle: string;
  hero_description: string;
  hero_image_url: string;
  hero_alt_text?: string;
  hero_badge?: string;
  hero_counters?: HeroCounter[];
  intro_title: string;
  intro_description: string;
  cta_consult_label: string;
  cta_list_label: string;
  grades_title?: string;
  grades_subtitle?: string;
  grades?: GradeSpotlight[];
  districts_title?: string;
  districts_subtitle?: string;
  districts?: DistrictSpotlight[];
  process_badge?: string;
  process_title?: string;
  process_subtitle?: string;
  process_steps?: OfficeProcessStep[];
  market_section_title?: string;
  market_section_description?: string;
  consultation_badge?: string;
  consultation_title?: string;
  consultation_description?: string;
  status: PublicationStatus;
  version?: number;
  seo_metadata?: WorkspaceSEOMetadata;
  seo?: Record<string, any>;
  grade_pages?: Record<string, any>;
  faqs?: WorkspaceFAQ[];
  has_draft?: boolean;
}

export interface OfficeUnit {
  id?: string;
  _id?: string;
  building_id?: string;
  unit_code: string;
  floor: string;
  area?: number;
  area_sqm?: number;
  rental_price?: number;
  price_per_sqm?: number;
  currency?: string;
  price_unit?: string;
  management_fee?: string;
  handover_condition?: string;
  extra_fees?: string | null;
  availability_status?: AvailabilityStatus | string;
  available_from?: string;
  notes?: string | null;
  status?: 'ACTIVE' | 'HIDDEN' | any;
  display_order?: number;
}

export interface OfficeBuilding {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  code?: string;
  address: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
  building_grade?: BuildingGrade | string;
  grade?: BuildingGrade | string;
  certification?: string;
  total_floors?: string | number;
  basements?: number;
  elevators?: string;
  ceiling_height?: number | string;
  typical_floor_area?: string | number;
  direction?: string;
  year_completed?: string;
  lease_term_min?: string;
  motorcycle_parking_fee?: string;
  car_parking_fee?: string;
  electricity_fee?: string;
  electricity_backup?: string;
  overtime_fee?: string;
  vat_tax?: string;
  deposit_term?: string;
  payment_term?: string;
  air_conditioning?: string;
  management_company?: string;
  location_highlights?: string[];
  price_per_sqm_min?: number;
  price_per_sqm_max?: number;
  management_fee_per_sqm?: number;
  description: string;
  highlights?: string[];
  amenities: string[];
  images?: any[];
  map_embed_url?: string;
  directions_url?: string;
  contact_phone?: string;
  contact_email?: string;
  status?: PublicationStatus | string;
  version?: number;
  display_order?: number;
  seo_metadata?: WorkspaceSEOMetadata;
  seo?: any;
  units?: OfficeUnit[];
  faqs?: WorkspaceFAQ[];
  min_area?: number;
  max_area?: number;
  min_price?: number;
  total_units?: number;
  available_units_count?: number;
  has_available_units?: boolean;
  has_draft?: boolean;
}

export type OfficeLandingContent = OfficeLandingData & {
  title?: string;
  subtitle?: string;
  hero_image?: string;
  hero_alt_text?: string;
  highlights?: Array<{ title: string; description: string }>;
  seo?: any;
};

export type CoworkingSpace = CoworkingData & {
  tagline?: string;
  address?: string;
  district?: string;
  city?: string;
  phone?: string;
  email?: string;
  hero_image?: string;
  hero_alt_text?: string;
  intro_image?: string;
  intro_alt_text?: string;
  intro_title?: string;
  intro_short_desc?: string;
  intro_full_desc?: string;
  intro_highlights?: string[];
  intro_target_audience?: string[];
  opening_hours?: string;
  seo?: any;
};


export interface OfficeBuildingsResponse {
  items: OfficeBuilding[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  districts?: string[];
}

export interface AuditCheckItem {
  field: string;
  status: 'PASSED' | 'WARNING' | 'ERROR';
  message: string;
  current_value?: string | null;
  recommendation?: string | null;
}

export interface PageSEOGEOAudit {
  page_id: string;
  page_type: 'COWORKING' | 'OFFICE_LANDING' | 'BUILDING';
  title: string;
  slug: string;
  seo_score_label: 'Đạt' | 'Cần cải thiện' | 'Lỗi cần xử lý';
  geo_score_label: 'Đạt' | 'Cần cải thiện' | 'Lỗi cần xử lý';
  seo_checks: AuditCheckItem[];
  geo_checks: AuditCheckItem[];
  structured_data_preview: Record<string, unknown>;
  last_updated?: string | null;
}

export interface WorkspacesOverviewStats {
  total_buildings: number;
  published_buildings: number;
  total_units: number;
  available_units: number;
  total_plans: number;
  active_plans: number;
  coworking_leads_count: number;
  office_leads_count: number;
  total_workspace_leads: number;
}
