// Procedural audio engine: every sound is synthesized in real time with WebAudio
// (layered oscillators, filtered noise, convolution reverb, compression).
import { settings } from './settings.js';

let ctx = null;
let master, sfxBus, musicBus, reverb, reverbSend, comp;
let noiseBuf = null;
let musicState = null;
const lastPlay = {};

function makeImpulse(seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // early reflections + diffuse tail
      const er = i < rate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.9 : 0;
      d[i] = er + (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.55;
    }
  }
  return buf;
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'interactive' });
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.22;
  master = ctx.createGain(); master.gain.value = 0.9;
  comp.connect(master); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.connect(comp);
  reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(3.2, 2.6);
  const revGain = ctx.createGain(); revGain.gain.value = 0.55;
  reverb.connect(revGain); revGain.connect(comp);
  reverbSend = ctx.createGain(); reverbSend.gain.value = 1; reverbSend.connect(reverb);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  applyVolumes();
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}

export function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * 0.55, ctx.currentTime, 0.1);
}

export function suspendAudio(s) { if (ctx) { if (s) ctx.suspend(); else ctx.resume(); } }

function out(dest, wet) {
  const g = ctx.createGain();
  g.connect(dest || sfxBus);
  if (wet) {
    const s = ctx.createGain(); s.gain.value = wet;
    g.connect(s); s.connect(reverbSend);
  }
  return g;
}

function env(g, t, a, peak, d, sustainEnd) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + (sustainEnd || 0));
}

