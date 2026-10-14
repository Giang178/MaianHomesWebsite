import {expect, test, type Page} from '@playwright/test';

const adminProfile = {
  id: 'website-admin',
  email: 'admin@example.com',
  name: 'Website Admin',
  role: 'ADMIN',
  permissions: ['*'],
  allowed_paths: ['/admin', '/admin/content', '/admin/projects', '/admin/articles', '/admin/leads'],
};

async function prepareWebsiteAdmin(page: Page) {
  await page.context().addCookies([{name: 'maian_logged_in', value: '1', domain: '127.0.0.1', path: '/'}]);
  await page.routeWebSocket('**/api/ws/notifications', () => {});
  await page.addInitScript((profile) => {
    localStorage.setItem('maian_user', JSON.stringify(profile));
  }, adminProfile);
  await page.route('**/api/public/auth/verify', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({user: adminProfile}),
  }));
  await page.route('**/api/protected/website/dashboard/overview', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      pages: {total: 10, by_status: {PUBLISHED: 8, DRAFT: 2}},
      projects: {total: 0, published: 0},
      articles: {total: 0, published: 0},
      leads: {total: 0, new: 0},
    }),
  }));
  await page.route('**/api/protected/notifications**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
}

test('website administrator can open the unified dashboard', async ({page}) => {
  await prepareWebsiteAdmin(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/admin');

  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await expect(page.getByRole('heading', {level: 3, name: /CMS/})).toBeVisible();
  await expect(page.getByRole('heading', {level: 3, name: /B.t/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('retired department workspaces are not part of the release', async ({page}) => {
  for (const route of ['/admin/sales', '/admin/hr', '/admin/it']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});
