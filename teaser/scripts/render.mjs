import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { prepareMedia } from "./prepare-media.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "output");
const clip = join(output, "teaser-render.mp4");
const final = join(output, "GTA MMMUT - Teaser - Priyanshu Chaurasia.mp4");
const cliFolder = join(root, "node_modules", "@remotion", "cli");
const cli = JSON.parse(readFileSync(join(cliFolder, "package.json"), "utf8")).bin.remotion;
const chrome = [process.env.TEASER_CHROME, process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
  .filter(Boolean)
  .map((path, index) => index === 0 && path === process.env.TEASER_CHROME ? path : join(path, "Google", "Chrome", "Application", "chrome.exe"))
  .find(existsSync);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

prepareMedia();
mkdirSync(output, { recursive: true });
const browser = chrome ? [`--browser-executable=${chrome}`] : [];
if (process.argv.includes("--still")) {
  run(process.execPath, [join(cliFolder, cli), "still", "src/index.tsx", "GtaMmmutTeaser", join(output, "title.png"), "--frame=38", ...browser]);
} else {
  const scale = process.env.TEASER_SCALE ? [`--scale=${process.env.TEASER_SCALE}`] : [];
  run(process.execPath, [join(cliFolder, cli), "render", "src/index.tsx", "GtaMmmutTeaser", clip,
    "--codec=h264", "--crf=18", "--image-format=jpeg", "--jpeg-quality=95", "--concurrency=2",
    "--offthreadvideo-video-threads=1", "--timeout=120000", "--log=warn", ...scale, ...browser]);
  run(ffmpeg.path, ["-hide_banner", "-loglevel", "warning", "-y", "-i", clip,
    "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-movflags", "+faststart",
    "-metadata", "title=GTA MMMUT — Campus Teaser", "-metadata", "artist=Priyanshu Chaurasia", final]);
  console.log(final);
}
