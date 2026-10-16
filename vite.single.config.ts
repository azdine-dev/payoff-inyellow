// One HTML file with everything inside (fonts, code, styles). For people who don't trust websites.
// Build: npm run build:single  ->  dist-single/index.html
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  resolve: {
    // No service worker inside a single file
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwaStub.ts', import.meta.url)) },
  },
  build: { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
