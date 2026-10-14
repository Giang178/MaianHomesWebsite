import {expect, test} from '@playwright/test';

const owner = {
  id: 'owner-account',
  email: 'owner@example.com',
  name: 'Website Owner',
  role: 'CEO',
  permissions: ['*'],
  allowed_paths: ['/admin', '/admin/system'],
};

test.beforeEach(async ({page}) => {
  await page.context().addCookies([{name: 'maian_logged_in', value: '1', domain: '127.0.0.1', path: '/'}]);
  await page.routeWebSocket('**/api/ws/notifications', () => {});
  await page.addInitScript((profile) => {
    localStorage.setItem('maian_user', JSON.stringify(profile));
  }, owner);
  await page.route('**/api/public/auth/verify', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({user: owner}),
  }));
  await page.route('**/api/protected/website/system/monitoring/summary', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'health-1',
      status: 'HEALTHY',
      generated_at: '2026-10-02T00:00:00Z',
      checks: [],
    }),
  }));
  await page.route('**/api/protected/website/system/monitoring/timeseries**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({items: []}),
  }));
  await page.route('**/api/protected/website/system/email', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      host: 'smtp.gmail.com',
      port: 587,
      username: 'owner@example.com',
      from_name: 'Maian Homes',
      from_email: 'owner@example.com',
      start_tls: true,
      password_configured: true,
      verified_at: null,
      version: 1,
    }),
  }));
  await page.route('**/api/protected/notifications**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
});

test('owner can open website monitoring without browser errors', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/admin/system');

  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await expect(page.locator('input[value="smtp.gmail.com"]')).toBeVisible();
  await expect(page.getByRole('heading', {level: 2, name: /SMTP/})).toBeVisible();
  expect(errors).toEqual([]);
});
