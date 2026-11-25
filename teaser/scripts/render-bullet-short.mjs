import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const root = fileURLToPath(new URL("..", import.meta.url));
const music = process.env.BULLET_SHORT_MUSIC ?? join(root, "..", "references", "review", "bullet-chai-score.wav");
const footage = join(root, "public", "footage");
const output = join(root, "output");
const final = join(output, "GTA MMMUT - One Ride Two Chais - Shorts.mp4");
const intermediate = join(output, "bullet-short-render.mp4");
const clips = ["hook", "meet", "ignition", "side", "chase", "west", "arrive", "door", "cafe", "chai", "table"];

function run(file, args) {
  const result = spawnSync(file, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Render command exited with ${result.status}`);
}

function envelope(time, start, end, rise = 0.15, fall = 0.25) {
  return Math.max(0, Math.min(1, (time - start) / rise, (end - time) / fall));
}

function writeFoley(path) {
  const sampleRate = 48_000;
  const frames = 45 * sampleRate;
  const wave = Buffer.alloc(44 + 4 * frames);
  wave.write("RIFF", 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(2, 22);
  wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 4, 28);
  wave.writeUInt16LE(4, 32); wave.writeUInt16LE(16, 34); wave.write("data", 36); wave.writeUInt32LE(frames * 4, 40);
  let seed = 12_098;
  let pulsePhase = 0;
  let air = 0;
  const tau = 2 * Math.PI;
  const transitions = [2.5, 7.5, 17.5, 20, 27.5, 40];
  function exhaust(time) {
    return Math.min(1, time * 310) * Math.exp(-time * 49) *
      (0.75 * Math.sin(tau * 65 * time) + 0.24 * Math.sin(tau * 142 * time) + 0.15 * Math.sin(tau * 310 * time));
  }
  for (let i = 0; i < frames; i++) {
    const time = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2_147_483_648 - 1;
    air += (noise - air) * 0.078;
    const rev = Math.max(0, Math.min(1, (time - 5.28) / 3.3, (23.2 - time) / 3.4));
    const pitch = (7.3 + 7.1 * rev + 1.4 * Math.sin(time * 1.42) * rev);
    pulsePhase = (pulsePhase + pitch / sampleRate) % 1;
    const engineGain = 0.29 * envelope(time, 0, 2.45, 0.06) + (0.18 + 0.26 * rev) *
      envelope(time, 5.06, 23.18, 0.11, 1.3);
    const engine = engineGain * (exhaust(pulsePhase / pitch) + 0.77 * exhaust(((pulsePhase + 0.5625) % 1) / pitch));
    let sweep = 0;
    for (const cut of transitions) {
      const gap = time - cut + 0.13;
      if (gap > 0 && gap < 0.30) sweep += 0.30 * Math.sin(Math.PI * gap / 0.30) * air;
    }
    let cups = 0;
    for (const tap of [31.61, 34.48, 36.15]) {
      const age = time - tap;
      if (age >= 0 && age < 0.21) cups += Math.min(1, age * 1500) * Math.exp(-age * 31) *
        (0.08 * Math.sin(tau * 1280 * age) + 0.04 * Math.sin(tau * 2175 * age));
    }
    const road = envelope(time, 7.7, 21.7, 0.5, 1.0) * air * 0.075;
    const sample = engine + cups + road;
    const index = 44 + i * 4;
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample + sweep)) * 32760), index);
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample + sweep * 0.84)) * 32760), index + 2);
  }
  writeFileSync(path, wave);
}

if (!existsSync(music)) throw new Error("Generate the 45-second score with teaser/scripts/bullet-short-score.py first.");
for (const clip of clips) {
  if (!existsSync(join(footage, `short-${clip}.mp4`))) throw new Error(`Missing in-game footage: short-${clip}.mp4`);
}
mkdirSync(output, { recursive: true });
const foley = join(footage, "short-foley.wav");
writeFoley(foley);
run(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-i", music, "-i", foley, "-t", "45",
  "-filter_complex", "[0:a]volume=0.81[m];[1:a]volume=1.15[f];[m][f]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-15:TP=-1.5:LRA=9",
  "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", join(footage, "short-mix.wav")]);

const cliFolder = join(root, "node_modules", "@remotion", "cli");
const cli = JSON.parse(readFileSync(join(cliFolder, "package.json"), "utf8")).bin.remotion;
const chrome = [process.env.TEASER_CHROME, ...[process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
  .filter(Boolean).map((folder) => join(folder, "Google", "Chrome", "Application", "chrome.exe"))]
  .filter(Boolean).find(existsSync);
const browser = chrome ? [`--browser-executable=${chrome}`] : [];
run(process.execPath, [join(cliFolder, cli), "render", "src/bullet-short.tsx", "BulletChaiShort", intermediate,
  "--codec=h264", "--crf=17", "--image-format=jpeg", "--jpeg-quality=94", "--concurrency=2",
  "--offthreadvideo-video-threads=1", "--timeout=120000", "--log=warn", ...browser]);
run(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-i", intermediate, "-map", "0:v:0", "-map", "0:a:0",
  "-c", "copy", "-movflags", "+faststart", "-metadata", "title=GTA MMMUT — One Ride, Two Chais",
  "-metadata", "artist=Priyanshu Chaurasia", final]);
console.log(final);
