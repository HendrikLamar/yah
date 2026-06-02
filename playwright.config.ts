import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:5187', headless: true },
  webServer: {
    command: 'npm run dev -- -p 5187',
    url: 'http://localhost:5187/login',
    // Reuse a dev server already running on 5187 (the project's dev port, chosen
    // to dodge the Docker-held 3000/3100). In CI there's none, so start one.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