function noise(t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.5, attack = 0.005, dest, wet = 0.2, pan = 0 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  const g = ctx.createGain(); env(g, t, attack, gain, dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  src.connect(f); f.connect(g);
  if (p) { p.pan.value = pan; g.connect(p); p.connect(out(dest, wet)); } else g.connect(out(dest, wet));
  src.start(t, Math.random()); src.stop(t + dur + attack + 0.05);
}

function tone(t, dur, { type = 'sine', f0 = 440, f1 = f0, gain = 0.3, attack = 0.005, dest, wet = 0.2, detune = 0, pan = 0, lp = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  const g = ctx.createGain(); env(g, t, attack, gain, dur);
  let node = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  node.connect(g);
  if (p) { p.pan.value = pan; g.connect(p); p.connect(out(dest, wet)); } else g.connect(out(dest, wet));
  o.start(t); o.stop(t + dur + attack + 0.05);
}

const R = (a, b) => a + Math.random() * (b - a);

const SFX = {
  swing() {
    const t = ctx.currentTime;
    noise(t, 0.22, { f0: R(2400, 3200), f1: 500, q: 2.5, gain: 0.35, attack: 0.03, wet: 0.15 });
    noise(t + 0.02, 0.15, { type: 'highpass', f0: 5000, f1: 2500, q: 0.7, gain: 0.08, attack: 0.02 });
  },
  hit() {
    const t = ctx.currentTime;
    tone(t, 0.18, { f0: R(140, 170), f1: 45, gain: 0.7, wet: 0.2 });
    noise(t, 0.08, { type: 'lowpass', f0: 4000, f1: 600, gain: 0.5, wet: 0.25 });
    tone(t, 0.25, { type: 'triangle', f0: R(900, 1300), f1: R(700, 900), gain: 0.06, wet: 0.4 });
  },
  crit() {
    const t = ctx.currentTime;
    SFX.hit();
    tone(t, 0.5, { type: 'sine', f0: 2200, f1: 1800, gain: 0.08, wet: 0.6 });
    tone(t, 0.5, { type: 'sine', f0: 3300, f1: 2900, gain: 0.05, wet: 0.6 });
  },
  playerHurt() {
    const t = ctx.currentTime;
    tone(t, 0.3, { type: 'sawtooth', f0: 220, f1: 70, gain: 0.25, lp: 900, wet: 0.2 });
    noise(t, 0.2, { type: 'lowpass', f0: 1500, f1: 200, gain: 0.5 });
  },
  death() {
    const t = ctx.currentTime;
    noise(t, 0.6, { type: 'lowpass', f0: 2500, f1: 120, gain: 0.5, wet: 0.4 });
    tone(t, 0.55, { type: 'sawtooth', f0: R(160, 200), f1: 40, gain: 0.18, lp: 700, wet: 0.4 });
    for (let i = 0; i < 4; i++) noise(t + 0.05 + i * 0.05, 0.05, { f0: R(800, 2000), q: 6, gain: 0.15 });
  },
  bones() {
    const t = ctx.currentTime;
    for (let i = 0; i < 7; i++) {
      const tt = t + i * R(0.03, 0.07);
      noise(tt, 0.04, { f0: R(1500, 3500), q: 8, gain: 0.25, wet: 0.35 });
      tone(tt, 0.06, { type: 'triangle', f0: R(600, 1200), gain: 0.06, wet: 0.3 });
    }
  },
  splat() {
    const t = ctx.currentTime;
    noise(t, 0.3, { type: 'lowpass', f0: 1200, f1: 150, gain: 0.6, wet: 0.2 });
    tone(t, 0.25, { f0: 300, f1: 60, gain: 0.3 });
  },
  gold() {
    const t = ctx.currentTime;
    const base = R(1500, 1700);
    [1, 1.5].forEach((m, i) => {
      tone(t + i * 0.07, 0.4, { f0: base * m, gain: 0.12, wet: 0.5 });
      tone(t + i * 0.07, 0.3, { f0: base * m * 2.76, gain: 0.04, wet: 0.5 });
    });
  },
  potion() {
    const t = ctx.currentTime;
    for (let i = 0; i < 8; i++) tone(t + i * 0.045, 0.06, { f0: 300 + i * 90 + R(0, 60), f1: 500 + i * 120, gain: 0.12, wet: 0.3 });
    tone(t + 0.35, 0.8, { f0: 880, gain: 0.08, wet: 0.7 });
    tone(t + 0.35, 0.8, { f0: 1320, gain: 0.05, wet: 0.7 });
  },
  dash() {
    const t = ctx.currentTime;
    noise(t, 0.3, { f0: 600, f1: 3000, q: 1.2, gain: 0.35, attack: 0.04, wet: 0.2 });
  },
  nova() {
    const t = ctx.currentTime;
    noise(t, 1.0, { type: 'lowpass', f0: 300, f1: 6000, q: 1, gain: 0.5, attack: 0.05, wet: 0.5 });
    tone(t, 0.9, { type: 'sawtooth', f0: 60, f1: 30, gain: 0.35, lp: 400, wet: 0.4 });
    tone(t, 1.2, { f0: 440, f1: 880, gain: 0.08, wet: 0.8 });
  },
  shoot() {
    const t = ctx.currentTime;
    noise(t, 0.35, { type: 'bandpass', f0: 400, f1: 1800, q: 0.8, gain: 0.3, attack: 0.03, wet: 0.3 });
    tone(t, 0.2, { type: 'triangle', f0: 500, f1: 900, gain: 0.07, wet: 0.3 });
  },
  frost() {
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) tone(t + i * 0.03, 0.4, { f0: R(2000, 4000), gain: 0.04, wet: 0.7 });
    noise(t, 0.3, { type: 'highpass', f0: 3000, f1: 6000, gain: 0.2, wet: 0.4 });
  },
  explode() {
    const t = ctx.currentTime;
    noise(t, 0.6, { type: 'lowpass', f0: 3000, f1: 100, gain: 0.6, wet: 0.4 });
    tone(t, 0.5, { f0: 120, f1: 30, gain: 0.5 });
  },
  growl() {
    const t = ctx.currentTime;
    tone(t, 0.5, { type: 'sawtooth', f0: R(70, 90), f1: R(50, 60), gain: 0.15, lp: 500, wet: 0.4 });
    noise(t, 0.5, { type: 'bandpass', f0: 300, f1: 200, q: 3, gain: 0.2, wet: 0.4 });
  },
  telegraph() {
    const t = ctx.currentTime;
    tone(t, 0.25, { type: 'square', f0: 180, f1: 360, gain: 0.05, lp: 1500, wet: 0.3 });
  },
  step(kind) {
    const t = ctx.currentTime;
    const f = kind === 'ice' ? R(3000, 4500) : kind === 'swamp' ? R(400, 700) : R(900, 1600);
    noise(t, kind === 'swamp' ? 0.12 : 0.06, { type: 'bandpass', f0: f, f1: f * 0.6, q: kind === 'ice' ? 3 : 1.5, gain: 0.09, wet: 0.15, pan: R(-0.15, 0.15) });
  },
  chest() {
    const t = ctx.currentTime;
    noise(t, 0.4, { f0: 300, f1: 200, q: 4, gain: 0.25, wet: 0.3 });
    tone(t + 0.2, 0.15, { type: 'square', f0: 90, gain: 0.05, lp: 400 });
    [523, 659, 784, 1046].forEach((f, i) => tone(t + 0.3 + i * 0.08, 0.7, { f0: f, gain: 0.08, wet: 0.6 }));
  },
  levelup() {
    const t = ctx.currentTime;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      tone(t + i * 0.09, 1.2, { type: 'triangle', f0: f, gain: 0.1, wet: 0.7 });
      tone(t + i * 0.09, 1.2, { f0: f * 2, gain: 0.03, wet: 0.7 });
    });
  },
  portal() {
    const t = ctx.currentTime;
    noise(t, 1.6, { f0: 200, f1: 4000, q: 4, gain: 0.3, attack: 0.3, wet: 0.7 });
    tone(t, 1.6, { type: 'sine', f0: 110, f1: 440, gain: 0.2, attack: 0.3, wet: 0.7 });
  },
  click() {
    const t = ctx.currentTime;
    tone(t, 0.06, { type: 'triangle', f0: 1200, f1: 900, gain: 0.12, wet: 0.1 });
    noise(t, 0.03, { type: 'highpass', f0: 4000, gain: 0.06 });
  },
  boss() {
    const t = ctx.currentTime;
    tone(t, 2.5, { type: 'sawtooth', f0: 55, f1: 40, gain: 0.3, lp: 300, attack: 0.1, wet: 0.6 });
    tone(t, 2.5, { type: 'sawtooth', f0: 82.4, f1: 60, gain: 0.2, lp: 300, attack: 0.1, wet: 0.6 });
    noise(t, 2.0, { type: 'lowpass', f0: 200, f1: 1200, gain: 0.3, attack: 0.5, wet: 0.7 });
  },
  gameover() {
    const t = ctx.currentTime;
    [220, 196, 174.6, 146.8].forEach((f, i) => tone(t + i * 0.35, 1.4, { type: 'triangle', f0: f, gain: 0.14, wet: 0.8 }));
  },
};

