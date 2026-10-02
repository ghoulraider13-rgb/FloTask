// Verification: real screenshots at 320/360/390/412/430 + tablet, light & dark.
// Runs under WINDOWS Node + Windows Chrome (puppeteer-core is pure JS).
// Usage (from WSL):  cd /mnt/c/Users/Ashwin/Dev/FloTask/ToDoApp
//                    "/mnt/c/Program Files/nodejs/node.exe" scripts/verify.js
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';
const OUT_DIR = 'C:\\Users\\Ashwin\\Dev\\FloTask\\verification-screenshots';

const VIEWPORTS = [
  { width: 320, height: 568, name: '320x568' },
  { width: 360, height: 640, name: '360x640' },
  { width: 390, height: 844, name: '390x844' },
  { width: 412, height: 915, name: '412x915' },
  { width: 430, height: 932, name: '430x932' },
  { width: 768, height: 1024, name: '768x1024-tablet' },
];

const THEMES = ['light', 'dark'];

async function waitForAppReady(page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
}

async function checkForIssues(page) {
  return await page.evaluate(() => {
    const issues = [];

    // Horizontal overflow on the page
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      issues.push(`Horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > clientWidth ${document.documentElement.clientWidth}`);
    }

    // Clipped content in overflow-hidden containers — EXCLUDE the embla carousel
    // viewport itself (it intentionally holds off-screen slides; that's how
    // transform-based carousels work, not a layout bug).
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
        if (el.scrollWidth > el.clientWidth + 2) {
          // Skip the carousel viewport: slides parked off-screen are by design
          if (el.getAttribute('style') && el.getAttribute('style').includes('touch-action')) return;
          const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '';
          issues.push(`Clipped content in ${el.tagName}${cls}: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
        }
      }
    });

    // Overlapping interactive elements (same parent only, to avoid false positives across layers)
    const byParent = new Map();
    document.querySelectorAll('button, input, [contenteditable], a, select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const key = el.parentElement ? el.parentElement : document.body;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push({
        el: el.tagName + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''),
        left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      });
    });
    byParent.forEach(rects => {
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          const overlap = !(a.right <= b.left + 2 || b.right <= a.left + 2 || a.bottom <= b.top + 2 || b.bottom <= a.top + 2);
          if (overlap) {
            issues.push(`Overlap: ${a.el} overlaps ${b.el} @ y=${Math.round(a.top)}`);
          }
        }
      }
    });

    // Touch targets on phone widths (<44px), accounting for hit-slop
    // pseudo-elements (.touch-44 / .toolbar-btn extend the tap area via ::before)
    if (window.innerWidth < 768) {
      document.querySelectorAll('button, [role="tab"], input[type="checkbox"], .task-checkbox').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        let w = r.width, h = r.height;
        const before = getComputedStyle(el, '::before');
        if (before && before.content !== 'none' && before.position === 'absolute') {
          const bw = parseFloat(before.width) || 0;
          const bh = parseFloat(before.height) || 0;
          w = Math.max(w, bw);
          h = Math.max(h, bh);
        }
        if (w < 44 || h < 44) {
          const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '';
          issues.push(`Touch target too small: ${el.tagName}${cls} ${Math.round(w)}x${Math.round(h)}px (hit-slop included)`);
        }
      });
    }

    return issues;
  });
}

async function runVerification() {
  console.log('Starting verification (Windows Chrome headless)...');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
    ],
  });

  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const page = await browser.newPage();

        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          isMobile: viewport.width < 768,
          hasTouch: viewport.width < 768,
        });

        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);

        console.log(`Testing ${viewport.name} @ ${theme}...`);

        try {
          await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
          await waitForAppReady(page);

          const issues = await checkForIssues(page);

          const filename = `${viewport.name}-${theme}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: true });

          results.push({ viewport: viewport.name, theme, filename, issues, pass: issues.length === 0 });

          console.log(`  ${issues.length === 0 ? 'PASS' : 'FAIL'} — ${issues.length} issue(s)`);
          issues.slice(0, 6).forEach(i => console.log(`    - ${i}`));
          if (issues.length > 6) console.log(`    ... and ${issues.length - 6} more`);
        } catch (e) {
          console.log(`  ERROR: ${e.message}`);
          results.push({ viewport: viewport.name, theme, filename: null, issues: [`Page load error: ${e.message}`], pass: false });
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Total: ${report.total}, Passed: ${report.passed}, Failed: ${report.failed}`);
  console.log(`Screenshots: ${OUT_DIR}`);

  if (report.failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ${r.viewport} @ ${r.theme}:`);
      r.issues.slice(0, 3).forEach(i => console.log(`    - ${i}`));
      if (r.issues.length > 3) console.log(`    ... and ${r.issues.length - 3} more`);
    });
    process.exit(1);
  }

  return report;
}

runVerification().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});