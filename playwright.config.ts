import { defineConfig, devices } from '@playwright/test';
import { TEST_PUBLIC_KEY } from './e2e/testKey';

// Every test server gets the test public key, so unlock codes made with the test key are valid
// there and the real private key is never needed.
const env = { VITE_PUBLIC_KEY_HEX: TEST_PUBLIC_KEY };

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://localhost:5174',
  },
  webServer: [
    { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, env },
    // The free calculator build, with an email endpoint (the tests intercept it)
    {
      command: 'npx vite --mode free --port 5176 --strictPort',
      url: 'http://localhost:5176',
      reuseExistingServer: false,
      env: { ...env, VITE_EMAIL_CAPTURE_URL: 'https://leads.example.test/capture' },
    },
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
