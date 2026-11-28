import { defineConfig, devices } from '@playwright/test';

import { ENV } from './support/env';

// A dead proxy with a loopback bypass: even a request that slips past routing cannot leave.
const proxy = { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' };
const viewport = { width: 1280, height: 800 };

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/screenshots/{projectName}/{arg}{ext}',
  // A missing screenshot is a failure. `pnpm test:e2e:update` records it (see README).
  updateSnapshots: 'none',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // Measured on Docker with 8 CPUs and 8 GB (see README). E2E_WORKERS overrides it.
  workers: Number(process.env.E2E_WORKERS || 6),
  timeout: 90_000,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.E2E_REPORT ?? './test-results/report.json' }],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],
  expect: {
    timeout: 8000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 20 },
  },
  use: {
    baseURL: ENV.baseURL,
    proxy,
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport,
        // System font fallback is asynchronous by default, so a glyph only a fallback font has
        // (the slash menu's ⮐) was found or not depending on timing. Synchronous, it always is.
        launchOptions: { firefoxUserPrefs: { 'gfx.font_rendering.fallback.async': false } },
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport, deviceScaleFactor: 1 },
    },
  ],
});
