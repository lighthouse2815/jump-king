import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

// Each local run uses a temporary code; production credentials stay outside Git.
if (!process.env.E2E_BASE_URL)
  process.env.E2E_CHEAT_CODE ||= randomBytes(12).toString('hex');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'pnpm build && pnpm start',
          env: { ONLINE_CHEAT_CODE: process.env.E2E_CHEAT_CODE || '' },
          url: 'http://localhost:2567/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter web dev --host 127.0.0.1',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
        },
      ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.E2E_CROSS_BROWSER === '1'
      ? [
          {
            name: 'msedge',
            use: { ...devices['Desktop Edge'], channel: 'msedge' },
          },
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : []),
  ],
});
