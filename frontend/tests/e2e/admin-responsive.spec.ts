import {expect, test, type Page} from '@playwright/test';

const ceoProfile = {
  id: 'responsive-ceo',
  email: 'ceo@example.com',
  name: 'CEO Maian Homes',
  role: 'CEO',
  allowed_paths: ['/admin', '/admin/projects', '/admin/articles', '/admin/content'],
};

async function prepareSession(page: Page) {
  await page.addInitScript(profile => localStorage.setItem('maian_user', JSON.stringify(profile)), ceoProfile);
  await page.route('**/api/public/auth/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({user: ceoProfile}),
  }));
  await page.route('**/api/protected/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/website/dashboard/overview')
      ? {
          pages: {total: 10, by_status: {PUBLISHED: 8, DRAFT: 2}},
          projects: {total: 0, published: 0},
          articles: {total: 0, published: 0},
          leads: {total: 0, new: 0},
        }
      : [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test('admin shell keeps readable typography without page overflow', async ({page}) => {
  await prepareSession(page);
  await page.goto('/admin');

  const heading = page.getByRole('heading', {level: 1}).first();
  await expect(heading).toBeVisible();
  const headingSize = await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(headingSize).toBeGreaterThanOrEqual(24);

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    fontFamily: getComputedStyle(document.body).fontFamily,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.fontFamily.toLowerCase()).not.toContain('montserrat');
  if ((page.viewportSize()?.width || 0) >= 1024) {
    const firstNavigationItem = page.locator('aside nav a').first();
    await expect(firstNavigationItem).toBeVisible();
    const navigationFontSize = await firstNavigationItem.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(navigationFontSize).toBeGreaterThanOrEqual((page.viewportSize()?.width || 0) >= 1440 ? 13 : 12);
  }

  if ((page.viewportSize()?.width || 0) < 1024) {
    const menu = page.getByRole('button', {name: 'Menu'});
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('complementary').locator('a[href="/admin/projects"]')).toBeVisible();
  }
});

test('authentication fields remain legible on touch viewports', async ({page}) => {
  await page.goto('/login');
  const email = page.locator('input[type="email"]');
  await expect(email).toBeVisible();
  if ((page.viewportSize()?.width || 0) < 640) {
    const inputSize = await email.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(inputSize).toBeGreaterThanOrEqual(16);
  }
});
