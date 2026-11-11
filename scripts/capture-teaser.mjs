import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build, preview } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const onlyStills = args.includes("--stills-only");
const raw = args.includes("--raw");
const shots = args.filter((arg) => !arg.startsWith("--"));
const width = Number(process.env.CAMPUS_CAPTURE_WIDTH ?? 960);
const height = Number(process.env.CAMPUS_CAPTURE_HEIGHT ?? 540);
const fps = Number(process.env.CAMPUS_CAPTURE_FPS ?? 24);
const seconds = Number(process.env.CAMPUS_CAPTURE_SECONDS ?? 3.5);
const port = Number(process.env.CAMPUS_CAPTURE_PORT ?? 5192);
const web = path.join(root, "apps/web");
const captureBuild = path.resolve(root, process.env.CAMPUS_CAPTURE_BUILD ?? "test-results/teaser-capture-dist");
const output = path.resolve(root, process.env.CAMPUS_CAPTURE_OUTPUT ?? "teaser/public/footage");
const stills = path.resolve(root, process.env.CAMPUS_CAPTURE_STILLS ?? "test-results/teaser-stills");
const teaserRequire = createRequire(new URL("../teaser/package.json", import.meta.url));

function findFfmpeg() {
  if (process.env.CAMPUS_FFMPEG) return process.env.CAMPUS_FFMPEG;
  try {
    return teaserRequire("@ffmpeg-installer/ffmpeg").path;
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    return "ffmpeg";
  }
}

const ffmpeg = onlyStills || raw ? undefined : findFfmpeg();

async function writeMp4(data, destination) {
  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps),
      "-f", "h264", "-i", "pipe:0", "-an", "-c:v", "copy", "-movflags", "+faststart", destination],
    { stdio: ["pipe", "ignore", "inherit"], windowsHide: true });
    ff.once("error", (error) => reject(error.code === "ENOENT"
      ? new Error("Install the teaser dependencies with npm ci --prefix teaser, or set CAMPUS_FFMPEG to your FFmpeg executable.")
      : error));
    ff.stdin.once("error", reject);
    ff.once("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}`)));
    ff.stdin.end(data);
  });
}

await mkdir(stills, { recursive: true });
if (!onlyStills) await mkdir(output, { recursive: true });
if (!args.includes("--reuse-build")) {
  console.log("Building the local capture page");
  await build({ root: web, configFile: false, logLevel: "error", build: {
    outDir: captureBuild,
    emptyOutDir: false,
    rolldownOptions: { input: path.join(web, "teaser-capture/index.html") },
  } });
}
const server = await preview({ root: web, configFile: false, logLevel: "warn", build: { outDir: captureBuild },
  preview: { host: "127.0.0.1", port, strictPort: true } });
let browser;
try {
  console.log(`Capture preview on port ${port}`);
  browser = await chromium.launch({ channel: "chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (error) => console.error("Capture page:", error.message));
  await page.goto(`http://127.0.0.1:${port}/teaser-capture/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.campusCapture), undefined, { timeout: 100_000 });
  const names = shots.length ? shots : await page.evaluate(() => window.campusCapture.names);
  const failures = [];
  for (const shot of names) {
    const started = performance.now();
    try {
      await page.evaluate((id) => window.campusCapture.select(id), shot);
      const poster = await page.evaluate(() => window.campusCapture.still(0));
      await writeFile(path.join(stills, `${shot}.webp`), Buffer.from(poster, "base64"));
      if (!onlyStills) {
        const rawClip = await page.evaluate(({ fps, seconds }) => window.campusCapture.record(fps, seconds), { fps, seconds });
        const data = Buffer.from(rawClip, "base64");
        const destination = path.join(output, `${shot}.${raw ? "h264" : "mp4"}`);
        if (raw) await writeFile(destination, data);
        else await writeMp4(data, destination);
      }
      console.log(`${shot} · ${Math.round((performance.now() - started) / 1000)}s`);
    } catch (error) {
      console.error(`${shot}:`, error.message);
      failures.push(shot);
    }
  }
  if (failures.length) throw new Error(`Failed shots: ${failures.join(", ")}`);
} finally {
  await browser?.close();
  await server.close();
}
