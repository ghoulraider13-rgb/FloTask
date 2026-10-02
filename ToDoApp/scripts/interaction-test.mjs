// Interaction test: tab-bar sync, swipe navigation, swipe disabled in
// scratchpad editor. Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" scripts/interaction-test.mjs
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';
const OUT_DIR = 'C:\\Users\\Ashwin\\Dev\\FloTask\\verification-screenshots';

const TABS = ['TASKS', 'ALARMS', 'TIMER', 'STOPWATCH', 'NOTES'];

async function activeTabLabel(page) {
  return page.evaluate(() => {
    const active = document.querySelector('nav[role="tablist"] button[aria-current="page"]')
      || document.querySelector('nav button.text-white');
    return active ? active.textContent.trim() : null;
  });
}

async function screenshotName(page, name) {
  const safe = name.replace(/[^a-z0-9-]/gi, '_');
  await page.screenshot({ path: `${OUT_DIR}/interact-${safe}.png` });
}

// Real-touch swipe via CDP — the same channel as a physical screen.
// FB-008: synthetic PointerEvents are a harness artifact — Embla 8 binds
// touchstart/touchmove/touchend + mouse events, never pointer events.
async function touchSwipe(page, fromX, toX, y, steps = 12) {
  const client = await page.createCDPSession();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps;
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await new Promise(r => setTimeout(r, 16));
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

// Real-touch tap via CDP — fires the full touchstart→pointerdown→click chain
// like a physical user. HTMLElement.click() alone dispatches ONLY a click
// event; after a swipe, Embla's viewport click-guard (preventClick, which
// down() resets at every pointerdown) would eat a pointerless click.
async function touchTap(page, x, y) {
  const client = await page.createCDPSession();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await new Promise(r => setTimeout(r, 60));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

const results = [];
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[console.${msg.type()}]`, msg.text().slice(0, 250)); });
  page.on('pageerror', (err) => console.log('[PAGEERROR]', String(err).slice(0, 350)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  // 1. Tab-bar → carousel sync: click each tab, verify active state changes
  console.log('1. TAB-BAR SYNC');
  for (const label of TABS) {
    const clicked = await page.evaluate((lbl) => {
      const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
      const btn = btns.find(b => b.textContent.trim().toUpperCase().includes(lbl));
      if (!btn) return false;
      btn.click();
      return true;
    }, label);
    await new Promise(r => setTimeout(r, 600)); // carousel animation
    const active = await activeTabLabel(page);
    const ok = clicked && active && active.toUpperCase().includes(label);
    results.push({ test: `tab→${label}`, pass: ok, detail: `active=${active}` });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} tab→${label} (active=${active})`);
    await screenshotName(page, `tab-${label}`);
  }

  // 2. Swipe navigation: swipe left from TASKS → should land on ALARMS
  console.log('2. SWIPE NAVIGATION');
  // reset to first tab
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns[0].click();
  });
  await new Promise(r => setTimeout(r, 600));

  await touchSwipe(page, 300, 60, 500);
  await new Promise(r => setTimeout(r, 800));
  const afterSwipe = await activeTabLabel(page);
  const swipeOk = afterSwipe && afterSwipe.toUpperCase().includes('ALARMS');
  results.push({ test: 'swipe→next-screen', pass: swipeOk, detail: `active=${afterSwipe}` });
  console.log(`  ${swipeOk ? 'PASS' : 'FAIL'} swipe left → ${afterSwipe}`);
  await screenshotName(page, 'after-swipe');

  // 3. Swipe INSIDE scratchpad editor must NOT change screens
  console.log('3. SCRATCHPAD SWIPE LOCK');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    const notes = btns.find(b => b.textContent.trim().toUpperCase().includes('NOTES'));
    notes.click();
  });
  await new Promise(r => setTimeout(r, 700));
  const editorExists = await page.evaluate(() => !!document.querySelector('[contenteditable="true"]'));
  const editorBox = await page.evaluate(() => {
    const ed = document.querySelector('[contenteditable="true"]');
    if (!ed) return null;
    const r = ed.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + Math.min(100, r.height / 2) };
  });
  if (editorBox) {
    await touchSwipe(page, editorBox.x + 120, editorBox.x - 120, editorBox.y);
  }
  await new Promise(r => setTimeout(r, 800));
  const stillNotes = await activeTabLabel(page);
  const lockOk = editorExists && stillNotes && stillNotes.toUpperCase().includes('NOTES');
  results.push({ test: 'scratchpad-swipe-locked', pass: lockOk, detail: `editor=${editorExists} active=${stillNotes}` });
  console.log(`  ${lockOk ? 'PASS' : 'FAIL'} swipe in editor stays on NOTES (active=${stillNotes})`);

  // 4. Add a task end-to-end (typed)
  console.log('4. TASK CREATION');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    btns[0].click();
  });
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => {
    const input = document.getElementById('add-task-input');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Buy milk tomorrow 6pm');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  // Real-touch tap on the ADD button (center) — like a physical user
  const addBtnBox = await page.evaluate(() => {
    const b = document.getElementById('add-task-button');
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await touchTap(page, addBtnBox.x, addBtnBox.y);
  await new Promise(r => setTimeout(r, 4000)); // parser is synchronous now; UI settle
  const taskAdded = await page.evaluate(() => document.body.innerText.includes('Buy milk'));
  results.push({ test: 'add-task', pass: taskAdded, detail: `visible=${taskAdded}` });
  console.log(`  ${taskAdded ? 'PASS' : 'FAIL'} task added & visible`);
  if (!taskAdded) {
    const diag = await page.evaluate(() => ({
      activeTab: document.querySelector('nav[role="tablist"] button[aria-current="page"]')?.textContent?.trim(),
      inputValue: document.getElementById('add-task-input')?.value,
      inputExists: !!document.getElementById('add-task-input'),
      todoTasks: JSON.parse(localStorage.getItem('todo-tasks') || '[]').map(t => t.title),
      transform: getComputedStyle(document.querySelector('[class*="overflow-hidden"]')?.firstElementChild || document.body).transform,
    }));
    console.log('  DIAG:', JSON.stringify(diag));
  }
  await screenshotName(page, 'task-added');

} finally {
  await browser.close();
}

console.log('\n=== INTERACTION SUMMARY ===');
const passed = results.filter(r => r.pass).length;
console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${results.length - passed}`);
results.forEach(r => console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.test} — ${r.detail}`));
if (passed !== results.length) process.exit(1);