import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';
import { toOfficeBuildingPayload, toOfficeUnitPayload, workspaceApi } from './api';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  apiUpload: vi.fn(),
}));

describe('workspaceApi Coworking preview contract', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it('uses the public endpoint for the published page', async () => {
    await workspaceApi.getCoworking(false);

    expect(apiFetch).toHaveBeenCalledWith(
      '/workspaces/coworking',
      { headers: {}, cache: 'no-store' },
      'public',
    );
  });

  it('uses the permission-protected endpoint and forwards cookies for preview', async () => {
    await workspaceApi.getCoworking(true, 'access_token=preview-token');

    expect(apiFetch).toHaveBeenCalledWith(
      '/website/workspaces/coworking?preview=true',
      {
        headers: { Cookie: 'access_token=preview-token' },
        cache: 'no-store',
      },
      'protected',
    );
  });
});

describe('workspaceApi Office contract', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it('forwards authenticated cookies for building preview', async () => {
    await workspaceApi.getOfficeBuildingBySlug(
      'maian-tower',
      true,
      'access_token=preview-token',
    );

    expect(apiFetch).toHaveBeenCalledWith(
      '/workspaces/office/maian-tower?preview=true',
      {
        headers: { Cookie: 'access_token=preview-token' },
        cache: 'no-store',
      },
      'public',
    );
  });

  it('maps building aliases and strips server-owned fields', () => {
    const payload = toOfficeBuildingPayload({
      id: 'building-id',
      name: 'Maian Tower',
      slug: 'maian-tower',
      grade: 'A',
      status: 'PUBLISHED',
      version: 4,
      total_floors: 12,
      price_per_sqm_min: 20,
    }, true);

    expect(payload).toMatchObject({
      name: 'Maian Tower',
      slug: 'maian-tower',
      building_grade: 'A',
      total_floors: 12,
      price_per_sqm_min: 20,
      expected_version: 4,
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('status');
  });

  it('maps unit form fields to the backend contract', () => {
    expect(toOfficeUnitPayload({
      building_id: 'building-id',
      unit_code: 'L08-01',
      floor: '8',
      area_sqm: 120,
      price_per_sqm: 25,
      status: 'AVAILABLE',
    })).toMatchObject({
      area: 120,
      rental_price: 25,
      availability_status: 'AVAILABLE',
      status: 'ACTIVE',
    });
  });

  it('sends the current version when publishing a building', async () => {
    await workspaceApi.transitionBuildingAdmin('building-id', 'PUBLISH', 7);

    expect(apiFetch).toHaveBeenCalledWith(
      '/website/workspaces/office/buildings/building-id/transition',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'PUBLISH', expected_version: 7 }),
      },
      'protected',
    );
  });
});
