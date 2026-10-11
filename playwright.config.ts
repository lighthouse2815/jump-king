import { defineConfig, devices } from '@playwright/test';

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
  ],
});