export function sfx(name, arg) {
  if (!ctx || ctx.state !== 'running' || settings.sfx <= 0) return;
  const now = performance.now();
  if (lastPlay[name] && now - lastPlay[name] < 35) return; // de-dupe stacking
  lastPlay[name] = now;
  const fn = SFX[name];
  if (fn) fn(arg);
}

// ---------------- Generative music ----------------
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

function pad(t, freqs, dur, gain, bright) {
  freqs.forEach((f, i) => {
    [-7, 7].forEach((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + (i - 1) * 2;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.6;
      fl.frequency.setValueAtTime(bright * 0.5, t);
      fl.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
      fl.frequency.linearRampToValueAtTime(bright * 0.4, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(musicBus);
      const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(reverbSend);
      o.start(t); o.stop(t + dur + 0.1);
    });
  });
}

function bell(t, f, gain) {
  [[1, 1], [2.01, 0.35], [3.98, 0.15], [5.4, 0.06]].forEach(([m, a]) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
    const g = ctx.createGain(); env(g, t, 0.005, gain * a, 2.5 / m);
    o.connect(g); g.connect(musicBus);
    const s = ctx.createGain(); s.gain.value = 0.9; g.connect(s); s.connect(reverbSend);
    o.start(t); o.stop(t + 3);
  });
}

function drum(t, f, gain) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f * 2.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const g = ctx.createGain(); env(g, t, 0.003, gain, 0.45);
  o.connect(g); g.connect(musicBus);
  const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(reverbSend);
  o.start(t); o.stop(t + 0.6);
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 900;
  const ng = ctx.createGain(); env(ng, t, 0.002, gain * 0.3, 0.12);
  n.connect(nf); nf.connect(ng); ng.connect(musicBus); n.start(t, Math.random()); n.stop(t + 0.2);
}

