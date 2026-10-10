// Synthesizes the game's sound effects as small 16-bit mono WAVs. Deterministic.
import { writeFileSync } from 'node:fs';
const RATE = 22050;
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function wav(samples) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * g)) * 32767), 44 + i * 2);
  return b;
}

/** Renders `dur` seconds of fn(t, i) with a short fade-in/out to avoid clicks. */
function render(dur, fn) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const fade = Math.min(1, i / 40, (n - i) / 200);
    out[i] = fn(t, i) * fade;
  }
  return out;
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sine = (ph) => Math.sin(ph * 2 * Math.PI);
const tri = (ph) => 1 - 4 * Math.abs((ph % 1) - 0.5);
const sq = (ph) => ((ph % 1) < 0.5 ? 1 : -1);
// pitch sweep: phase of an exponential glide f0 -> f1 over dur
const glide = (t, f0, f1, dur) => {
  const k = Math.log(f1 / f0) / dur;
  return Math.abs(k) < 1e-6 ? f0 * t : (f0 * (Math.exp(k * Math.min(t, dur)) - 1)) / k + (t > dur ? f1 * (t - dur) : 0);
};
function lowpass(x, a) { let y = 0; return x.map((v) => (y += a * (v - y))); }
function notes(freqs, each, wave, decay, tail = 0) {
  return render(freqs.length * each + tail, (t) => {
    let s = 0;
    freqs.forEach((f, k) => {
      const tt = t - k * each;
      if (tt >= 0) s += wave(f * tt) * env(tt, 0.005, decay) * 0.5 + wave(2 * f * tt) * env(tt, 0.005, decay * 0.5) * 0.12;
    });
    return s;
  });
}

const sounds = {
  arrow: render(0.16, (t) => sine(glide(t, 1100, 260, 0.12)) * env(t, 0.002, 0.04) * 0.7 + rand() * env(t, 0.001, 0.025) * 0.5),
  cannon: lowpass(render(0.45, (t) => sine(glide(t, 140, 38, 0.3)) * env(t, 0.003, 0.14) + rand() * env(t, 0.001, 0.07) * 0.9), 0.35),
  frost: render(0.4, (t) => (sine(1320 * t) * 0.5 + sine(1980 * t + 0.3 * sine(7 * t)) * 0.35 + sine(2640 * t) * 0.15) * env(t, 0.004, 0.11)),
  hit: lowpass(render(0.07, (t) => rand() * env(t, 0.001, 0.018) + sine(220 * t) * env(t, 0.001, 0.03) * 0.5), 0.5),
  die: render(0.2, (t) => sine(glide(t, 720, 180, 0.15)) * env(t, 0.003, 0.06) + rand() * env(t, 0.001, 0.02) * 0.3),
  leak: render(0.42, (t) => sq(glide(t, 220, 110, 0.4)) * env(t, 0.01, 0.2) * 0.4),
  place: lowpass(render(0.22, (t) => sine(glide(t, 200, 80, 0.15)) * env(t, 0.002, 0.07) + rand() * env(t, 0.001, 0.03) * 0.6), 0.4),
  upgrade: notes([523, 659, 784, 1047], 0.065, tri, 0.12, 0.15),
  sell: notes([988, 1319], 0.08, sq, 0.1, 0.12),
  wave: lowpass(render(0.65, (t) => {
    const vib = 0.006 * sine(6 * t);
    return (tri(220 * t * (1 + vib)) * 0.6 + tri(330 * t * (1 + vib)) * 0.4) * env(t, 0.06, 0.35);
  }), 0.25),
  clear: notes([659, 784, 988, 1319], 0.08, tri, 0.18, 0.2),
  lose: notes([392, 330, 262, 196], 0.16, tri, 0.25, 0.3),
  win: notes([523, 659, 784, 1047, 784, 1047], 0.11, tri, 0.22, 0.4),
  click: render(0.04, (t) => sine(1800 * t) * env(t, 0.001, 0.01)),
  error: render(0.22, (t) => sq(150 * t) * (t < 0.08 || (t > 0.12 && t < 0.2) ? 1 : 0) * 0.35),
};

const out = process.argv[2];
let total = 0;
for (const [name, s] of Object.entries(sounds)) {
  const b = wav(s);
  total += b.length;
  writeFileSync(`${out}/${name}.wav`, b);
}
console.log(Object.keys(sounds).length, 'sounds,', (total / 1024).toFixed(0), 'KB');
