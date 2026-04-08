/**
 * Audio utilities for timer chimes and alarm sounds via Web Audio API.
 * Each returns a { stop } handle for looping alarms.
 */

let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/* ── Gentle chime: 3-note ascending (timer complete / low intensity) ─── */
export function playGentleChime() {
  const ctx = getCtx();
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

/* ── Standard alarm: repeating two-tone (medium intensity) ───────────── */
export function playStandardAlarm() {
  const ctx = getCtx();
  let running = true;
  let timeouts = [];

  const loop = () => {
    if (!running) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    osc1.connect(g1); g1.connect(ctx.destination);
    osc2.connect(g2); g2.connect(ctx.destination);

    osc1.type = 'square';
    osc1.frequency.value = 880;
    g1.gain.setValueAtTime(0.08, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    osc2.type = 'square';
    osc2.frequency.value = 660;
    g2.gain.setValueAtTime(0, ctx.currentTime + 0.35);
    g2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.38);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.65);

    timeouts.push(setTimeout(loop, 1500));
  };

  loop();
  return {
    stop() {
      running = false;
      timeouts.forEach(clearTimeout);
    },
  };
}

/* ── Enforcer alarm: aggressive multi-frequency (high intensity) ─────── */
export function playEnforcerAlarm() {
  const ctx = getCtx();
  let running = true;
  let timeouts = [];

  const loop = () => {
    if (!running) return;
    [440, 880, 1320, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.11);
      osc.start(t);
      osc.stop(t + 0.12);
    });
    timeouts.push(setTimeout(loop, 700));
  };

  loop();
  return {
    stop() {
      running = false;
      timeouts.forEach(clearTimeout);
    },
  };
}

/* ── Mechanical Click: tactile UI feedback ───────────────────────── */
export function playMechanicalClick() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

/* ── Heavy Clunk: single-shot mechanical switch (task completion) ─── */
let _clunkCooldown = false;
export function playHeavyClunk() {
  if (_clunkCooldown) return; // prevent overlap on rapid checks
  _clunkCooldown = true;
  setTimeout(() => { _clunkCooldown = false; }, 150);

  const ctx = getCtx();
  const now = ctx.currentTime;

  // Low thud
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(80, now);
  osc1.frequency.exponentialRampToValueAtTime(30, now + 0.12);
  g1.gain.setValueAtTime(0.6, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(g1);
  g1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // Noise burst (metallic click)
  const bufferSize = ctx.sampleRate * 0.04;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  const gn = ctx.createGain();
  noise.buffer = buffer;
  gn.gain.setValueAtTime(0.4, now);
  gn.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  noise.connect(gn);
  gn.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.04);
}

/* ── Heavy Mechanical Chime: Enforcer Alert Loop ─────────────────── */
export function heavyMechanicalChime() {
  const ctx = getCtx();
  let running = true;
  let timeouts = [];

  const loop = () => {
    if (!running) return;
    
    // Low mechanical clank
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    
    timeouts.push(setTimeout(loop, 600));
  };

  loop();
  return {
    stop() {
      running = false;
      timeouts.forEach(clearTimeout);
    },
  };
}

