import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_STATE = path.join(__dirname, 'fixtures', 'auth-state.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // serial — tests share seeded DB state
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: AUTH_STATE,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
