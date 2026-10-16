// Makes the app icons from brand/icon-paystub.png (1024 px). Run: node tools/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const src = 'data:image/png;base64,' + readFileSync('brand/icon-paystub.png').toString('base64');
const PAPER = '#F4F0E6';
const jobs = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0, bg: null },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0, bg: null },
  { file: 'public/icons/apple-touch-icon.png', size: 180, pad: 0, bg: PAPER }, // iPhone fills the corners itself
  { file: 'public/icons/maskable-512.png', size: 512, pad: 0.16, bg: PAPER }, // safe zone for round masks
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const inner = Math.round(j.size * (1 - j.pad * 2));
  await page.setContent(
    `<body style="margin:0;background:${j.bg ?? 'transparent'};display:grid;place-items:center;width:${j.size}px;height:${j.size}px">` +
      `<img src="${src}" width="${inner}" height="${inner}"></body>`,
  );
  await page.screenshot({ path: j.file, omitBackground: j.bg === null });
  console.log('wrote', j.file);
}
await browser.close();
