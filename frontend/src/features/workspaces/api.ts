import { apiFetch, apiUpload } from '@/lib/api';
import {submitPublicLead} from '@/features/inquiries/api';
import {
  CoworkingData,
  OfficeBuilding,
  OfficeBuildingsResponse,
  OfficeLandingData,
  OfficeUnit,
  PageSEOGEOAudit,
  PricingPlan,
  SeatType,
  WorkspaceFAQ,
  WorkspacesOverviewStats,
} from './types';

const BUILDING_FIELDS = [
  'name', 'slug', 'code', 'address', 'district', 'city', 'latitude', 'longitude', 'certification',
  'total_floors', 'basements', 'elevators', 'ceiling_height',
  'typical_floor_area', 'direction', 'year_completed', 'lease_term_min',
  'motorcycle_parking_fee', 'motorbike_fee', 'car_parking_fee',
  'electricity_fee', 'electricity_backup', 'overtime_fee', 'vat_tax',
  'deposit_term', 'payment_term', 'air_conditioning', 'management_company',
  'location_highlights', 'price_per_sqm_min', 'price_per_sqm_max',
  'management_fee_per_sqm', 'description', 'highlights', 'amenities',
  'images', 'map_embed_url', 'directions_url', 'contact_phone',
  'contact_email', 'display_order', 'seo_metadata',
] as const;

export function toOfficeBuildingPayload(
  data: Partial<OfficeBuilding>,
  includeVersion = false,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of BUILDING_FIELDS) {
    const value = data[field as keyof OfficeBuilding];
    if (value !== undefined) payload[field] = value;
  }
  payload.building_grade = data.building_grade || data.grade || null;
  if (includeVersion && data.version) payload.expected_version = data.version;
  return payload;
}

export function toOfficeUnitPayload(data: Partial<OfficeUnit>): Record<string, unknown> {
  const availabilityValues = new Set([
    'AVAILABLE', 'UPCOMING', 'NEGOTIATING', 'RENTED', 'SUSPENDED', 'PENDING',
  ]);
  const legacyStatus = typeof data.status === 'string' ? data.status : '';
  return {
    building_id: data.building_id,
    unit_code: data.unit_code,
    floor: data.floor || '',
    area: data.area ?? data.area_sqm,
    rental_price: data.rental_price ?? data.price_per_sqm ?? 0,
    currency: data.currency || 'USD',
    price_unit: data.price_unit || 'm²/tháng',
    management_fee: data.management_fee || '',
    handover_condition: data.handover_condition || '',
    extra_fees: data.extra_fees ?? null,
    availability_status:
      data.availability_status || (availabilityValues.has(legacyStatus) ? legacyStatus : 'AVAILABLE'),
    available_from: data.available_from || '',
    notes: data.notes ?? null,
    status: legacyStatus === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE',
    display_order: data.display_order || 0,
  };
}

