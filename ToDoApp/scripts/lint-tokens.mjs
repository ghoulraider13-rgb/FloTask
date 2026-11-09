import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const TARGET_FILES = [];

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        collectFiles(fullPath);
      }
    } else if (entry.name.endsWith('.jsx') || (entry.name.endsWith('.js') && !entry.name.includes('drawConstants'))) {
      TARGET_FILES.push(fullPath);
    }
  }
}

// Target src/components and src/App.jsx
collectFiles(path.join(SRC_DIR, 'components'));
if (fs.existsSync(path.join(SRC_DIR, 'App.jsx'))) {
  TARGET_FILES.push(path.join(SRC_DIR, 'App.jsx'));
}

const VIOLATIONS = [];

const PATTERNS = [
  { name: 'Hardcoded Hex Color', regex: /#[0-9a-fA-F]{3,6}\b/ },
  { name: 'Tailwind Gray Color', regex: /\bgray-\d{2,3}\b/ },
  { name: 'Arbitrary Text Size', regex: /\btext-\[\d+px\]/ },
];

for (const file of TARGET_FILES) {
  const relativePath = path.relative(path.resolve(__dirname, '..'), file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip full comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    for (const { name, regex } of PATTERNS) {
      const match = line.match(regex);
      if (match) {
        VIOLATIONS.push({
          file: relativePath,
          line: index + 1,
          rule: name,
          token: match[0],
          text: line.trim(),
        });
      }
    }
  });
}

if (VIOLATIONS.length > 0) {
  console.error(`\x1b[31m✖ Token Lint Failed: ${VIOLATIONS.length} design token violation(s) found:\x1b[0m\n`);
  for (const v of VIOLATIONS) {
    console.error(`  \x1b[33m${v.file}:${v.line}\x1b[0m [${v.rule}] -> found "${v.token}"`);
    console.error(`    ${v.text}\n`);
  }
  process.exit(1);
} else {
  console.log(`\x1b[32m✔ Token Lint Passed: All ${TARGET_FILES.length} component files adhere to design tokens.\x1b[0m`);
  process.exit(0);
}
