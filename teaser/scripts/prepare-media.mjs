import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffprobe from "@ffprobe-installer/ffprobe";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { writeScore } from "./score.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const footage = join(root, "public", "footage");
const fps = 24;
const bpm = 100;
const list = JSON.parse(readFileSync(join(root, "shot-list.json"), "utf8"));
const chantSource = join(root, "..", "apps", "web", "src", "assets", "audio", "campus-chant.wav");

function prepareMusic(input, destination, length) {
  const offset = Number(process.env.TEASER_MUSIC_OFFSET ?? 0);
  if (!Number.isFinite(offset) || offset < 0) throw new Error("TEASER_MUSIC_OFFSET must be a nonnegative number of seconds.");
  const fadeOut = Math.min(1.35, length / 4);
  const filters = `atrim=start=${offset}:duration=${length},asetpts=PTS-STARTPTS,volume=-3dB,apad,afade=t=in:st=0:d=0.08,afade=t=out:st=${length - fadeOut}:d=${fadeOut}`;
  const result = spawnSync(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-i", resolve(input),
    "-t", String(length), "-vn", "-af", filters, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", destination],
  { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Unable to prepare the teaser soundtrack. ${result.stderr.trim()}`);
}

function source(id) {
  for (const ext of ["mp4", "webm", "mov", "png", "webp", "jpg", "jpeg"]) {
    const filename = `${id}.${ext}`;
    const path = join(footage, filename);
    if (!existsSync(path)) continue;
    if (["png", "webp", "jpg", "jpeg"].includes(ext)) return { filename, duration: null };
    const result = spawnSync(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
    const duration = Number.parseFloat(result.stdout?.trim());
    if (result.status === 0 && duration > 0) return { filename, duration };
    console.warn(`Unreadable media skipped: ${filename}`);
  }
  return null;
}

export function prepareMedia() {
  const sources = new Map(list.filter((shot) => shot.id !== "end").map((shot) => [shot.id, source(shot.id)]));
  const last = sources.get("campus-overview") ?? sources.get("gate") ?? Array.from(sources.values()).find(Boolean);
  if (!last) throw new Error(`Place at least one game clip in ${footage}. See shot-list.json for file names.`);
  let beats = 0;
  let totalFrames = 0;
  const timeline = list.flatMap((shot) => {
    const media = shot.id === "end" ? last : sources.get(shot.id);
    if (!media) return [];
    beats += shot.beats;
    const endFrame = Math.round(beats * 60 / bpm * fps);
    const frames = endFrame - totalFrames;
    totalFrames = endFrame;
    const rate = media.duration === null ? 1 : Math.min(1, (media.duration - Math.min(0.1, media.duration / 10)) / (frames / fps));
    return [{ ...shot, role: shot.role ?? "", src: `footage/${media.filename}`, frames, rate }];
  });
  timeline[0].role = "open";
  const timelineFile = join(root, "src", "timeline.generated.json");
  mkdirSync(dirname(timelineFile), { recursive: true });
  const length = totalFrames / fps;
  const music = process.env.TEASER_MUSIC;
  const destination = join(root, "public", "score.wav");
  if (music) prepareMusic(music, destination, length);
  else writeScore(destination, timeline, fps, bpm);
  if (timeline.some((shot) => shot.role === "chant")) {
    copyFileSync(chantSource, join(root, "public", "campus-chant.wav"));
  }
  writeFileSync(timelineFile, JSON.stringify({
    timeline, fps, externalMusic: Boolean(music), musicCredit: music ? process.env.TEASER_MUSIC_CREDIT ?? "" : "",
  }, null, 2));
  console.log(`${timeline.length} cuts, ${length.toFixed(1)}s at ${fps} fps`);
  return { timeline, fps };
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) prepareMedia();
