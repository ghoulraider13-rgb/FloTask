// Trap WHO calls preventDefault/stopPropagation on the eaten click:
// monkey-patch Event.prototype methods to log a stack trace during click events.
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

async function setupAndClick(page, withSequence) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  // Install the trap BEFORE any interaction
  await page.evaluate(() => {
    window.__log = [];
    const origPD = Event.prototype.preventDefault;
    const origSP = Event.prototype.stopPropagation;
    Event.prototype.preventDefault = function () {
      if (this.type === 'click') {
        window.__log.push(`preventDefault @ ${new Error().stack.split('\n').slice(1, 4).join(' | ').slice(0, 400)}`);
      }
      return origPD.call(this);
    };
    Event.prototype.stopPropagation = function () {
      if (this.type === 'click') {
        window.__log.push(`stopPropagation @ ${new Error().stack.split('\n').slice(1, 4).join(' | ').slice(0, 400)}`);
      }
      return origSP.call(this);
    };
  });

  if (withSequence) {
    const clickTab = async (i) => {
      await page.evaluate((idx) => {
        [...document.querySelectorAll('nav[role="tablist"] button')][idx].click();
      }, i);
      await new Promise(r => setTimeout(r, 600));
    };
    for (let i = 0; i < 5; i++) await clickTab(i);
    await clickTab(0);
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
    await swipe(300, 60, 500);
    await new Promise(r => setTimeout(r, 800));
    await clickTab(4);
    await new Promise(r => setTimeout(r, 700));
    const box = await page.evaluate(() => {
      const ed = document.querySelector('[contenteditable="true"]');
      const r = ed.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + Math.min(100, r.height / 2) };
    });
    await swipe(box.x + 120, box.x - 120, box.y);
    await new Promise(r => setTimeout(r, 800));
    await clickTab(0);
    await new Promise(r => setTimeout(r, 400));
  }

  await page.evaluate(() => {
    window.__log.push('--- CLICK TIME ---');
    const input = document.getElementById('add-task-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Buy milk tomorrow 6pm');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('add-task-button')?.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  return page.evaluate(() => ({
    log: window.__log,
    todoTasks: JSON.parse(localStorage.getItem('todo-tasks') || '[]').map(t => t.title),
  }));
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (err) => console.log('[PAGEERROR]', String(err).slice(0, 300)));

  console.log('=== AFTER SEQUENCE (with trap) ===');
  console.log(JSON.stringify(await setupAndClick(page, true), null, 2));
} finally {
  await browser.close();
}
