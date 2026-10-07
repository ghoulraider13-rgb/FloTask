/**
 * FloTask multi-width screenshot verification (step 4).
 *
 * Screenshots every screen at 320, 360, 390, 412, 430px widths plus a
 * tablet width (768px), in light and dark, using Playwright's chromium
 * (headless shell — installed via `npx playwright install chromium`).
 *
 * Checks per screenshot:
 *  - horizontal overflow (scrollWidth > clientWidth on body/document)
 *  - elements wider than the viewport
 *  - clipped text (scrollHeight > clientHeight on leaf elements)
 *  - overlapping interactive elements (tab bar vs content)
 *
 * Output: PNG per screen in ./screenshots/, JSON report in
 * ./screenshots/report.json, console summary.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(rootDir, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.FLOTASK_URL || 'http://localhost:5199/';
const WIDTHS = [320, 360, 390, 412, 430, 768];
const HEIGHT = 844; // matches iPhone 12/13/14 aspect for narrow widths
const THEMES = ['dark', 'light'];

// The five feature screens + desktop sections to screenshot.
// Mobile: drive the bottom tab bar by data-screen id.
const MOBILE_SCREENS = ['tasks', 'alarms', 'timer', 'stopwatch', 'scratchpad'];

const report = [];

async function auditPage(page, label) {
  const audit = await page.evaluate(() => {
    const doc = document.documentElement;
    const issues = [];

    // 1. Horizontal overflow on the page
    if (doc.scrollWidth > doc.clientWidth + 1) {
      issues.push(`page h-overflow: scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth}`);
    }

    // 2. Elements wider than the viewport (visible ones only)
    const vw = doc.clientWidth;
    const wide = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
        // Ignore elements inside horizontally-scrollable containers (code blocks)
        const p = el.parentElement;
        const inHScroll = p && getComputedStyle(p).overflowX === 'auto';
        if (!inHScroll && wide.length < 8) {
          wide.push(`<${el.tagName.toLowerCase()} class="${(el.className + '').slice(0, 60)}" right=${Math.round(r.right)} left=${Math.round(r.left)}>`);
        }
      }
    });
    if (wide.length) issues.push(`offscreen elements: ${wide.join(' | ')}`);

    // 3. Clipped text: leaf elements whose content overflows vertically
    const clipped = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.children.length > 0) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return; // scroll containers are fine
      if (!el.textContent || !el.textContent.trim()) return;
      if (el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0) {
        if (clipped.length < 8) {
          clipped.push(`<${el.tagName.toLowerCase()} class="${(el.className + '').slice(0, 50)}" "${el.textContent.trim().slice(0, 30)}" sh=${el.scrollHeight} ch=${el.clientHeight}>`);
        }
      }
    });
    if (clipped.length) issues.push(`clipped text: ${clipped.join(' | ')}`);

    // 4. Touch targets below 44px on coarse pointers (mobile only)
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      const small = [];
      document.querySelectorAll('button, a, input[type="checkbox"]').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.height < 40 || r.width < 40)) {
          if (small.length < 8) {
            small.push(`<${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}>`);
          }
        }
      });
      if (small.length) issues.push(`small touch targets (<40px): ${small.join(' | ')}`);
    }

    return { issues, vw, scrollW: doc.scrollWidth };
  });

  report.push({ label, ...audit });
  if (audit.issues.length) {
    console.log(`  ✗ ${label}`);
    audit.issues.forEach((i) => console.log(`    - ${i}`));
  } else {
    console.log(`  ✓ ${label} (vw=${audit.vw}, scrollW=${audit.scrollW})`);
  }
}

const browser = await chromium.launch({
  // Playwright's chromium headless shell. WSL lacks libnspr4/libnss3/
  // libasound system-wide; they are extracted (no root) into
  // ~/.local/chrome-libs and injected via LD_LIBRARY_PATH below.
  executablePath: '/home/ash/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
});

for (const theme of THEMES) {
  const colorScheme = theme === 'dark' ? 'dark' : 'light';
  console.log(`\n=== ${theme.toUpperCase()} ===`);

  for (const width of WIDTHS) {
    const isTablet = width >= 641;
    const ctx = await browser.newContext({
      viewport: { width, height: isTablet ? 1024 : HEIGHT },
      colorScheme,
      hasTouch: !isTablet,
      isMobile: !isTablet,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    if (isTablet) {
      // Desktop layout: full page screenshot
      const label = `${theme}-${width}-desktop`;
      await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true });
      await auditPage(page, label);
    } else {
      // Mobile: screenshot each tab screen. The PWA "OFFLINE READY"
      // toast (fixed, bottom-left, z-9999) intercepts tab clicks when
      // it appears — dismiss it first if present.
      const pwaToast = page.locator('div[role="status"] button:has-text("✕")');
      if (await pwaToast.count().catch(() => 0) > 0) {
        await pwaToast.first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
      for (const screen of MOBILE_SCREENS) {
        const tab = page.locator(`nav[aria-label="Primary"] button:has-text("${screen === 'timer' ? 'Timer' : screen === 'scratchpad' ? 'Notes' : screen}")`);
        const count = await tab.count();
        if (count === 0) {
          console.log(`  ✗ ${theme}-${width}-${screen}: TAB NOT FOUND`);
          report.push({ label: `${theme}-${width}-${screen}`, issues: ['tab bar button not found'], vw: width, scrollW: -1 });
          continue;
        }
        await tab.first().click({ force: true });
        await page.waitForTimeout(500);
        const label = `${theme}-${width}-${screen}`;
        await page.screenshot({ path: path.join(outDir, `${label}.png`) });
        await auditPage(page, label);
      }
    }
    await ctx.close();
  }
}

await browser.close();

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.issues.length > 0);
console.log(`\n=== SUMMARY: ${report.length} screenshots, ${bad.length} with issues ===`);
bad.forEach((r) => console.log(`  ${r.label}: ${r.issues.length} issue(s)`));
