import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A shared two-core runner can take longer than five seconds to paint the
  // "saved" state after an IndexedDB write, and several mocked CBT tests assert
  // exactly that. The wider expectation budget and one retry keep the gate
  // about behaviour instead of runner speed; a deterministic failure still
  // fails twice.
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  workers: process.env.CI ? 2 : 4,
  // `github` turns each failed test into an annotation, so a red gate names the
  // test and assertion without needing the (often truncated) job log.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        }
      : {},
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
    env: {
      PORT: '3100',
      NETLIFY: '',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '',
      VITE_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_SECRET_KEY: '',
    },
  },
});
