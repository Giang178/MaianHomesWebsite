import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('admin permission visibility contract', () => {
  it('makes website page editing and publishing depend on explicit permissions', () => {
    const page = source('src/features/content/admin/ContentAdminPage.tsx');

    expect(page).toContain("permissions.has('website.pages.update')");
    expect(page).toContain("permissions.has('website.pages.publish')");
    expect(page).toContain('Chế độ chỉ xem');
    expect(page).toContain('{canUpdate && <button');
    expect(page).toContain('{canPublishPermission && <button');
  });

  it('does not infer company publishing rights from a role name', () => {
    const panel = source('src/features/content/company/CompanyKnowledgePanel.tsx');

    expect(panel).not.toContain("['ADMIN', 'CEO', 'MARKETING'");
    expect(panel).toContain("permissions.has('website.pages.publish')");
  });
  it('gates sensitive admin actions by their specific permissions', () => {
    const branding = source('src/app/(admin)/admin/branding/page.tsx');
    const leads = source('src/features/inquiries/admin/LeadAdminPage.tsx');
    const monitoring = source('src/features/system/monitoring/MonitoringPanel.tsx');
    const email = source('src/features/website/admin/system/CompanyEmailPanel.tsx');
    const workspaces = source('src/features/workspaces/admin/WorkspaceAdminHub.tsx');

    expect(branding).toContain("can('website.branding.update')");
    expect(branding).toContain("can('website.branding.publish')");
    expect(leads).toContain("can('website.leads.export')");
    expect(leads).toContain("can('website.leads.update')");
    expect(monitoring).toContain("can('website.system.monitoring.run')");
    expect(email).toContain("can('website.system.email.update')");
    expect(email).toContain("can('website.system.email.test')");
    expect(workspaces).toContain("canAny('website.workspaces.update'");
  });
});