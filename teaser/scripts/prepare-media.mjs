import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ffprobe from "@ffprobe-installer/ffprobe";
import { writeScore } from "./score.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const footage = join(root, "public", "footage");
const fps = 24;
const bpm = 100;
const list = JSON.parse(readFileSync(join(root, "shot-list.json"), "utf8"));

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
  const timeline = list.flatMap((shot) => {
    const media = shot.id === "end" ? last : sources.get(shot.id);
    if (!media) return [];
    const frames = Math.round(shot.beats * 60 / bpm * fps);
    const rate = media.duration === null ? 1 : Math.min(1, (media.duration - Math.min(0.1, media.duration / 10)) / (frames / fps));
    return [{ ...shot, role: shot.role ?? "", src: `footage/${media.filename}`, frames, rate }];
  });
  timeline[0].role = "open";
  const timelineFile = join(root, "src", "timeline.generated.json");
  mkdirSync(dirname(timelineFile), { recursive: true });
  writeFileSync(timelineFile, JSON.stringify({ timeline, fps }, null, 2));
  writeScore(join(root, "public", "score.wav"), timeline, fps, bpm);
  const length = timeline.reduce((sum, shot) => sum + shot.frames, 0) / fps;
  console.log(`${timeline.length} cuts, ${length.toFixed(1)}s at ${fps} fps`);
  return { timeline, fps };
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) prepareMedia();
