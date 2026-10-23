import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    } : {},
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /perf\.spec\.ts/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testIgnore: /perf\.spec\.ts/ },
    // The throttled performance profile is measured on its own (`npm run e2e:perf`,
    // which pins one worker). Running it beside the functional suite measured the
    // runner rather than the page: the same landing route reported 1.7 s alone and
    // 3.5 s while other 4×-throttled pages competed for the cores.
    { name: 'mobile-perf', use: { ...devices['Pixel 7'] }, testMatch: /perf\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    env: { PORT: '3100', NETLIFY: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '' },
  },
});
