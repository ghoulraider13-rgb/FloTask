// Dev utility: summarize the verification report's unique issue patterns.
// Usage: "/mnt/c/Program Files/nodejs/node.exe" scripts/report-summary.mjs
import { readFileSync } from 'fs';
const r = JSON.parse(readFileSync('C:/Users/Ashwin/Dev/FloTask/verification-screenshots/report.json', 'utf8'));
console.log('Total:', r.total, 'Passed:', r.passed, 'Failed:', r.failed);
const issues = r.results[0].issues; // first phone run = representative
console.log('Issues in', r.results[0].viewport, '@', r.results[0].theme, ':', issues.length);
const seen = new Set();
issues.forEach(i => {
  const m = i.match(/(BUTTON|INPUT|SVG)[^ ]* [0-9]+x[0-9]+px/);
  const key = m ? m[0] : i;
  if (!seen.has(key)) { seen.add(key); console.log('  ' + i); }
});
