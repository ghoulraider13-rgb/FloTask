// Real-touch swipe test — CDP Input.dispatchTouchEvent (the same channel as
// a physical screen). Embla 8 binds touchstart/touchmove/touchend, NOT pointer
// events, so the old synthetic-PointerEvent swipe (FB-008) never moved it.
// Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" scripts/test-touch-swipe.mjs
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';
const OUT_DIR = 'C:\\Users\\Ashwin\\Dev\\FloTask\\verification-screenshots';

async function activeTabLabel(page) {
  return page.evaluate(() => {
    const active = document.querySelector('nav[role="tablist"] button[aria-current="page"]')
      || document.querySelector('nav button.text-white');
    return active ? active.textContent.trim() : null;
  });
}

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

  // Start on TASKS
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns[0].click();
  });
  await new Promise(r => setTimeout(r, 700));
  console.log('start:', await activeTabLabel(page));

  const client = await page.createCDPSession();
  const swipe = async (fromX, toX, y, steps = 12) => {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
    for (let i = 1; i <= steps; i++) {
      const x = fromX + ((toX - fromX) * i) / steps;
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await new Promise(r => setTimeout(r, 16));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  // 1. Swipe left on the task area → ALARMS
  await swipe(340, 40, 500);
  await new Promise(r => setTimeout(r, 1000));
  const after1 = await activeTabLabel(page);
  console.log('after swipe left 1:', after1);
  await page.screenshot({ path: `${OUT_DIR}/touch-swipe-1.png` });

  // 2. Swipe left again → TIMER
  await swipe(340, 40, 500);
  await new Promise(r => setTimeout(r, 1000));
  const after2 = await activeTabLabel(page);
  console.log('after swipe left 2:', after2);
  await page.screenshot({ path: `${OUT_DIR}/touch-swipe-2.png` });

  // 3. Swipe right → back to ALARMS
  await swipe(40, 340, 500);
  await new Promise(r => setTimeout(r, 1000));
  const after3 = await activeTabLabel(page);
  console.log('after swipe right:', after3);
  await page.screenshot({ path: `${OUT_DIR}/touch-swipe-3.png` });

  const ok = after1?.toUpperCase().includes('ALARMS')
    && after2?.toUpperCase().includes('TIMER')
    && after3?.toUpperCase().includes('ALARMS');
  console.log(ok ? '\nTOUCH SWIPE: PASS' : '\nTOUCH SWIPE: FAIL');
  if (!ok) process.exit(1);
} finally {
  await browser.close();
}
