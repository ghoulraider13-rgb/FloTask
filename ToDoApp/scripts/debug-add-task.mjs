// Debug the add-task failure on mobile-polish: type + tap ADD, dump state.
// Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" "C:/Users/Ashwin/Dev/FloTask/ToDoApp/scripts/debug-add-task.mjs"
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
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => console.log('[PAGEERROR]', String(err).slice(0, 400)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  // Type into the input
  const typed = await page.evaluate(() => {
    const input = document.getElementById('add-task-input');
    if (!input) return { ok: false, reason: 'NO INPUT ELEMENT' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Buy milk tomorrow 6pm');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, value: input.value };
  });
  console.log('TYPED:', JSON.stringify(typed));
  await new Promise(r => setTimeout(r, 300));

  // Button state + position
  const btnInfo = await page.evaluate(() => {
    const b = document.getElementById('add-task-button');
    if (!b) return { exists: false };
    const r = b.getBoundingClientRect();
    const form = b.closest('form');
    return { exists: true, disabled: b.disabled, x: r.x, y: r.y, w: r.width, h: r.height, hasForm: !!form };
  });
  console.log('BTN:', JSON.stringify(btnInfo));

  // Real-touch tap on the button center (click-guard safe)
  if (btnInfo.exists && !btnInfo.disabled) {
    const client = await page.createCDPSession();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btnInfo.x + btnInfo.w / 2, y: btnInfo.y + btnInfo.h / 2 }] });
    await new Promise(r => setTimeout(r, 60));
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
  } else {
    console.log('SKIPPING TAP — button missing or disabled');
  }

  await new Promise(r => setTimeout(r, 4000));
  const state = await page.evaluate(() => ({
    inputValue: document.getElementById('add-task-input')?.value,
    bodyHasBuyMilk: document.body.innerText.includes('Buy milk'),
    todoTasks: JSON.parse(localStorage.getItem('todo-tasks') || '[]').map(t => ({ title: t.title, reminder: t.reminderDateTime })),
    todoAlarms: JSON.parse(localStorage.getItem('todo-alarms') || '[]').map(a => ({ label: a.label, dateTime: a.dateTime })),
  }));
  console.log('FINAL STATE:', JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
