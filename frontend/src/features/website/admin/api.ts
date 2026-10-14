import { apiFetch, apiUpload } from '@/lib/api';

export interface WebsitePageRecord {
  page_key: string;
  version: number;
  status: string;
  workflow_status?: string;
  publication_status?: string;
  draft?: { content?: Record<string, unknown>; seo?: Record<string, unknown>; geo?: Record<string, unknown> };
  published_snapshot?: Record<string, unknown>;
}

export interface WebsiteContentField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'url' | 'media' | 'sections';
  required: boolean;
  max_length: number;
  section: string;
}

export interface WebsiteMediaSlot {
  key: string;
  label: string;
  min_width: number;
  min_height: number;
  aspect_ratio?: number | null;
  required: boolean;
}

export interface WebsitePageDefinition {
  label: string;
  public_path: string;
  fields: WebsiteContentField[];
  media_slots: WebsiteMediaSlot[];
  frontend_component: string;
}

export interface DashboardOverview {
  pages: {
    total: number;
    by_status: Record<string, number>;
    seo_completed?: number;
    geo_completed?: number;
  };
  leads?: { total: number; new: number };
  projects?: { total: number; published: number };
  articles?: { total: number; published: number };
  branding: { status?: string; updated_at?: string };
  media: { total: number; missing_alt: number; unused: number };
  recent: Array<{ page_key: string; status?: string; updated_at?: string; updated_by?: string }>;
}

