// Diagnose why CDP touch swipes don't move the Embla carousel.
// Instruments: touchstart/move/end + pointercancel counts on the container,
// elementFromPoint at the swipe location, Embla transform before/during/after.
// Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" "C:/Users/Ashwin/Dev/FloTask/ToDoApp/scripts/debug-touch.mjs"
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  // Reset to TASKS
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns[0].click();
  });
  await new Promise(r => setTimeout(r, 700));

  // What's at the swipe point + install event counters on the Embla container
  const info = await page.evaluate(() => {
    const el = document.elementFromPoint(195, 500);
    const viewport = document.querySelector('.overflow-hidden.h-full') || document.querySelector('[class*="overflow-hidden"]');
    const container = viewport?.firstElementChild;
    window.__evts = { touchstart: 0, touchmove: 0, touchend: 0, touchcancel: 0, pointerdown: 0, pointercancel: 0, pointermove: 0, mousedown: 0, prevented: 0 };
    window.__preventDefaultIf = (e) => { if (e.defaultPrevented) window.__evts.prevented++; };
    ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointercancel', 'pointermove', 'mousedown'].forEach((type) => {
      const target = type.startsWith('touch') ? container : window;
      (target || window).addEventListener(type, () => { window.__evts[type]++; }, { passive: true, capture: type.startsWith('touch') });
    });
    return {
      atPoint: el ? `${el.tagName}.${(el.className || '').toString().slice(0, 60)}` : 'null',
      containerFound: !!container,
      containerClass: container?.className?.slice(0, 80),
      containerTouchAction: container ? getComputedStyle(container).touchAction : null,
      viewportTouchAction: viewport ? getComputedStyle(viewport).touchAction : null,
      containerScrollWidth: container?.scrollWidth,
      containerClientWidth: container?.clientWidth,
      transformBefore: container ? getComputedStyle(container).transform : null,
    };
  });
  console.log('PAGE INFO:', JSON.stringify(info, null, 2));

  // CDP swipe left
  const client = await page.createCDPSession();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 340, y: 500 }] });
  for (let i = 1; i <= 12; i++) {
    const x = 340 + ((40 - 340) * i) / 12;
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 500 }] });
    if (i === 6) {
      const during = await page.evaluate(() => ({
        transformDuring: getComputedStyle(document.querySelector('.overflow-hidden.h-full')?.firstElementChild).transform,
        evtsSoFar: { ...window.__evts },
      }));
      console.log('MID-SWIPE:', JSON.stringify(during));
    }
    await new Promise(r => setTimeout(r, 16));
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 1000));

  const after = await page.evaluate(() => ({
    evts: { ...window.__evts },
    transformAfter: getComputedStyle(document.querySelector('.overflow-hidden.h-full')?.firstElementChild).transform,
    activeTab: document.querySelector('nav[role="tablist"] button[aria-current="page"]')?.textContent?.trim(),
  }));
  console.log('AFTER SWIPE:', JSON.stringify(after, null, 2));
} finally {
  await browser.close();
}
