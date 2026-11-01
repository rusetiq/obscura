import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1050 },
    trace: 'retain-on-failure',
  },
})
