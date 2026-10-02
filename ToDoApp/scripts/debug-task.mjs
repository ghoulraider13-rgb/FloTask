// Debug 3: task creation flow with console + pageerror capture.
// Usage: "/mnt/c/Program Files/nodejs/node.exe" scripts/debug-task.mjs
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
  page.on('console', m => console.log('PAGE:', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('requestfailed', r => console.log('REQFAIL:', r.url(), r.failure()?.errorText));

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Go to TASKS tab first
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns[0].click();
  });
  await new Promise(r => setTimeout(r, 700));

  const step1 = await page.evaluate(() => {
    const input = document.getElementById('add-task-input');
    if (!input) return 'no input';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, 'Buy milk tomorrow 6pm');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed: ' + input.value;
  });
  console.log('STEP1:', step1);
  await new Promise(r => setTimeout(r, 500));

  const step2 = await page.evaluate(() => {
    const b = document.getElementById('add-task-button');
    if (!b) return 'no button';
    b.click();
    return 'clicked, disabled=' + b.disabled;
  });
  console.log('STEP2:', step2);
  await new Promise(r => setTimeout(r, 3000)); // allow NLM round-trip

  const step3 = await page.evaluate(() => ({
    tasks: localStorage.getItem('todo-tasks'),
    bodyHas: document.body.innerText.includes('Buy milk'),
    inputValue: document.getElementById('add-task-input')?.value,
  }));
  console.log('STEP3:', JSON.stringify(step3, null, 2));
} finally {
  await browser.close();
}