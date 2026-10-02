// Debug: inspect the carousel DOM structure (slide count, sizes, content).
// Usage: "/mnt/c/Program Files/nodejs/node.exe" scripts/debug-carousel.mjs
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const info = await page.evaluate(() => {
    const slides = [...document.querySelectorAll('div')].filter(d =>
      d.className && String(d.className).includes('flex-[0_0_100%]')
    );
    return {
      slideCount: slides.length,
      slideSizes: slides.map(s => {
        const r = s.getBoundingClientRect();
        return Math.round(r.width) + 'x' + Math.round(r.height) + '@x' + Math.round(r.left);
      }),
      slideContent: slides.map(s => s.innerText.trim().slice(0, 30) || '(empty)'),
      emblaViewportExists: !!document.querySelector('[style*="touch-action"]'),
      navExists: !!document.querySelector('nav[role="tablist"]'),
    };
  });
  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}