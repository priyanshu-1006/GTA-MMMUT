import { writeFileSync } from "node:fs";

const sampleRate = 44100;
const tau = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const progression = [[38, 53, 57, 60], [34, 50, 53, 57], [36, 52, 55, 59], [31, 50, 55, 58]];
const motif = [69, 72, 74, 76, 74, 69, 67, 72, 65, 69, 72, 74];

export function writeScore(path, timeline, fps, bpm) {
  const duration = timeline.reduce((sum, shot) => sum + shot.frames, 0) / fps;
  const left = new Float32Array(Math.ceil(duration * sampleRate));
  const right = new Float32Array(left.length);
  const beat = 60 / bpm;
  let seed = 16831;

  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }

  function add(start, length, volume, pan, waveform) {
    const first = Math.round(start * sampleRate);
    const count = Math.min(Math.round(length * sampleRate), left.length - first);
    const l = volume * Math.sqrt((1 - pan) / 2);
    const r = volume * Math.sqrt((1 + pan) / 2);
    for (let index = 0; index < count; index++) {
      const signal = waveform(index / sampleRate, index);
      left[first + index] += signal * l;
      right[first + index] += signal * r;
    }
  }

  function thump(at, volume) {
    add(at, 0.42, volume, 0, (t) => {
      const phase = tau * (46 * t + 65 * (1 - Math.exp(-31 * t)) / 31);
      return Math.sin(phase) * Math.min(1, 210 * t) * Math.exp(-12 * t);
    });
  }

  function snap(at, volume) {
    let previous = 0;
    add(at, 0.24, volume, -0.11, (t) => {
      const n = noise();
      const high = n - previous * 0.59;
      previous = n;
      const pulse = Math.exp(-t * 29) + 0.56 * Math.exp(-Math.abs(t - 0.014) * 160);
      return high * pulse * 0.59 + Math.sin(tau * 176 * t) * Math.exp(-39 * t) * 0.36;
    });
  }

  function shaker(at, volume, pan, decay) {
    let last = 0;
    add(at, 0.12, volume, pan, (t) => {
      const n = noise();
      const sample = n - last;
      last = n;
      return sample * Math.exp(-t * decay) * Math.min(1, t * 550);
    });
  }

  function pluck(at, note, volume, pan) {
    const frequency = hz(note);
    add(at, 0.64, volume, pan, (t) => {
      const angle = tau * frequency * t;
      const body = Math.sin(angle + 1.35 * Math.exp(-t * 9) * Math.sin(angle * 2));
      return (body + Math.sin(angle * 2.002) * 0.17) * Math.min(1, 260 * t) * Math.exp(-t * 5.6);
    });
  }

  for (let bar = 0; bar * 4 * beat < duration; bar++) {
    const start = bar * 4 * beat;
    const [root, ...chord] = progression[bar % progression.length];
    for (const [index, note] of chord.entries()) {
      const frequency = hz(note);
      add(start, 4.22 * beat, bar === 0 ? 0.12 : 0.095, (index - 1) * 0.58, (t) => {
        const attack = Math.min(1, t / 0.41);
        const release = Math.min(1, (4.22 * beat - t) / 0.34);
        const vibrato = 0.17 * Math.sin(tau * 0.38 * t + index);
        const angle = tau * frequency * t + vibrato;
        return (Math.sin(angle) + 0.19 * Math.sin(2 * angle) + 0.1 * Math.sin(angle * 3.01)) * attack * release;
      });
    }
    const intro = bar === 0;
    const breakBar = bar % 8 === 6;
    for (const [index, at] of [0, 1.5, 2.0, 3.25].entries()) {
      if (intro && index > 0) continue;
      thump(start + at * beat, breakBar ? 0.25 : 0.41);
      const frequency = hz(root + (index === 3 ? 7 : index === 2 ? 12 : 0));
      add(start + at * beat, beat * 0.76, intro ? 0.18 : 0.26, 0, (t) => {
        const wave = Math.sin(tau * frequency * t) + 0.25 * Math.sin(tau * frequency * t * 2 + 0.3);
        return wave * Math.min(1, t * 110) * Math.exp(-t * 5.3);
      });
    }
    for (const at of [1, 3]) if (!intro) snap(start + at * beat, breakBar ? 0.10 : 0.20);
    for (let index = 0; index < 8; index++) {
      if (intro && index % 2 === 1) continue;
      shaker(start + (index / 2 + (index % 2) * 0.058) * beat, index % 2 ? 0.055 : 0.089, index % 2 ? 0.28 : -0.24, index % 2 ? 41 : 52);
    }
    for (const [index, at] of [0, 0.75, 1.5, 2.75].entries()) {
      if (bar > 0 && (bar + index) % 5 === 4) continue;
      const note = motif[(bar * 3 + index) % motif.length];
      pluck(start + at * beat, note, intro ? 0.12 : 0.088, index % 2 ? 0.4 : -0.3);
      pluck(start + (at + 0.75) * beat, note, 0.028, index % 2 ? -0.52 : 0.53);
    }
  }

  let frame = 0;
  for (const shot of timeline) {
    const at = frame / fps;
    frame += shot.frames;
    if (!shot.role || shot.role === "open") continue;
    let smooth = 0;
    const begin = Math.max(0, at - 0.42);
    add(begin, at - begin, 0.135, 0.25, (t) => {
      smooth = (smooth + noise() * 0.19) * 0.79;
      const rise = Math.min(1, t / 0.42);
      return smooth * rise * rise;
    });
    thump(at, 0.29);
  }

  const dataSize = left.length * 4;
  const file = Buffer.alloc(44 + dataSize);
  file.write("RIFF", 0);
  file.writeUInt32LE(36 + dataSize, 4);
  file.write("WAVEfmt ", 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(2, 22);
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 4, 28);
  file.writeUInt16LE(4, 32);
  file.writeUInt16LE(16, 34);
  file.write("data", 36);
  file.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < left.length; index++) {
    const time = index / sampleRate;
    const envelope = Math.min(1, time / 0.18, (duration - time) / 1.16);
    const quiet = noise() * 0.0023;
    file.writeInt16LE(Math.round(Math.tanh((left[index] + quiet) * 1.18) * envelope * 30100), 44 + index * 4);
    file.writeInt16LE(Math.round(Math.tanh((right[index] + quiet) * 1.18) * envelope * 30100), 46 + index * 4);
  }
  writeFileSync(path, file);
}
