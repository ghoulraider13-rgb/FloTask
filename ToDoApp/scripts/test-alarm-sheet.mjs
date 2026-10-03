// Test the Alarms bottom sheet: open via FAB, wheel-pick a time, set alarm,
// verify creation + sheet closes. Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" "C:/Users/Ashwin/Dev/FloTask/ToDoApp/scripts/test-alarm-sheet.mjs"
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';
const OUT_DIR = 'C:\\Users\\Ashwin\\Dev\\FloTask\\verification-screenshots';

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio'],
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('[PAGEERROR]', String(err).slice(0, 300)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));

  // Go to ALARMS tab
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns.find(b => b.textContent.trim().toUpperCase().includes('ALARMS'))?.click();
  });
  await new Promise(r => setTimeout(r, 900));

  // Tap the FAB (+) with real touch
  const fab = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Add alarm"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!fab) { console.log('FAIL: FAB not found'); process.exit(1); }
  const client = await page.createCDPSession();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fab.x, y: fab.y }] });
  await new Promise(r => setTimeout(r, 60));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 800));

  // Sheet open?
  const sheetOpen = await page.evaluate(() => !!document.querySelector('[data-vaul-drawer], [data-vaul-drawer-direction]'));
  console.log('sheet open:', sheetOpen);
  await page.screenshot({ path: `${OUT_DIR}/alarm-sheet-open.png` });

  // Set a label
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="text"]')].find(i => i.placeholder?.includes('Label'));
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Test alarm');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Scroll the HOUR wheel down 2 items (06 -> 08)
  const wheel = await page.evaluate(() => {
    const wheels = [...document.querySelectorAll('.wheel-scroller')];
    const hourWheel = wheels[0];
    if (!hourWheel) return null;
    const before = hourWheel.scrollTop;
    hourWheel.scrollTop = before + 80; // 2 items × 40px
    return { before, after: hourWheel.scrollTop };
  });
  console.log('wheel scroll:', JSON.stringify(wheel));
  await new Promise(r => setTimeout(r, 500));

  // Tap SET ALARM
  const setBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.textContent.trim().toUpperCase() === 'SET ALARM');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!setBtn) { console.log('FAIL: SET ALARM button not found'); process.exit(1); }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: setBtn.x, y: setBtn.y }] });
  await new Promise(r => setTimeout(r, 60));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 1000));

  const state = await page.evaluate(() => ({
    sheetStillOpen: !!document.querySelector('[data-vaul-drawer]'),
    alarms: JSON.parse(localStorage.getItem('todo-alarms') || '[]').map(a => ({ label: a.label, dateTime: a.dateTime })),
    bodyHasTestAlarm: document.body.innerText.includes('Test alarm'),
  }));
  console.log('STATE:', JSON.stringify(state, null, 2));
  await page.screenshot({ path: `${OUT_DIR}/alarm-sheet-after-set.png` });

  // The alarm must be created + the sheet must close. The pill may be
  // scrolled out of view (list scrolls) — body text check is on the pill
  // row only if visible; the localStorage record is the authority.
  const ok = state.alarms.length > 0 && !state.sheetStillOpen && state.alarms[0].label === 'Test alarm';
  console.log(ok ? '\nALARM SHEET: PASS' : '\nALARM SHEET: FAIL');
  if (!ok) process.exit(1);
} finally {
  await browser.close();
}
