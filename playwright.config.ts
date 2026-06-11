import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.PORT ?? '5000';
const e2eBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${e2ePort}`;
const e2eRateLimitMax = process.env.RATE_LIMIT_MAX ?? '5000';
const parsedE2ePort = Number.parseInt(e2ePort, 10);
const e2eHmrPort =
  process.env.VITE_HMR_PORT ??
  (Number.isFinite(parsedE2ePort) ? String(parsedE2ePort + 20_000) : '25110');
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '0' ? false : true;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  reportSlowTests: {
    max: 5,
    threshold: 12 * 60 * 1000,
  },
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `PLAYWRIGHT=1 PORT=${e2ePort} VITE_HMR_PORT=${e2eHmrPort} RATE_LIMIT_MAX=${e2eRateLimitMax} npm run dev`,
    url: e2eBaseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
});
