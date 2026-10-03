import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://172.30.143.250:5173', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  const info = await page.evaluate(() => {
    const b = document.getElementById('add-task-button');
    const r = b.getBoundingClientRect();
    // What element is ACTUALLY at the button's center point?
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const el2 = document.elementFromPoint(r.x + 10, r.y + r.height / 2);
    return {
      btnRect: { x: r.x, y: r.y, w: r.width, h: r.height },
      atCenter: el ? `${el.tagName}#${el.id || ''}.${(el.className || '').toString().slice(0, 50)}` : 'null',
      atLeft: el2 ? `${el2.tagName}#${el2.id || ''}` : 'null',
      isSameAsButton: el === b,
    };
  });
  console.log('HIT-TEST:', JSON.stringify(info, null, 2));
} finally { await browser.close(); }
