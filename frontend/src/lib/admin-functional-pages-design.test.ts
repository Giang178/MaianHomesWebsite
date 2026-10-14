import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('admin functional page design contract', () => {
  it('provides contextual frames for every functional route group', () => {
    const layout = source('src/app/(admin)/AdminClientLayout.tsx');

    for (const route of [
      '/admin/accounts',
      '/admin/content',
      '/admin/projects',
      '/admin/articles',
      '/admin/branding',
      '/admin/team',
      '/admin/recruitment',
      '/admin/workspaces',
      '/admin/leads',
      '/admin/analytics',
      '/admin/activity',
      '/admin/system',
      '/admin/profile',
    ]) {
      expect(layout).toContain(`['${route}'`);
    }

    expect(layout).toContain('admin-route-frame');
    expect(layout).toContain('ADMIN_QUICK_LINKS');
    expect(layout).toContain('admin-route-frame__signal');
    expect(layout).toContain('admin-route-frame__nav');
    expect(layout).toContain('aria-current={isCurrent');
    expect(layout).toContain('isAdminPathAllowed(user?.allowed_paths');
    expect(layout).toContain('admin-route-body--framed');
    expect(layout).toContain('data-admin-section={pageContext?.tone');
  });

  it('applies the cockpit visual system to page internals and responsive breakpoints', () => {
    const styles = source('src/app/(admin)/admin.css');

    expect(styles).toContain('Dashboard cockpit V3');
    expect(styles).toContain('.admin-route-frame__signal');
    expect(styles).toContain(".admin-route-frame__nav a[aria-current='page']");
    expect(styles).toContain('.admin-module-page table thead');
    expect(styles).toContain(".admin-module-page input:not([type='checkbox'])");
    expect(styles).toContain('@media (min-width: 1024px) and (max-width: 1279px)');
    expect(styles).toContain('@media (min-width: 1920px)');
  });

  it('wires every major functional workspace to the shared module system', () => {
    const pages: Array<[string, string]> = [
      ['src/app/(admin)/admin/accounts/page.tsx', 'admin-module-page--accounts'],
      ['src/app/(admin)/admin/analytics/page.tsx', 'admin-module-page--analytics'],
      ['src/app/(admin)/admin/branding/page.tsx', 'admin-module-page--branding'],
      ['src/features/content/admin/ContentAdminPage.tsx', 'admin-module-page--content'],
      ['src/features/inquiries/admin/LeadAdminPage.tsx', 'admin-module-page--leads'],
      ['src/app/(admin)/admin/profile/page.tsx', 'admin-module-page--profile'],
      ['src/features/recruitment/admin/RecruitmentAdminPage.tsx', 'admin-module-page--recruitment'],
      ['src/app/(admin)/admin/system/page.tsx', 'admin-module-page--system'],
      ['src/features/team/admin/TeamAdminPage.tsx', 'admin-module-page--team'],
      ['src/features/content/ContentWorkspace.tsx', 'admin-module-page--projects'],
      ['src/features/content/articles/NewsWorkspace.tsx', 'admin-module-page--articles'],
      ['src/features/content/company/CompanyKnowledgePanel.tsx', 'admin-module-page--company'],
      ['src/features/system/activity/ActivityPanel.tsx', 'admin-module-page--activity'],
      ['src/features/workspaces/admin/WorkspaceAdminHub.tsx', 'admin-module-page--workspaces'],
    ];

    for (const [file, className] of pages) {
      expect(source(file)).toContain(className);
    }
  });
});
