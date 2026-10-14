import {describe, expect, it} from 'vitest';

import {getSafeAdminFallback, isAdminPathAllowed} from './admin-access';

describe('admin path guard', () => {
  it('does not treat the dashboard route as access to every admin module', () => {
    expect(isAdminPathAllowed(['/admin'], '/admin')).toBe(true);
    expect(isAdminPathAllowed(['/admin'], '/admin/accounts')).toBe(false);
    expect(isAdminPathAllowed(['/admin'], '/admin/projects')).toBe(false);
  });

  it('always allows the signed-in profile route', () => {
    expect(isAdminPathAllowed([], '/admin/profile')).toBe(true);
  });

  it('allows the company knowledge page through the content permission path', () => {
    expect(isAdminPathAllowed(['/admin/content'], '/admin/content/company')).toBe(true);
  });

  it('uses the website dashboard for every current website role', () => {
    expect(getSafeAdminFallback('CEO', ['/admin/activity', '/admin'])).toBe('/admin');
    expect(getSafeAdminFallback('ADMIN', ['/admin/accounts', '/admin'])).toBe('/admin');
    expect(getSafeAdminFallback('MARKETING', ['/admin/content', '/admin'])).toBe('/admin');
  });

  it('falls back to the first admin permission for an unknown role', () => {
    expect(getSafeAdminFallback('LEGACY_ROLE', ['/admin/activity'])).toBe('/admin/activity');
    expect(getSafeAdminFallback('LEGACY_ROLE', [])).toBeNull();
  });
});