export const workspacesApi = {
  // ==========================================
  // PUBLIC CLIENT API
  // ==========================================
  getCoworkingPublic: (preview: boolean = false, cookieHeader?: string): Promise<CoworkingData> => {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    return apiFetch(`/workspaces/coworking${preview ? '?preview=true' : ''}`, { headers, cache: 'no-store' }, 'public');
  },

  getOfficeLandingPublic: (preview: boolean = false, cookieHeader?: string): Promise<OfficeLandingData> => {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    return apiFetch(`/workspaces/office/landing${preview ? '?preview=true' : ''}`, { headers, cache: 'no-store' }, 'public');
  },

  listOfficeBuildingsPublic: (params?: {
    district?: string;
    area_min?: number;
    area_max?: number;
    budget_min?: number;
    budget_max?: number;
    budget_band?: string;
    area_band?: string;
    grade?: string;
    availability?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<OfficeBuildingsResponse> => {
    const qs = new URLSearchParams();
    if (params?.district && params.district !== 'all') qs.set('district', params.district);
    if (params?.area_min !== undefined) qs.set('area_min', String(params.area_min));
    if (params?.area_max !== undefined) qs.set('area_max', String(params.area_max));
    if (params?.budget_min !== undefined) qs.set('budget_min', String(params.budget_min));
    if (params?.budget_max !== undefined) qs.set('budget_max', String(params.budget_max));
    if (params?.budget_band) qs.set('budget_band', params.budget_band);
    if (params?.area_band) qs.set('area_band', params.area_band);
    if (params?.grade && params.grade !== 'all') qs.set('grade', params.grade);
    if (params?.availability && params.availability !== 'all') qs.set('availability', params.availability);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));

    const query = qs.toString();
    return apiFetch(`/workspaces/office${query ? `?${query}` : ''}`, { cache: 'no-store' }, 'public');
  },

  getOfficeBuildingPublic: (
    slug: string,
    preview: boolean = false,
    cookieHeader?: string,
  ): Promise<OfficeBuilding> => {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers.Cookie = cookieHeader;
    const query = preview ? '?preview=true' : '';
    return apiFetch(
      `/workspaces/office/${encodeURIComponent(slug)}${query}`,
      { headers, cache: 'no-store' },
      'public',
    );
  },

  submitLead: (data: {
    customer_name: string;
    phone: string;
    email?: string;
    source: 'COWORKING' | 'OFFICE';
    form_id: string;
    page_url?: string;
    note?: string;
    consent?: boolean;
  }) => {
    return submitPublicLead(data);
  },

  // ==========================================
  // PROTECTED ADMIN API
  // ==========================================
  getOverview: (): Promise<WorkspacesOverviewStats> =>
    apiFetch('/website/workspaces/overview', {}, 'protected'),

  // Coworking Admin
  getCoworkingAdmin: (preview: boolean = false, cookieHeader?: string): Promise<CoworkingData> => {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    return apiFetch(`/website/workspaces/coworking?preview=${preview}`, { headers, cache: 'no-store' }, 'protected');
  },

  upsertCoworkingAdmin: (data: Partial<CoworkingData>): Promise<CoworkingData> =>
    apiFetch(
      '/website/workspaces/coworking',
      { method: 'PUT', body: JSON.stringify(data) },
      'protected',
    ),

  transitionCoworkingAdmin: (payload: {
    action: 'PUBLISH' | 'HIDE' | 'DRAFT';
    expected_version: number;
    note?: string;
  }): Promise<CoworkingData> =>
    apiFetch(
      '/website/workspaces/coworking/transition',
      { method: 'POST', body: JSON.stringify(payload) },
      'protected',
    ),

  // Seat Types Admin
  listSeatTypesAdmin: (): Promise<SeatType[]> =>
    apiFetch('/website/workspaces/coworking/seat-types', {}, 'protected'),

  createSeatTypeAdmin: (data: Partial<SeatType>): Promise<SeatType> =>
    apiFetch(
      '/website/workspaces/coworking/seat-types',
      { method: 'POST', body: JSON.stringify(data) },
      'protected',
    ),

  updateSeatTypeAdmin: (id: string, data: Partial<SeatType>): Promise<SeatType> =>
    apiFetch(
      `/website/workspaces/coworking/seat-types/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'protected',
    ),

  deleteSeatTypeAdmin: (id: string): Promise<{ success: boolean }> =>
    apiFetch(
      `/website/workspaces/coworking/seat-types/${id}`,
      { method: 'DELETE' },
      'protected',
    ),

  // Pricing Plans Admin
  listPlansAdmin: (): Promise<PricingPlan[]> =>
    apiFetch('/website/workspaces/coworking/plans', {}, 'protected'),

  createPlanAdmin: (data: Partial<PricingPlan>): Promise<PricingPlan> =>
    apiFetch(
      '/website/workspaces/coworking/plans',
      { method: 'POST', body: JSON.stringify(data) },
      'protected',
    ),

  updatePlanAdmin: (id: string, data: Partial<PricingPlan>): Promise<PricingPlan> =>
    apiFetch(
      `/website/workspaces/coworking/plans/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'protected',
    ),

  deletePlanAdmin: (id: string): Promise<{ success: boolean }> =>
    apiFetch(
      `/website/workspaces/coworking/plans/${id}`,
      { method: 'DELETE' },
      'protected',
    ),

  // Office Landing Admin
  getOfficeLandingAdmin: (preview: boolean = false, cookieHeader?: string): Promise<OfficeLandingData> => {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    return apiFetch(`/website/workspaces/office/landing?preview=${preview}`, { headers, cache: 'no-store' }, 'protected');
  },

  upsertOfficeLandingAdmin: (data: Partial<OfficeLandingData>): Promise<OfficeLandingData> =>
    apiFetch(
      '/website/workspaces/office/landing',
      { method: 'PUT', body: JSON.stringify(data) },
      'protected',
    ),

  transitionOfficeLandingAdmin: (payload: {
    action: 'PUBLISH' | 'HIDE' | 'DRAFT';
    expected_version: number;
    note?: string;
  }): Promise<OfficeLandingData> =>
    apiFetch(
      '/website/workspaces/office/landing/transition',
      { method: 'POST', body: JSON.stringify(payload) },
      'protected',
    ),

  // Office Buildings Admin
  listBuildingsAdmin: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ items: OfficeBuilding[]; total: number; page: number; limit: number }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString();
    return apiFetch(`/website/workspaces/office/buildings${query ? `?${query}` : ''}`, {}, 'protected');
  },

  createBuildingAdmin: (data: Partial<OfficeBuilding>): Promise<OfficeBuilding> =>
    apiFetch(
      '/website/workspaces/office/buildings',
      { method: 'POST', body: JSON.stringify(toOfficeBuildingPayload(data)) },
      'protected',
    ),

  getBuildingAdmin: (id: string, preview: boolean = false): Promise<OfficeBuilding> =>
    apiFetch(`/website/workspaces/office/buildings/${id}?preview=${preview}`, {}, 'protected'),

  updateBuildingAdmin: (id: string, data: Partial<OfficeBuilding>): Promise<OfficeBuilding> =>
    apiFetch(
      `/website/workspaces/office/buildings/${id}`,
      { method: 'PUT', body: JSON.stringify(toOfficeBuildingPayload(data, true)) },
      'protected',
    ),

  transitionBuildingAdmin: (
    id: string,
    action: 'PUBLISH' | 'HIDE' | 'DRAFT',
    expectedVersion: number,
  ): Promise<OfficeBuilding> =>
    apiFetch(
      `/website/workspaces/office/buildings/${id}/transition`,
      { method: 'POST', body: JSON.stringify({ action, expected_version: expectedVersion }) },
      'protected',
    ),

  deleteBuildingAdmin: (id: string): Promise<{ success: boolean }> =>
    apiFetch(
      `/website/workspaces/office/buildings/${id}`,
      { method: 'DELETE' },
      'protected',
    ),

  // Office Units Admin
  listUnitsAdmin: (buildingId: string): Promise<OfficeUnit[]> =>
    apiFetch(`/website/workspaces/office/buildings/${buildingId}/units`, {}, 'protected'),

  createUnitAdmin: (data: Partial<OfficeUnit>): Promise<OfficeUnit> =>
    apiFetch(
      '/website/workspaces/office/units',
      { method: 'POST', body: JSON.stringify(toOfficeUnitPayload(data)) },
      'protected',
    ),

  updateUnitAdmin: (id: string, data: Partial<OfficeUnit>): Promise<OfficeUnit> =>
    apiFetch(
      `/website/workspaces/office/units/${id}`,
      { method: 'PUT', body: JSON.stringify(toOfficeUnitPayload(data)) },
      'protected',
    ),

  deleteUnitAdmin: (id: string): Promise<{ success: boolean }> =>
    apiFetch(`/website/workspaces/office/units/${id}`, { method: 'DELETE' }, 'protected'),

  // FAQs Admin
  listFaqsAdmin: (entityType: string, entityId: string): Promise<WorkspaceFAQ[]> =>
    apiFetch(
      `/website/workspaces/faqs?entity_type=${entityType}&entity_id=${entityId}`,
      {},
      'protected',
    ),

  createFaqAdmin: (data: Partial<WorkspaceFAQ>): Promise<WorkspaceFAQ> =>
    apiFetch(
      '/website/workspaces/faqs',
      { method: 'POST', body: JSON.stringify(data) },
      'protected',
    ),

  updateFaqAdmin: (id: string, data: Partial<WorkspaceFAQ>): Promise<WorkspaceFAQ> =>
    apiFetch(
      `/website/workspaces/faqs/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'protected',
    ),

  deleteFaqAdmin: (id: string): Promise<{ success: boolean }> =>
    apiFetch(`/website/workspaces/faqs/${id}`, { method: 'DELETE' }, 'protected'),

  // SEO / GEO Audit Admin
  getSEOGEOAudit: (): Promise<PageSEOGEOAudit[]> =>
    apiFetch('/website/workspaces/seo-geo/audit', {}, 'protected'),

  // Unified convenience wrappers
  getCoworking: (preview: boolean = false, cookieHeader?: string): Promise<any> =>
    preview
      ? workspacesApi.getCoworkingAdmin(true, cookieHeader)
      : workspacesApi.getCoworkingPublic(false),

  getOfficeLanding: (preview: boolean = false, cookieHeader?: string): Promise<any> =>
    workspacesApi.getOfficeLandingPublic(preview, cookieHeader),

  getOfficeBuildings: (params?: any): Promise<any> =>
    workspacesApi.listOfficeBuildingsPublic(params),

  getOfficeBuildingBySlug: (
    slug: string,
    preview: boolean = false,
    cookieHeader?: string,
  ): Promise<any> => workspacesApi.getOfficeBuildingPublic(slug, preview, cookieHeader),

  getAdminCoworking: (): Promise<any> =>
    workspacesApi.getCoworkingAdmin(true),

  updateAdminCoworking: (data: any): Promise<any> => {
    const payload = data.space
      ? {
          ...data.space,
          seat_types: data.seat_types,
          pricing_plans: data.pricing_plans,
          faqs: data.faqs,
        }
      : data;
    return workspacesApi.upsertCoworkingAdmin(payload);
  },

  getAdminOfficeLanding: (): Promise<any> =>
    workspacesApi.getOfficeLandingAdmin(true).then(async (landing) => {
      const buildingsRes = await workspacesApi.listBuildingsAdmin({ limit: 100 });
      return {
        landing,
        buildings: buildingsRes.items || [],
        faqs: landing.faqs || [],
      };
    }),

  updateAdminOfficeLanding: (data: any): Promise<any> => {
    const payload = data.landing
      ? { ...data.landing, faqs: data.faqs }
      : data;
    return workspacesApi.upsertOfficeLandingAdmin(payload);
  },

  createAdminBuilding: (data: any): Promise<any> =>
    workspacesApi.createBuildingAdmin(data),

  updateAdminBuilding: (id: string, data: any): Promise<any> =>
    workspacesApi.updateBuildingAdmin(id, data),

  deleteAdminBuilding: (id: string): Promise<any> =>
    workspacesApi.deleteBuildingAdmin(id),

  getAdminUnits: (buildingId: string): Promise<any> =>
    workspacesApi.listUnitsAdmin(buildingId),

  createAdminUnit: (data: any): Promise<any> =>
    workspacesApi.createUnitAdmin(data),

  updateAdminUnit: (id: string, data: any): Promise<any> =>
    workspacesApi.updateUnitAdmin(id, data),

  deleteAdminUnit: (id: string): Promise<any> =>
    workspacesApi.deleteUnitAdmin(id),

  uploadImage: async (file: File): Promise<{ id: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload('/website/workspaces/upload', formData);
  },
};

export const workspaceApi = workspacesApi;
