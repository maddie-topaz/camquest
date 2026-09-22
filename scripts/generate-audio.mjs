// Synthesises the chiptune cue palette into public/audio/*.wav so the game
// has working sound without any recorded assets. Re-run after editing a
// recipe; replace any file with a real recording whenever you like.
//
//   node scripts/generate-audio.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 22050;
const out = join(process.cwd(), "public", "audio");
mkdirSync(out, { recursive: true });

const note = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI → Hz

// Oscillators, all in [-1, 1].
const square = (t, f, duty = 0.5) => ((t * f) % 1 < duty ? 1 : -1);
const triangle = (t, f) =>
  1 - 4 * Math.abs(Math.round(t * f - 0.25) - (t * f - 0.25));
const noise = () => Math.random() * 2 - 1;

// A tone: frequency (or a function of progress for sweeps), duration, envelope.
const tone = ({
  freq,
  ms,
  osc = square,
  attack = 0.005,
  release = 0.06,
  gain = 0.5,
  duty,
}) => {
  const length = Math.round((RATE * ms) / 1000);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const p = i / length;
    const f = typeof freq === "function" ? freq(p) : freq;
    const env =
      Math.min(1, t / attack) * Math.min(1, (length - i) / RATE / release);
    samples[i] = osc(t, f, duty) * env * gain;
  }
  return samples;
};

const silence = (ms) => new Float32Array(Math.round((RATE * ms) / 1000));
const concat = (parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};
const mix = (a, b) => {
  const result = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < result.length; i++) result[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return result;
};
const arpeggio = (notes, ms, opts = {}) =>
  concat(notes.map((n) => tone({ freq: note(n), ms, ...opts })));

const recipes = {
  "game-start": () =>
    arpeggio([72, 76, 79, 84], 70, { gain: 0.45, release: 0.03 }),
  "inventory-open": () =>
    tone({
      freq: (p) => 220 + 880 * p,
      ms: 260,
      osc: triangle,
      gain: 0.5,
      release: 0.08,
    }),
  "item-acquired": () =>
    concat([
      tone({ freq: note(81), ms: 45, gain: 0.5 }),
      tone({ freq: note(88), ms: 90, gain: 0.45 }),
    ]),
  "inventory-ready": () =>
    concat([
      tone({ freq: note(79), ms: 90, osc: triangle, gain: 0.5 }),
      tone({
        freq: note(86),
        ms: 180,
        osc: triangle,
        gain: 0.5,
        release: 0.12,
      }),
    ]),
  "inventory-accepted": () =>
    concat([
      tone({ freq: note(79), ms: 70, gain: 0.45 }),
      tone({ freq: note(84), ms: 70, gain: 0.45 }),
      tone({ freq: note(91), ms: 200, gain: 0.4, release: 0.14 }),
    ]),
  "inventory-error": () =>
    concat([
      tone({ freq: (p) => 330 - 110 * p, ms: 160, gain: 0.45, duty: 0.25 }),
      silence(40),
      tone({ freq: (p) => 220 - 90 * p, ms: 220, gain: 0.45, duty: 0.25 }),
    ]),
  "checkpoint-unlocked": () =>
    concat([
      tone({ freq: note(76), ms: 60, osc: triangle, gain: 0.5 }),
      tone({ freq: note(83), ms: 60, osc: triangle, gain: 0.5 }),
      tone({ freq: note(88), ms: 160, osc: triangle, gain: 0.5, release: 0.1 }),
    ]),
  "checkpoint-denied": () =>
    concat([
      tone({ freq: 140, ms: 90, gain: 0.4, duty: 0.2 }),
      silence(50),
      tone({ freq: 120, ms: 140, gain: 0.4, duty: 0.2 }),
    ]),
  "choice-select": () =>
    tone({ freq: note(88), ms: 40, osc: triangle, gain: 0.45, release: 0.02 }),
  "choice-locked": () =>
    mix(
      tone({ freq: (p) => 500 - 380 * p, ms: 120, gain: 0.5 }),
      tone({ freq: 60, ms: 120, osc: noise, gain: 0.12 }),
    ),
  "step-advance": () =>
    concat([
      tone({ freq: note(84), ms: 50, gain: 0.4 }),
      tone({ freq: note(91), ms: 80, gain: 0.35 }),
    ]),
  "quest-complete": () =>
    concat([
      arpeggio([72, 76, 79], 80, { gain: 0.45 }),
      tone({ freq: note(84), ms: 220, gain: 0.45 }),
      arpeggio([79, 84], 80, { gain: 0.45 }),
      tone({ freq: note(88), ms: 420, gain: 0.45, release: 0.25 }),
    ]),
  "encounter-start": () =>
    tone({
      freq: (p) => 160 + 600 * p * p,
      ms: 420,
      osc: triangle,
      gain: 0.45,
      release: 0.1,
    }),
  "encounter-hit": () =>
    concat([
      tone({ freq: note(86), ms: 50, gain: 0.5 }),
      tone({ freq: note(93), ms: 110, gain: 0.45, release: 0.07 }),
    ]),
  "encounter-miss": () =>
    tone({ freq: (p) => 260 - 140 * p, ms: 170, gain: 0.4, duty: 0.3 }),
  "encounter-complete": () =>
    concat([
      arpeggio([76, 79, 84, 88], 60, { gain: 0.45 }),
      tone({ freq: note(91), ms: 300, gain: 0.45, release: 0.18 }),
    ]),
};

const toWav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++)
    data.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767),
      i * 2,
    );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

let total = 0;
for (const [name, recipe] of Object.entries(recipes)) {
  const wav = toWav(recipe());
  writeFileSync(join(out, `${name}.wav`), wav);
  total += wav.length;
  console.log(
    `  ${name.padEnd(22)} ${(wav.length / 1024).toFixed(1).padStart(6)} KB`,
  );
}
console.log(
  `✓ ${Object.keys(recipes).length} cues, ${(total / 1024).toFixed(0)} KB total → public/audio`,
);
