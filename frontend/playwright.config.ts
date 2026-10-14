import {defineConfig, devices} from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:3100';
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {timeout: 15_000},
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'large-pc',
      use: {...devices['Desktop Chrome'], viewport: {width: 1920, height: 1080}, ...(browserChannel ? {channel: browserChannel} : {})},
    },
    {
      name: 'laptop',
      use: {...devices['Desktop Chrome'], viewport: {width: 1366, height: 768}, ...(browserChannel ? {channel: browserChannel} : {})},
    },
    {
      name: 'tablet',
      use: {...devices['Desktop Chrome'], viewport: {width: 768, height: 1024}, hasTouch: true, ...(browserChannel ? {channel: browserChannel} : {})},
    },
    {
      name: 'mobile',
      use: {...devices['Desktop Chrome'], viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, ...(browserChannel ? {channel: browserChannel} : {})},
    },
    {
      name: 'mobile-small',
      use: {...devices['Desktop Chrome'], viewport: {width: 360, height: 800}, hasTouch: true, isMobile: true, ...(browserChannel ? {channel: browserChannel} : {})},
    },
  ],
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
