import { expect, test, type Page } from '@playwright/test';


const marketingManager = {
  id: 'marketing-manager',
  employee_id: 'marketing-manager',
  email: 'manager@example.com',
  name: 'Marketing Manager',
  role: 'MARKETING',
  allowed_paths: ['/admin', '/admin/articles'],
  permissions: ['website.dashboard.read', 'website.articles.read', 'website.articles.create', 'website.articles.update'],
};

async function prepareMarketingSession(page: Page) {
  await page.addInitScript(profile => {
    localStorage.setItem('maian_user', JSON.stringify(profile));
  }, marketingManager);
  await page.route('**/api/public/auth/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: marketingManager }),
  }));
  await page.route('**/api/protected/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST' && url.pathname.endsWith('/articles/drafts')) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '66b700000000000000000001',
          version: 1,
          is_provisional: true,
          autosave_status: 'saved',
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/articles/my') || url.pathname.endsWith('/articles/review-inbox')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test('Marketing editor remains usable and WYSIWYG at every configured viewport', async ({ page }) => {
  test.setTimeout(60_000);
  await prepareMarketingSession(page);
  await page.goto('/admin/articles', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Viết Bài Mới/i }).first().click();

  const shell = page.locator('.article-editor-shell');
  await expect(shell).toBeVisible({ timeout: 15_000 });
  const shellBox = await shell.boundingBox();
  const viewport = page.viewportSize();
  expect(shellBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(shellBox?.x || 0)).toBeLessThanOrEqual(1);
  expect(Math.abs(shellBox?.y || 0)).toBeLessThanOrEqual(1);
  expect(shellBox?.width || 0).toBeGreaterThanOrEqual((viewport?.width || 0) - 1);
  expect(shellBox?.height || 0).toBeGreaterThanOrEqual((viewport?.height || 0) - 1);

  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible({ timeout: 15_000 });

  const h2 = page.getByRole('button', { name: 'Tiêu đề cấp H2' });
  await expect(h2).toBeVisible();
  const h2Box = await h2.boundingBox();
  expect(h2Box?.height || 0).toBeGreaterThanOrEqual(44);

  await editor.click();
  await editor.fill('Tổng quan thị trường');
  await h2.click();
  await expect(editor.locator('h2')).toHaveText('Tổng quan thị trường');

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
});
