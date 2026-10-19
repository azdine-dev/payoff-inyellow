import { defineConfig, devices } from '@playwright/test';
import { TEST_PUBLIC_KEY } from './e2e/testKey';

// Every test server gets the test public key, so unlock codes made with the test key are valid
// there and the real private key is never needed.
const env = { VITE_PUBLIC_KEY_HEX: TEST_PUBLIC_KEY };
// The sync server runs on this computer (the real Worker code on a node:sqlite database)
const SYNC_PORT = 8788;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    actionTimeout: 15_000, // a wrong selector fails in 15 seconds, it never waits forever
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://localhost:5174',
  },
  webServer: [
    { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, env: { ...env, VITE_SYNC_URL: `http://localhost:${SYNC_PORT}` } },
    {
      command: 'npx vite-node worker/dev/server.ts',
      url: `http://localhost:${SYNC_PORT}/health`,
      reuseExistingServer: false,
      env: { PORT: String(SYNC_PORT), PIY_PUBLIC_KEY: TEST_PUBLIC_KEY, ALLOWED_ORIGINS: 'http://localhost:5174' },
    },
    // The free calculator build, with an email endpoint (the tests intercept it)
    {
      command: 'npx vite --mode free --port 5176 --strictPort',
      url: 'http://localhost:5176',
      reuseExistingServer: false,
      env: { ...env, VITE_EMAIL_CAPTURE_URL: 'https://leads.example.test/capture' },
    },
    // The app with its own public key (no test key): for codes made by scripts/make-code.js
    { command: 'npx vite --port 5177 --strictPort', url: 'http://localhost:5177', reuseExistingServer: false },
    // The real build, for the offline test
    {
      command: 'npx vite build && npx vite preview --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: false,
      timeout: 120_000,
      env,
    },
  ],
});
