import { writeFileSync } from "node:fs";

const sampleRate = 44_100;
const tau = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const mix = (from, to, amount) => from + (to - from) * amount;
const ramp = (n) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

const harmony = [
  { root: 30, notes: [54, 57, 61, 64, 68] },
  { root: 26, notes: [50, 54, 57, 61, 66] },
  { root: 28, notes: [52, 56, 59, 62, 66] },
  { root: 25, notes: [49, 53, 56, 59, 62] },
];
const bassLines = [
  [[0, 0, 0.76], [0.91, 12, 0.27], [1.5, 7, 0.39], [2.04, 0, 0.66], [2.84, 0, 0.25], [3.37, 3, 0.38]],
  [[0, 0, 0.95], [1.15, 7, 0.27], [1.57, 12, 0.24], [2, 0, 0.5], [2.79, 7, 0.33], [3.5, 0, 0.37]],
  [[0, 0, 0.65], [0.78, 12, 0.35], [1.51, 7, 0.34], [2, 0, 0.69], [2.82, 0, 0.22], [3.34, 2, 0.48]],
  [[0, 0, 0.8], [0.94, 7, 0.25], [1.42, 10, 0.35], [2, 12, 0.47], [2.58, 0, 0.4], [3.24, 7, 0.45]],
];
const leadLines = [
  [[0.43, 73, 0.50, -5], [1.34, 78, 0.92, -2], [2.74, 76, 0.32, 2], [3.20, 81, 0.53, -3]],
  [[0.25, 76, 0.75, 3], [1.72, 73, 0.36, -2], [2.55, 78, 0.52, -2], [3.21, 81, 0.37, -3]],
  [[0.42, 83, 0.81, -2], [1.58, 80, 0.48, 3], [2.43, 76, 0.32, 4], [3.05, 78, 0.68, -2]],
  [[0.35, 73, 0.44, 5], [1.12, 74, 0.51, -1], [2.12, 77, 0.31, -4], [2.78, 80, 0.66, -3]],
];

const groups = ["drums", "bass", "keys", "lead", "fx"];
const scenes = {
  open: { drums: 0.75, bass: 0.95, keys: 1.03, lead: 0.64, fx: 1 },
  drive: { drums: 1.12, bass: 1.18, keys: 0.82, lead: 1.06, fx: 1.1 },
  chant: { drums: 0.23, bass: 0.34, keys: 0.49, lead: 0.04, fx: 0.11 },
  inside: { drums: 0.69, bass: 0.76, keys: 1.08, lead: 0.54, fx: 0.92 },
  end: { drums: 0.53, bass: 0.80, keys: 1.11, lead: 0.70, fx: 0.94 },
};