export interface WebsiteAnalyticsSummary {
  period: string;
  duration_days: number;
  overview: {
    total: number;
    new: number;
    viewed: number;
    exported: number;
    archived: number;
    processed: number;
    response_rate: number;
    previous_period_total: number;
    growth_rate: number;
  };
  timeline: Array<{
    date: string;
    count: number;
    new_count: number;
  }>;
  by_form: Array<{
    form_id: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  by_source: Array<{
    source: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  by_utm_source: Array<{
    source: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  by_status: Array<{
    status: string;
    label: string;
    color: string;
    count: number;
    percentage: number;
  }>;
  top_pages: Array<{
    page_key: string;
    page_url: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  recent_leads: Array<{
    id: string;
    customer_name: string;
    phone: string;
    email?: string | null;
    form_id: string;
    form_label: string;
    status: string;
    status_label: string;
    status_color: string;
    submitted_at: string;
  }>;
}

export interface WebsiteLead {
  id: string;
  customer_name: string;
  phone: string;
  email?: string;
  status: 'NEW' | 'VIEWED' | 'EXPORTED' | 'ARCHIVED';
  status_label?: string;
  status_color?: string;
  source: 'COWORKING' | 'OFFICE' | 'PROJECT' | 'CONSIGNMENT' | 'WEBSITE' | string;
  source_label?: string;
  form_id: string;
  form_label?: string;
  page_key?: string;
  page_url?: string;
  project_id?: string;
  project_name_snapshot?: string;
  staff_profile_id?: string;
  message?: string;
  note?: string;
  structured_details?: Record<string, string>;
  consignment_media_urls?: string[];
  consignment_summary?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer?: string;
  submitted_at: string;
  version: number;
}

export interface WebsiteLeadCounts {
  total: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
}

export interface PublicStaffDraft {
  slug: string;
  profile_type: 'BROKER' | 'LEADERSHIP' | 'SPECIALIST';
  full_name: string;
  position: string;
  phone?: string | null;
  email?: string | null;
  avatar_media_id?: string | null;
  avatar_alt_text: string;
  headline: string;
  short_bio: string;
  about: string;
  quote?: string | null;
  specialties: Array<{ title: string; description: string }>;
  achievements: Array<{ title: string; description: string }>;
  years_experience: number;
  customers_served: number;
  deals_completed: number;
  satisfaction_rate: number;
  linkedin_url?: string | null;
  show_on_home: boolean;
  is_featured: boolean;
  allow_detail_view: boolean;
  display_order: number;
  project_ids: string[];
  seo_title?: string | null;
  seo_description?: string | null;
  consent_confirmed: boolean;
}

export interface PublicStaffRecord {
  id: string;
  version: number;
  status: string;
  draft: PublicStaffDraft;
  published_snapshot?: PublicStaffDraft;
  published_version?: number;
  updated_at?: string;
  rejection_reason?: string;
  is_public?: boolean;
}

export interface PublicStaffOptions {
  projects: Array<{ id: string; name?: string; slug?: string; location?: string; image?: string }>;
  media: Array<{ id: string; url: string; alt_text: string; namespace?: string; original_filename?: string }>;
}

export interface StaffAvatarUpload {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
  content_type: string;
}

export interface RecruitmentJob {
  id: string;
  version: number;
  status: string;
  draft: {
    title: string; slug: string; department: string; location: string;
    employment_type: string; quantity: number; salary_range?: string;
    short_description?: string; description_html: string;
    requirements_html: string; benefits_html: string; address_detail?: string;
    seo_title?: string; seo_description?: string;
  };
}

export interface JobApplication {
  id: string;
  job_slug: string;
  full_name: string;
  email?: string;
  phone: string;
  status: string;
  submitted_at: string;
  resume_filename?: string;
  birth_year?: number | null;
  education?: string | null;
  school?: string | null;
  address?: string | null;
  resume_size?: number;
}

export const websiteAdminApi = {
  dashboard: {
    overview: (): Promise<DashboardOverview> => apiFetch('/website/dashboard/overview'),
  },
  pages: {
    list: (): Promise<{ items: WebsitePageRecord[] }> => apiFetch('/website/pages'),
    definitions: (): Promise<{items: Record<string, WebsitePageDefinition>}> =>
      apiFetch('/website/pages/definitions'),
    update: (pageKey: string, payload: Record<string, unknown>) =>
      apiFetch(`/website/pages/${pageKey}`, { method: 'PUT', body: JSON.stringify(payload) }),
    transition: (pageKey: string, action: string, expectedVersion: number, targetVersion?: number, note?: string) =>
      apiFetch(`/website/pages/${pageKey}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, expected_version: expectedVersion, target_version: targetVersion, note }),
      }),
    versions: (pageKey: string): Promise<{items: Array<{id: string; version: number; snapshot: Record<string, unknown>; created_at: string}>}> =>
      apiFetch(`/website/pages/${pageKey}/versions`),
  },
  leads: {
    list: (query = ''): Promise<{ items: WebsiteLead[]; total: number; page: number; limit: number }> =>
      apiFetch(`/website/leads${query ? `?${query}` : ''}`),
    counts: (): Promise<WebsiteLeadCounts> =>
      apiFetch('/website/leads/counts'),
    status: (id: string, status: 'VIEWED' | 'ARCHIVED', expectedVersion: number) =>
      apiFetch(`/website/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, expected_version: expectedVersion }),
      }),
  },
  analytics: {
    getSummary: (params?: {
      period?: 'today' | '7d' | '30d' | 'this_month' | 'all';
      date_from?: string;
      date_to?: string;
    }): Promise<WebsiteAnalyticsSummary> => {
      const q = new URLSearchParams();
      if (params?.period) q.set('period', params.period);
      if (params?.date_from) q.set('date_from', params.date_from);
      if (params?.date_to) q.set('date_to', params.date_to);
      const qs = q.toString();
      return apiFetch(`/website/analytics/summary${qs ? `?${qs}` : ''}`);
    },
  },
  staff: {
    list: (): Promise<{ items: PublicStaffRecord[] }> => apiFetch('/website/staff'),
    detail: (id: string): Promise<PublicStaffRecord> => apiFetch(`/website/staff/${id}`),
    options: (): Promise<PublicStaffOptions> => apiFetch('/website/staff/options'),
    uploadAvatar: (file: File, altText: string): Promise<StaffAvatarUpload> => {
      const body = new FormData();
      body.append('file', file);
      body.append('alt_text', altText);
      return apiUpload('/website/staff/avatar', body) as Promise<StaffAvatarUpload>;
    },
    create: (payload: PublicStaffDraft): Promise<PublicStaffRecord> =>
      apiFetch('/website/staff', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: PublicStaffDraft, expectedVersion: number): Promise<PublicStaffRecord> =>
      apiFetch(`/website/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, expected_version: expectedVersion }),
      }),
    delete: (id: string, expectedVersion: number): Promise<null> =>
      apiFetch(`/website/staff/${id}?expected_version=${expectedVersion}`, { method: 'DELETE' }),
    preview: (id: string): Promise<Record<string, unknown>> => apiFetch(`/website/staff/${id}/preview`),
    versions: (id: string): Promise<{ items: Array<{ id: string; version: number; created_at: string }> }> =>
      apiFetch(`/website/staff/${id}/versions`),
    transition: (id: string, action: string, expectedVersion: number, note?: string, targetVersion?: number) =>
      apiFetch(`/website/staff/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, expected_version: expectedVersion, note, target_version: targetVersion }),
      }),
  },
  recruitment: {
    list: (): Promise<{ items: RecruitmentJob[] }> => apiFetch('/website/recruitment'),
    create: (payload: Record<string, unknown>) =>
      apiFetch('/website/recruitment', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>, expectedVersion: number) =>
      apiFetch(`/website/recruitment/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, expected_version: expectedVersion }),
      }),
    transition: (id: string, action: string, expectedVersion: number) =>
      apiFetch(`/website/recruitment/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, expected_version: expectedVersion }),
      }),
    applications: (): Promise<{ items: JobApplication[] }> => apiFetch('/website/applications'),
  },
  branding: {
    get: (): Promise<WebsiteBrandingRecord> => apiFetch('/website/branding'),
    update: (payload: Record<string, unknown>): Promise<WebsiteBrandingRecord> =>
      apiFetch('/website/branding', { method: 'PUT', body: JSON.stringify(payload) }),
    publish: (expectedVersion: number): Promise<WebsiteBrandingRecord> =>
      apiFetch('/website/branding/publish', {
        method: 'POST',
        body: JSON.stringify({ expected_version: expectedVersion }),
      }),
  },
  media: {
    list: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      used?: boolean;
    }): Promise<{ items: MediaAssetItem[]; total: number; page: number; limit: number }> => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.used !== undefined) q.set('used', String(params.used));
      const qs = q.toString();
      return apiFetch(`/website/media${qs ? `?${qs}` : ''}`);
    },
    update: (
      id: string,
      payload: { alt_text?: string; display_name?: string; caption?: string; credit?: string }
    ) => apiFetch(`/website/media/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    upload: (formData: FormData) => apiUpload('/website/media/upload', formData),
    delete: (id: string) => apiFetch(`/website/media/${id}`, { method: 'DELETE' }),
  },
};

export interface MediaAssetItem {
  id: string;
  url: string;
  display_name: string;
  original_filename?: string;
  alt_text?: string;
  caption?: string;
  credit?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  namespace?: string;
  lifecycle_status?: string;
  references?: string[];
  created_at?: string;
}

export interface WebsiteBrandingRecord {
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  published_version?: number;
  published_at?: string;
  updated_at?: string;
  draft: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    zalo_oa_id?: string | null;
    zalo_url?: string | null;
    messenger_url?: string | null;
    social_links?: Record<string, string>;
    footer?: {
      company_name?: string;
      tax_id?: string;
      working_hours?: string;
      copyright_text?: string;
      [key: string]: unknown;
    };
    header?: Record<string, unknown>;
    logo_header_media_id?: string | null;
    logo_footer_media_id?: string | null;
    [key: string]: unknown;
  };
  published_snapshot?: Record<string, unknown>;
}

export async function downloadLeadExport(format: 'csv' | 'xlsx' | 'zip', filters: Record<string, string> = {}) {
  const response = await fetch('/api/protected/website/leads/export', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, ...filters }),
  });
  if (!response.ok) throw new Error('Không thể xuất dữ liệu khách hàng.');
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || `website-leads.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadLeadImagesZip(leadId: string) {
  const response = await fetch(`/api/protected/website/leads/${leadId}/images/zip`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Không thể tải ảnh.' }));
    throw new Error(err.detail || 'Không thể tải ảnh.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || `anh-ky-gui-${leadId.slice(0, 8)}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
