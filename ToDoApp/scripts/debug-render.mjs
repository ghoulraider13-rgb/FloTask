/**
 * Debug: load the app at 390px and dump what actually rendered.
 * Answers: is MobileShell mounted? Is the tab bar in the DOM?
 * Any React error overlay?
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199/';
const browser = await chromium.launch({
  executablePath: '/home/ash/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Primary"]');
  const shell = document.querySelector('.h-\\[100dvh\\]');
  const bodyChildren = [...document.body.children].map((c) => `<${c.tagName.toLowerCase()} id="${c.id}" class="${(c.className + '').slice(0, 80)}">`);
  return {
    title: document.title,
    hasNav: !!nav,
    navButtons: nav ? [...nav.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
    hasShell: !!shell,
    bodyChildren,
    matchMedia: matchMedia('(max-width: 640px)').matches,
    innerWidth: innerWidth,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('console errors:', errors.length ? errors : 'none');

await page.screenshot({ path: '/tmp/debug-390.png' });
await browser.close();
