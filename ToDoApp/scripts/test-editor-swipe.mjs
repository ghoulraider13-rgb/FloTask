// Touch swipe INSIDE the scratchpad contenteditable editor must NOT change
// screens. Embla's focusNodes skip-list covers INPUT/SELECT/TEXTAREA but NOT
// contenteditable — verifying whether the carousel drags there (it shouldn't).
// Run with Windows Node:
//   "/mnt/c/Program Files/nodejs/node.exe" "C:/Users/Ashwin/Dev/FloTask/ToDoApp/scripts/test-editor-swipe.mjs"
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://172.30.143.250:5173';

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

  // Go to NOTES
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav[role="tablist"] button')];
    const notes = btns.find(b => b.textContent.trim().toUpperCase().includes('NOTES'));
    notes.click();
  });
  await new Promise(r => setTimeout(r, 900));
  console.log('start:', await activeTabLabel(page));
  const editorExists = await page.evaluate(() => !!document.querySelector('[contenteditable="true"]'));
  console.log('editor present:', editorExists);

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

  const editorBox = await page.evaluate(() => {
    const ed = document.querySelector('[contenteditable="true"]');
    const r = ed.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + Math.min(100, r.height / 2) };
  });
  console.log('editor center:', JSON.stringify(editorBox));

  // Swipe left INSIDE the editor
  await swipe(editorBox.x + 120, editorBox.x - 120, editorBox.y);
  await new Promise(r => setTimeout(r, 1000));
  const after = await activeTabLabel(page);
  console.log('after swipe in editor:', after);

  const ok = editorExists && after?.toUpperCase().includes('NOTES');
  console.log(ok ? '\nEDITOR SWIPE LOCK: PASS' : '\nEDITOR SWIPE LOCK: FAIL (carousel navigated inside the editor)');
  if (!ok) process.exit(1);
} finally {
  await browser.close();
}
