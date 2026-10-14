import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) => fs.readFileSync(
  fileURLToPath(new URL(relativePath, import.meta.url)),
  'utf8',
);

describe('public route scaling contract', () => {
  it.each([
    ['homepage', '../app/(client)/page.tsx'],
    ['projects', '../app/(client)/du_an/page.tsx'],
    ['news', '../app/(client)/tin_tuc/page.tsx'],
    ['recruitment', '../app/(client)/tuyen-dung/page.tsx'],
    ['HTML sitemap', '../app/(client)/so-do-trang-web/page.tsx'],
  ])('%s defers build-time API access but shares successful backend reads', (_name, path) => {
    const contents = source(path);
    expect(contents).not.toContain("export const dynamic = 'force-dynamic'");
    expect(contents).not.toContain("cache: 'no-store'");
    expect(contents).toContain('await connection();');
    expect(contents).toContain("cache: 'force-cache'");
    expect(contents).toMatch(/next:\s*\{\s*revalidate:\s*\d+/);
  });

  it.each([
    ['project', '../app/(client)/du_an/[slug]/page.tsx', '../app/(client)/du_an/[slug]/page.tsx'],
    ['article', '../app/(client)/tin_tuc/[slug]/page.tsx', '../app/(client)/tin_tuc/[slug]/page.tsx'],
    ['job', '../app/(client)/tuyen-dung/[slug]/page.tsx', '../app/(client)/tuyen-dung/[slug]/page.tsx'],
    ['team profile', '../app/(client)/doi-ngu/[slug]/page.tsx', '../features/team/api.ts'],
  ])('%s detail uses first-request ISR without build-time API access', (_name, path, dataPath) => {
    const contents = source(path);
    const dataContents = source(dataPath);
    expect(contents).not.toContain("export const dynamic = 'force-dynamic'");
    expect(contents).toMatch(/export const revalidate = \d+;/);
    expect(contents).toMatch(/generateStaticParams[\s\S]*?return \[\];/);
    expect(dataContents).toContain("cache: 'force-cache'");
  });

  it('does not cache an article or job outage as a successful ISR page', () => {
    const article = source('../app/(client)/tin_tuc/[slug]/page.tsx');
    const job = source('../app/(client)/tuyen-dung/[slug]/page.tsx');
    expect(article).toContain('throw articleUnavailable(result)');
    expect(job).toContain('throw jobUnavailable(result)');
    expect(article).not.toContain('<PublicDataUnavailable');
    expect(job).not.toContain('<PublicDataUnavailable');
  });

  it('serves the two large homepage backgrounds through responsive Next images', () => {
    const homepage = source('../app/(client)/page.tsx');
    const contact = source('../components/home/ContactFormSection.tsx');
    expect(homepage).toMatch(/src=\{heroImage\}|src="\/images\/banner_sec1\.png"/);
    expect(homepage).toContain("'/images/banner_sec1.png'");
    expect(homepage).toContain('sizes="100vw"');
    expect(homepage).toContain('preload');
    expect(homepage).not.toMatch(/backgroundImage:[^\n]*banner_sec1\.png/);
    expect(contact).toContain("backgroundImage = '/images/banner_sec.png'");
    expect(contact).toContain('src={backgroundImage}');
    expect(contact).toContain('sizes="100vw"');
    expect(contact).not.toMatch(/backgroundImage:[^\n]*banner_sec\.png/);
  });

  it('uses bounded summary payloads for public collection pages', () => {
    for (const path of [
      '../app/(client)/page.tsx',
      '../app/(client)/du_an/page.tsx',
      '../app/(client)/tuyen-dung/page.tsx',
      '../app/(client)/so-do-trang-web/page.tsx',
      '../app/sitemap.ts',
    ]) {
      expect(source(path)).toContain('view=summary');
    }
    const contentApi = source('../features/content/api.ts');
    expect(contentApi).toContain("query.set('view', 'summary')");
    expect(contentApi).not.toContain("headers: { 'Cache-Control': 'no-cache' }");
  });

  it('keeps the XML sitemap runtime-first while caching upstream reads', () => {
    const sitemap = source('../app/sitemap.ts');
    expect(sitemap).not.toContain("export const dynamic = 'force-dynamic'");
    expect(sitemap).toContain('await connection();');
    expect(sitemap).toContain("cache: 'force-cache'");
  });

  it('exposes a stable marker when public data is unavailable', () => {
    expect(source('../components/system/PublicDataUnavailable.tsx'))
      .toContain('data-public-data-status="unavailable"');
    expect(source('../features/projects/ProjectsSection.tsx'))
      .toContain('data-public-data-status="unavailable"');
  });
});