export function writeScore(path, timeline, fps, bpm) {
  let frame = 0;
  const cues = timeline.flatMap(({ role, frames }) => {
    const start = frame / fps;
    frame += frames;
    return role && scenes[role] ? [{ role, start, end: frame / fps }] : [];
  });
  const duration = frame / fps;
  const length = Math.ceil(duration * sampleRate);
  const tracks = Object.fromEntries(groups.map((name) => [name, {
    left: new Float32Array(length), right: new Float32Array(length),
  }]));
  const beat = 60 / bpm;
  const kickTimes = [];
  let seed = 16831;

  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }

  function add(group, at, seconds, volume, pan, waveform) {
    const start = Math.round(at * sampleRate);
    const count = Math.min(Math.round(seconds * sampleRate), length - start);
    const { left, right } = tracks[group];
    const gainLeft = volume * Math.sqrt((1 - pan) / 2);
    const gainRight = volume * Math.sqrt((1 + pan) / 2);
    for (let index = 0; index < count; index++) {
      const signal = waveform(index / sampleRate);
      left[start + index] += signal * gainLeft;
      right[start + index] += signal * gainRight;
    }
  }

  function kick(at, level) {
    kickTimes.push(at);
    add("drums", at, 0.4, level, 0, (t) => {
      const sweep = tau * (45 * t + 76 * (1 - Math.exp(-32 * t)) / 32);
      const low = Math.sin(sweep) * Math.exp(-10 * t);
      const mid = Math.sin(sweep * 1.96) * Math.exp(-21 * t) * 0.22;
      const knock = (Math.sin(tau * 1560 * t) * 0.43 + noise() * 0.32) * Math.exp(-188 * t);
      return (low + mid + knock) * clamp(t * 490);
    });
  }

  function snare(at, level) {
    let dull = 0;
    let bright = 0;
    add("drums", at, 0.26, level, -0.04, (t) => {
      const raw = noise();
      dull += (raw - dull) * 0.13;
      bright += (raw - bright) * 0.55;
      const crack = (bright - dull) * (Math.exp(-28 * t) + 0.48 * Math.exp(-155 * Math.abs(t - 0.014)) +
        0.36 * Math.exp(-185 * Math.abs(t - 0.028)));
      const shell = (Math.sin(tau * (174 * t + 0.25 * (1 - Math.exp(-88 * t)))) +
        0.43 * Math.sin(tau * 263 * t)) * 0.54 * Math.exp(-36 * t);
      return (crack + shell) * clamp(t * 800);
    });
    add("drums", at + 0.022, 0.28, level * 0.20, 0.55, (t) => noise() * clamp(t * 240) * Math.exp(-16 * t));
  }

  function hat(at, level, pan, decay) {
    let low = 0;
    add("drums", at, 0.27, level, pan, (t) => {
      const raw = noise();
      low += (raw - low) * 0.55;
      const metal = Math.sin(tau * 4378 * t + Math.sin(tau * 899 * t)) + 0.48 * Math.sin(tau * 6227 * t);
      return ((raw - low) * 0.74 + metal * 0.14) * clamp(t * 680) * Math.exp(-decay * t);
    });
  }

  function bass(at, note, beats, previous) {
    const seconds = beats * beat;
    const frequency = hz(note);
    const from = hz(previous);
    let phase = 0;
    add("bass", at, seconds, 0.40, 0, (t) => {
      phase += tau * mix(frequency, from, Math.exp(-43 * t)) / sampleRate;
      const shape = Math.sin(phase) + 0.38 * Math.sin(2 * phase + 0.20) +
        0.21 * Math.sin(3 * phase) + 0.095 * Math.sin(5 * phase + 0.1);
      const envelope = clamp(t / 0.013) * clamp((seconds - t) / 0.083) * (0.73 + 0.27 * Math.exp(-5 * t));
      return Math.tanh(shape) * envelope;
    });
  }

  function keys(at, notes, beats, volume, sustain = false) {
    const seconds = beats * beat;
    for (const [index, note] of notes.entries()) {
      const frequency = hz(note);
      const pan = (index - (notes.length - 1) / 2) * 0.28;
      add("keys", at, seconds, volume, pan, (t) => {
        const angle = tau * frequency * t;
        const body = Math.sin(angle + 0.14 * Math.sin(tau * 2.7 * t + index));
        const chorus = Math.sin(angle * (1 + pan * 0.007) + 0.24);
        const tine = Math.sin(angle * 2.002 + 0.54 * Math.sin(angle)) * Math.exp(-9 * t);
        const envelope = clamp(t / (sustain ? 0.14 : 0.012)) * clamp((seconds - t) / 0.11);
        const decay = sustain ? 0.74 + 0.26 * Math.exp(-1.5 * t) : Math.exp(-3.9 * t);
        return (0.62 * body + 0.20 * chorus + 0.23 * tine) * envelope * decay;
      });
    }
  }

  function whistle(at, note, beats, bend, level, pan) {
    const seconds = beats * beat;
    let phase = 0;
    add("lead", at, seconds, level, pan, (t) => {
      const glide = bend * Math.exp(-14 * t);
      const vibrato = 0.18 * Math.sin(tau * 5.6 * t) * ramp((t - 0.08) / 0.2);
      phase += tau * hz(note + glide + vibrato) / sampleRate;
      const fundamental = Math.sin(phase + 0.12 * Math.sin(phase * 2));
      const bite = 0.28 * Math.sin(phase * 2) + 0.11 * Math.sin(phase * 3 + 0.23) + 0.04 * Math.sin(phase * 4);
      const tail = clamp((seconds - t) / 0.10);
      return (fundamental + bite) * ramp(t / 0.036) * tail * (1 - 0.14 * clamp(t / seconds));
    });
  }

  let previousBass = harmony[0].root;
  for (let bar = 0; bar * 4 * beat < duration; bar++) {
    const start = bar * 4 * beat;
    const chord = harmony[bar % harmony.length];
    const intro = bar === 0;
    const pickup = bar % 8 === 7;
    const syncopation = bar % 2 ? [0, 0.75, 2, 2.67, 3.50] : [0, 1.45, 2.03, 2.85, 3.65];
    for (const [index, offset] of syncopation.entries()) {
      if (!intro || index === 0 || index === 2) kick(start + offset * beat, index === 0 ? 0.72 : 0.62 - index * 0.027);
    }
    for (const offset of [1.01, 3.04]) snare(start + offset * beat, intro ? 0.29 : 0.49);
    if (pickup) snare(start + 3.72 * beat, 0.24);
    for (let step = 0; step < 8; step++) {
      const offBeat = step % 2 === 1;
      const open = step === 3 || step === 7 && pickup;
      hat(start + (step / 2 + (offBeat ? 0.044 : 0)) * beat, open ? 0.13 : offBeat ? 0.089 : 0.125,
        offBeat ? 0.30 : -0.30, open ? 19 : 62);
    }
    keys(start, chord.notes.slice(1), 4.04, 0.055, true);
    for (const offset of [0.59, 1.89, 3.16]) keys(start + offset * beat, chord.notes, 0.42, 0.073);
    for (const [offset, pitch, beats] of bassLines[bar % bassLines.length]) {
      const note = chord.root + pitch;
      bass(start + offset * beat, note, beats, offset === 0 ? previousBass : note - 2);
      previousBass = note;
    }
    for (const [index, [offset, note, beats, bend]] of leadLines[bar % leadLines.length].entries()) {
      if (bar % 8 === 5 && index > 1) continue;
      const pan = index % 2 ? 0.12 : -0.13;
      whistle(start + offset * beat, note, beats, bend, 0.165, pan);
      whistle(start + (offset + 0.75) * beat, note, beats * 0.8, bend, 0.036, -pan * 3.9);
    }
  }

  for (const { role, start } of cues) {
    if (role === "open" || role === "chant") continue;
    const span = Math.min(start, role === "drive" ? 0.55 : 0.38);
    let low = 0;
    add("fx", start - span, span, 0.41, -0.10, (t) => {
      low += (noise() - low) * 0.19;
      const progress = t / span;
      return (low + 0.11 * Math.sin(tau * (80 * t + 120 * t * t))) * progress * progress;
    });
    add("fx", start, 0.62, 0.42, 0, (t) => Math.sin(tau * (42 * t + 18 * (1 - Math.exp(-18 * t)) / 18)) *
      clamp(t * 160) * Math.exp(-8.7 * t));
  }
  kickTimes.sort((a, b) => a - b);

  const dataSize = length * 4;
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

  let cueIndex = 0;
  let kickIndex = -1;
  for (let index = 0; index < length; index++) {
    const t = index / sampleRate;
    while (cues[cueIndex]?.end <= t) cueIndex++;
    while (kickTimes[kickIndex + 1] <= t) kickIndex++;
    const cue = cues[cueIndex];
    const leadIn = cue?.role === "chant" ? 0.20 : 0.09;
    const cueMix = cue ? ramp((t - cue.start + leadIn) / (leadIn + 0.04)) * ramp((cue.end - t) / 0.24) : 0;
    const afterKick = t - (kickTimes[kickIndex] ?? -1);
    const recover = 1 - 0.24 * Math.exp(-14 * afterKick);
    const drivePickup = cue?.role === "drive" ? 1 - 0.60 * cueMix * (1 - ramp((t - cue.start) / 0.045)) : 1;
    let left = 0;
    let right = 0;
    for (const group of groups) {
      const sidechain = group === "bass" || group === "keys" ? recover : 1;
      const gain = mix(1, cue ? scenes[cue.role][group] : 1, cueMix) * sidechain * drivePickup;
      left += tracks[group].left[index] * gain;
      right += tracks[group].right[index] * gain;
    }
    const envelope = clamp(t / 0.04) * ramp((duration - t) / 1.12);
    file.writeInt16LE(Math.round(Math.tanh(left * 1.23) * envelope * 31_500), 44 + index * 4);
    file.writeInt16LE(Math.round(Math.tanh(right * 1.23) * envelope * 31_500), 46 + index * 4);
  }
  writeFileSync(path, file);
}
