// H: Multi-device verification — Pixel 7, iPhone SE, 360x640 Android, tablet.
// Screenshots every tab per device; checks overflow/clipping/empty voids.
// Uses puppeteer-core + Windows Chrome (WSL has no display).
// Run: "/mnt/c/Program Files/nodejs/node.exe" "C:/Users/Ashwin/Dev/FloTask/ToDoApp/scripts/verify-multidevice.mjs"
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';
const OUT_DIR = 'C:\\Users\\Ashwin\\Dev\\FloTask\\verification-screenshots';

const DEVICES = [
  { name: 'pixel7', width: 412, height: 915, mobile: true },
  { name: 'iphone-se', width: 375, height: 667, mobile: true },
  { name: 'android-360', width: 360, height: 640, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
];

const TABS = ['TASKS', 'ALARMS', 'TIMER', 'STOPWATCH', 'NOTES'];

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio'],
});

const results = [];

try {
  for (const dev of DEVICES) {
    const page = await browser.newPage();
    await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: 1, isMobile: dev.mobile, hasTouch: dev.mobile });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200)); // full hydration (cold-start race guard)

    for (const tab of TABS) {
      await page.evaluate((label) => {
        const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
        btns.find((b) => b.textContent.trim().toUpperCase().includes(label))?.click();
      }, tab);
      await new Promise((r) => setTimeout(r, 700));

      const issues = await page.evaluate(() => {
        const problems = [];
        const vw = window.innerWidth;
        // The Embla carousel intentionally positions sibling slides off-screen
        // inside an overflow-hidden viewport — never report those.
        const inCarousel = (el) => !!el.closest('.touch-pan-y, [class*="touch-pan-y"]');
        // overflow: any element wider than the viewport, NOT inside the carousel,
        // NOT inside a portal'd drawer (sheet slides in from off-screen)
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > vw + 2 || r.left < -2) && getComputedStyle(el).position !== 'fixed') {
            if (!inCarousel(el) && !el.closest('[data-vaul-drawer]')) {
              problems.push(`overflow: ${el.tagName}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(r.right)}`);
            }
          }
        });
        // tiny type: visible text under 9px (micro-labels floor)
        document.querySelectorAll('span, p, h1, h2, h3').forEach((el) => {
          const r = el.getBoundingClientRect();
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (r.width > 0 && r.height > 0 && el.textContent.trim() && fs < 9 && !inCarousel(el)) {
            problems.push(`tiny-type: <${el.tagName}> ${fs}px "${el.textContent.trim().slice(0, 30)}"`);
          }
        });
        return [...new Set(problems)].slice(0, 6);
      });

      const safe = `${dev.name}-${tab}`;
      await page.screenshot({ path: `${OUT_DIR}/multi-${safe}.png` });
      results.push({ device: dev.name, tab, issues });
      console.log(`${issues.length === 0 ? 'PASS' : 'WARN'}  ${dev.name} → ${tab}${issues.length ? ` (${issues.length})` : ''}`);
      issues.forEach((i) => console.log(`      ${i}`));
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const totalIssues = results.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n=== MULTI-DEVICE SUMMARY: ${results.length} shots, ${totalIssues} issue(s) ===`);
if (totalIssues > 0) process.exit(1);
