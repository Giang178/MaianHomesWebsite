export type PublicProfileType = 'BROKER' | 'LEADERSHIP' | 'SPECIALIST';

export interface ProfileContentItem {
  title: string;
  description: string;
}

export interface TeamProject {
  id: string;
  name: string;
  slug: string;
  location?: string;
  status?: string;
  price_range?: string;
  image?: string;
  logo_url?: string;
  images?: string[];
  hero_images?: string[];
}

export interface TeamMember {
  slug: string;
  profile_type: PublicProfileType;
  full_name: string;
  position: string;
  phone?: string;
  email?: string;
  avatar_url: string;
  avatar_alt_text?: string;
  years_experience: number;
  headline: string;
  short_bio: string;
  about: string;
  quote?: string;
  specialties: ProfileContentItem[];
  achievements: ProfileContentItem[];
  customers_served: number;
  deals_completed: number;
  satisfaction_rate: number;
  linkedin_url?: string;
  show_on_home: boolean;
  is_featured: boolean;
  allow_detail_view: boolean;
  display_order: number;
  seo_title?: string;
  seo_description?: string;
  projects: TeamProject[];
  updated_at?: string;
}

export interface TeamListResponse {
  items?: TeamMember[];
  data: TeamMember[];
  next_cursor?: string | null;
  total: number;
}
