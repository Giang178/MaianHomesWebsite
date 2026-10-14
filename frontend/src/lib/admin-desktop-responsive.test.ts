import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('admin desktop responsive contract', () => {
  it('uses distinct sidebar widths for laptop, desktop and large screens', () => {
    const sidebar = source('src/components/layout/AdminSidebar.tsx');
    const layout = source('src/app/(admin)/AdminClientLayout.tsx');

    expect(sidebar).toContain('lg:w-[244px] xl:w-[260px] 2xl:w-[280px]');
    expect(layout).toContain('lg:ml-[244px] xl:ml-[260px] 2xl:ml-[280px]');
  });

  it('defines explicit laptop and large-PC workspace breakpoints', () => {
    const css = source('src/app/(admin)/admin.css');

    expect(css).toContain('@media (min-width: 1024px) and (max-width: 1279px)');
    expect(css).toContain('@media (min-width: 1920px)');
    expect(css).toContain('--admin-content-max: 1880px');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
  });

  it('shows the current workspace name in the desktop header', () => {
    const layout = source('src/app/(admin)/AdminClientLayout.tsx');

    expect(layout).toContain('ADMIN_PAGE_TITLES');
    expect(layout).toContain('admin-header-title truncate">{pageTitle}');
  });

  it('keeps the unified admin console visual system wired to the shared shell', () => {
    const css = source('src/app/(admin)/admin.css');
    const sidebar = source('src/components/layout/AdminSidebar.tsx');
    const layout = source('src/app/(admin)/AdminClientLayout.tsx');

    expect(css).toContain('Admin Console 2.0');
    expect(css).toContain('--admin-accent: #b77945');
    expect(sidebar).toContain('admin-sidebar-link--active');
    expect(sidebar).toContain('admin-sidebar-brand-copy');
    expect(layout).toContain('admin-system-status hidden xl:flex');
  });
});
