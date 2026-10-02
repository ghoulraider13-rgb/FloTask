// Debug 2: click ALARMS tab, then check embla container transform + which slide is in view.
// Usage: "/mnt/c/Program Files/nodejs/node.exe" scripts/debug-carousel2.mjs
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

  // Click ALARMS tab
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns.find(b => b.textContent.trim().toUpperCase().includes('ALARMS')).click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const info = await page.evaluate(() => {
    // The embla viewport = element with data-style touch-action (or find via the container's parent)
    const viewport = [...document.querySelectorAll('div')].find(d =>
      d.getAttribute('style') && d.getAttribute('style').includes('touch-action')
    );
    const container = viewport ? viewport.firstElementChild : null;
    const slides = container ? [...container.children] : [];

    const slideInfo = slides.map(s => {
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      return {
        rect: Math.round(r.width) + 'x' + Math.round(r.height) + '@x' + Math.round(r.left),
        opacity: cs.opacity,
        visibility: cs.visibility,
        display: cs.display,
        text: s.innerText.trim().slice(0, 20) || '(empty)',
      };
    });

    return {
      viewportExists: !!viewport,
      viewportStyle: viewport ? viewport.getAttribute('style') : null,
      containerStyle: container ? container.getAttribute('style') : null,
      containerTransform: container ? getComputedStyle(container).transform : null,
      slideCount: slides.length,
      slideInfo,
    };
  });
  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}