const PROGS = {
  menu:  { root: 50, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], scale: [0, 3, 5, 7, 10, 12, 15], tempo: 5.5, bright: 900, drums: false },
  crypt: { root: 45, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], scale: [0, 1, 3, 5, 7, 8, 12], tempo: 6, bright: 700, drums: false },
  lava:  { root: 40, chords: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [1, 5, 8]], scale: [0, 1, 4, 5, 7, 8, 11], tempo: 4.5, bright: 1200, drums: true },
  ice:   { root: 52, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], scale: [0, 2, 4, 7, 9, 12, 14], tempo: 7, bright: 1800, drums: false },
  swamp: { root: 43, chords: [[0, 3, 7], [0, 3, 8], [-2, 3, 7], [-5, 0, 3]], scale: [0, 2, 3, 6, 7, 8, 11], tempo: 6, bright: 600, drums: true },
  void:  { root: 38, chords: [[0, 3, 6], [1, 4, 7], [-1, 3, 6], [0, 4, 8]], scale: [0, 1, 3, 6, 7, 9, 12], tempo: 5, bright: 1000, drums: false },
  boss:  { root: 38, chords: [[0, 3, 7], [1, 5, 8], [-2, 2, 5], [-1, 3, 6]], scale: [0, 1, 3, 5, 7, 8, 12], tempo: 3.2, bright: 1500, drums: true, fast: true },
};

export function playMusic(name) {
  if (!ctx) return;
  if (musicState && musicState.name === name) return;
  stopMusic();
  const prog = PROGS[name] || PROGS.menu;
  const st = { name, prog, next: ctx.currentTime + 0.2, bar: 0, timer: null };
  musicState = st;
  const schedule = () => {
    if (musicState !== st) return;
    while (st.next < ctx.currentTime + 1.5) {
      const t = st.next;
      const ch = prog.chords[st.bar % prog.chords.length];
      const freqs = ch.map((n) => NOTE(prog.root + 12 + n));
      pad(t, freqs, prog.tempo * 1.15, 0.035, prog.bright);
      // sub drone
      pad(t, [NOTE(prog.root + ch[0])], prog.tempo * 1.1, 0.05, 250);
      // melody: sparse bells on scale
      const notes = prog.fast ? 8 : 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < notes; i++) {
        if (Math.random() < (prog.fast ? 0.55 : 0.6)) {
          const deg = prog.scale[Math.floor(Math.random() * prog.scale.length)];
          bell(t + (i / notes) * prog.tempo + Math.random() * 0.1, NOTE(prog.root + 24 + deg), prog.fast ? 0.035 : 0.05);
        }
      }
      if (prog.drums) {
        const beats = prog.fast ? 8 : 4;
        for (let b = 0; b < beats; b++) {
          const bt = t + (b / beats) * prog.tempo;
          if (b % 2 === 0 || Math.random() < 0.3) drum(bt, b % 4 === 0 ? 45 : 70, b % 4 === 0 ? 0.5 : 0.25);
        }
      }
      st.next += prog.tempo;
      st.bar++;
    }
  };
  schedule();
  st.timer = setInterval(schedule, 400);
}

export function stopMusic() {
  if (musicState) { clearInterval(musicState.timer); musicState = null; }
}

// Ambient bed per biome (wind / rumble / drips)
let ambState = null;
export function playAmbience(kind) {
  if (!ctx) return;
  stopAmbience();
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = { crypt: 300, lava: 120, ice: 900, swamp: 500, void: 200 }[kind] || 300;
  f.Q.value = 0.7;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = f.frequency.value * 0.5;
  lfo.connect(lg); lg.connect(f.frequency);
  const g = ctx.createGain(); g.gain.value = 0.05;
  src.connect(f); f.connect(g); g.connect(musicBus);
  src.start(); lfo.start();
  const st = { src, lfo, timer: null };
  st.timer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (kind === 'crypt' || kind === 'swamp' || kind === 'ice') {
      if (Math.random() < 0.5) tone(t, 0.12, { f0: R(1200, 2200), f1: R(500, 900), gain: 0.04, wet: 0.9, pan: R(-0.8, 0.8), dest: musicBus });
    } else if (kind === 'lava') {
      if (Math.random() < 0.6) noise(t, 0.4, { type: 'lowpass', f0: 400, f1: 80, gain: 0.12, wet: 0.5, dest: musicBus, pan: R(-0.6, 0.6) });
    } else if (kind === 'void') {
      if (Math.random() < 0.4) tone(t, 2, { f0: R(200, 300), f1: R(100, 150), gain: 0.03, attack: 0.6, wet: 0.9, dest: musicBus });
    }
  }, 1300);
  ambState = st;
}
export function stopAmbience() {
  if (!ambState) return;
  try { ambState.src.stop(); ambState.lfo.stop(); } catch (e) { /* ignore */ }
  clearInterval(ambState.timer); ambState = null;
}
