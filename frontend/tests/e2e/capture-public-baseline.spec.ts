import path from 'node:path';
import {expect, test} from '@playwright/test';

const enabled = process.env.CAPTURE_PUBLIC_BASELINE === '1';
const outputRoot = process.env.PUBLIC_BASELINE_OUTPUT;

const publicPages = [
  ['home', '/'],
  ['about', '/gioi-thieu'],
  ['team', '/doi-ngu'],
  ['projects', '/du_an'],
  ['news', '/tin_tuc'],
  ['jobs', '/tuyen-dung'],
  ['consignment', '/ky-gui'],
  ['contact', '/lien-he'],
  ['privacy', '/chinh-sach-bao-mat'],
  ['sitemap', '/so-do-trang-web'],
] as const;

test.describe('public UI release baseline', () => {
  test.skip(!enabled || !outputRoot, 'Run through scripts/deployment/capture-baseline.ps1');

  for (const [name, route] of publicPages) {
    test(`${name} has no browser errors and can be captured`, async ({page}, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(route, {waitUntil: 'networkidle'});
      expect(response?.ok()).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({
        path: path.join(outputRoot!, testInfo.project.name, `${name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
