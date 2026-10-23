/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const FREE_TITLE = 'Credit Card Payoff Calculator · PaidInYellow';
const FREE_DESCRIPTION =
  'Free credit card payoff calculator. Find your debt-free date in 15 minutes and see exactly what to pay each payday. No account, no bank login.';

/** The free calculator build (vite --mode free) gets its own page title and description for search. */
function editionHtml(free: boolean): Plugin {
  return {
    name: 'piy-edition-html',
    transformIndexHtml(html) {
      if (!free) return html;
      return html
        .replace(/<title>.*?<\/title>/, `<title>${FREE_TITLE}</title>`)
        .replace(/(<meta name="description" content=")[^"]*/, `$1${FREE_DESCRIPTION}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const free = mode === 'free';
  return {
    plugins: [
      preact(),
      editionHtml(free),
      VitePWA({
        // The buyer decides when to restart into a new version (Settings), so nothing reloads mid-payday
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: free ? 'PaidInYellow · Credit Card Payoff Calculator' : 'PaidInYellow · Paycheck Payoff Planner',
          short_name: 'PaidInYellow',
          description: free
            ? FREE_DESCRIPTION
            : 'Your debt-free date, and a clear amount to pay every payday. Your numbers never leave this device.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F4F0E6',
          theme_color: '#F4F0E6',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,webmanifest}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: { port: 5173, host: true },
    test: {
      include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
      environment: 'node',
    },
  };
});
