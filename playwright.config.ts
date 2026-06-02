import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:5187', headless: true },
  webServer: {
    command: 'npm run dev -- -p 5187',
    url: 'http://localhost:5187/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
