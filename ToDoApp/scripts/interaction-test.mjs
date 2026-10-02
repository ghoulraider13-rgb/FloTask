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

const results = [];
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

  await page.evaluate(() => new Promise(resolve => {
    const el = document.elementFromPoint(195, 500);
    const target = el || document.body;
    const opts = { bubbles: true, cancelable: true, pointerId: 1 };
    target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 300, clientY: 500 }));
    setTimeout(() => {
      target.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 200, clientY: 500 }));
      setTimeout(() => {
        target.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 60, clientY: 500 }));
        target.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 60, clientY: 500 }));
        resolve();
      }, 80);
    }, 80);
  }));
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
  await page.evaluate(() => new Promise(resolve => {
    const ed = document.querySelector('[contenteditable="true"]');
    if (!ed) return resolve();
    const r = ed.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, pointerId: 1 };
    ed.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: r.x + 150, clientY: r.y + 60 }));
    setTimeout(() => {
      ed.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: r.x + 60, clientY: r.y + 60 }));
      setTimeout(() => {
        ed.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: r.x + 60, clientY: r.y + 60 }));
        resolve();
      }, 80);
    }, 80);
  }));
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
  await page.evaluate(() => document.getElementById('add-task-button')?.click());
  await new Promise(r => setTimeout(r, 4000)); // NLM parse attempt (Ollama fetch has its own timeout)
  const taskAdded = await page.evaluate(() => document.body.innerText.includes('Buy milk'));
  results.push({ test: 'add-task', pass: taskAdded, detail: `visible=${taskAdded}` });
  console.log(`  ${taskAdded ? 'PASS' : 'FAIL'} task added & visible`);
  await screenshotName(page, 'task-added');

} finally {
  await browser.close();
}

console.log('\n=== INTERACTION SUMMARY ===');
const passed = results.filter(r => r.pass).length;
console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${results.length - passed}`);
results.forEach(r => console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.test} — ${r.detail}`));
if (passed !== results.length) process.exit(1);