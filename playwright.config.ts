import { defineConfig, devices } from '@playwright/test';

// Closes audit gap #14 (docs/09-project-audit.md): Playwright was locked into the stack
// (prd-intern-docflow.md §10) but never actually installed. This config runs its own
// isolated `next dev` server (a fresh port, its own process) rather than assuming one is
// already running, so it's reproducible in CI and on any machine.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
