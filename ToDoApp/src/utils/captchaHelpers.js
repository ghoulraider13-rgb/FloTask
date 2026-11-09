/**
 * CAPTCHA generators for High-intensity alarm enforcement.
 * The user MUST solve the challenge to dismiss the alarm.
 */

const WORDS = [
  'anchor', 'breeze', 'crystal', 'delta', 'ember', 'frost',
  'granite', 'harbor', 'ignite', 'jasper', 'karma', 'lunar',
  'marble', 'nebula', 'orbit', 'prism', 'quartz', 'ripple',
  'solar', 'thunder', 'unity', 'vertex', 'whisper', 'xenon',
  'yield', 'zenith', 'alpine', 'blaze', 'cipher', 'drift',
  'eclipse', 'flare', 'glacier', 'horizon', 'impulse', 'jungle',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate a 6-word phrase the user must type exactly. */
export function generatePhraseCaptcha() {
  const phrase = shuffle(WORDS).slice(0, 6).join(' ');
  return {
    type: 'phrase',
    challenge: phrase,
    instruction: 'Type the following phrase exactly to dismiss:',
    verify: (input) => input.trim().toLowerCase() === phrase.toLowerCase(),
  };
}

/** Generate a math problem (two-operand addition/multiplication). */
export function generateMathCaptcha() {
  const ops = [
    { fn: (a, b) => a + b, sym: '+' },
    { fn: (a, b) => a * b, sym: '×' },
  ];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 50) + 10;
  const b = Math.floor(Math.random() * 30) + 5;
  const answer = op.fn(a, b);
  return {
    type: 'math',
    challenge: `${a} ${op.sym} ${b} = ?`,
    instruction: 'Solve this math problem to dismiss:',
    verify: (input) => parseInt(input.trim(), 10) === answer,
  };
}

/** Randomly pick either a phrase or math CAPTCHA. */
export function generateCaptcha() {
  return Math.random() > 0.5 ? generatePhraseCaptcha() : generateMathCaptcha();
}
