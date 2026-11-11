import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { createBuildingInteriorScene } from "../src/building-interior-scene";
import type { InteriorId } from "../src/building-interiors";
import { createEntranceScene, type EntranceView } from "../src/entrance-scene";
import { defaultGameSettings } from "../src/game-settings";

type Position = readonly [x: number, y: number, z: number];

interface CameraMove {
  from: Position;
  to: Position;
  lookFrom: Position;
  lookTo?: Position;
  fov?: number;
}

type Shot =
  | { view: EntranceView; orbit?: number; push?: number; elevate?: number }
  | { interior: InteriorId; move: CameraMove }
  | { action: "player" | "traffic" }
  | { move: CameraMove };

const shots: Record<string, Shot> = {
  gate: { view: "gate", orbit: 0.11, push: 0.19 },
  "campus-overview": { view: "network", orbit: -0.32, push: 0.21, elevate: -0.12 },
  "entrance-panorama": { view: "entrance", orbit: -0.12, push: 0.12 },
  admin: { view: "buildings", orbit: -0.19, push: 0.11 },
  atal: { view: "atal", orbit: 0.18, push: 0.17 },
  "atal-garden": { view: "atal-garden", orbit: -0.21, push: 0.16 },
  deoria: { view: "deoria", orbit: 0.17, push: 0.13 },
  forecourt: { view: "forecourt", orbit: -0.16, push: 0.19 },
  placement: { view: "placement", orbit: 0.13 },
  "old-gate": { view: "old-gate", orbit: 0.09 },
  fountain: { view: "fountain", orbit: -0.18, push: 0.12 },
  walkway: { view: "walkway", orbit: 0.015, push: 0.04 },
  player: { action: "player" },
  traffic: { action: "traffic" },
  "cse-exterior": { view: "cse", orbit: -0.13 },
  "cse-complex": { view: "cse-complex", orbit: 0.20 },
  civil: { view: "civil", orbit: 0.16 },
  "civil-two": { view: "civil-two", orbit: -0.15 },
  mechanical: { view: "mechanical-south", orbit: 0.13 },
  it: { view: "it", orbit: -0.13 },
  itrc: { view: "itrc", orbit: 0.09 },
  cafeteria: { view: "cafeteria", orbit: -0.18 },
  ece: { view: "ece", orbit: 0.09, push: 0.05 },
  electrical: { view: "electrical", orbit: -0.10, push: 0.08 },
  "library-exterior": { view: "library", orbit: 0.12 },
  "mph-exterior": { view: "hall", orbit: 0.14 },
  "nalanda-court": { view: "nalanda-courtyard", orbit: -0.19, elevate: -0.09 },
  "takshashila-court": { view: "takshashila", orbit: 0.19, elevate: -0.08 },
  "pushpagiri-entry": { view: "pushpagiri", orbit: 0.07, push: 0.07 },
  library: { interior: "library", move: { from: [2.3, 3.45, 1.55], to: [0.7, 2.55, -3.7], lookFrom: [0, 2.1, -16.4], fov: 0.86 } },
  mph: { interior: "hall", move: { from: [-3.3, 3.9, 1.5], to: [-0.85, 2.6, -4.8], lookFrom: [0, 1.65, -24], fov: 0.88 } },
  "cse-lab": { interior: "cse", move: { from: [3, 2.01, -7.9], to: [4.35, 1.78, -6.3], lookFrom: [7.1, 1.35, -3.2], lookTo: [7.8, 1.29, -2.7], fov: 0.90 } },
  pushpagiri: { interior: "pushpagiri", move: { from: [4.4, 2.9, -17.45], to: [2.4, 2.58, -20.6], lookFrom: [-5.45, 1.69, -20.8], lookTo: [-5.45, 1.58, -21.15], fov: 0.91 } },
  takshashila: { interior: "takshashila", move: { from: [-6.4, 2.1, -26.8], to: [-4.7, 2.14, -28.6], lookFrom: [5.8, 1.95, -32.5], lookTo: [5.55, 1.85, -33.0], fov: 0.90 } },
  nalanda: { interior: "nalanda", move: { from: [-10.6, 2.84, 27.25], to: [-13.35, 2.49, 28.25], lookFrom: [-23.45, 1.56, 27.25], lookTo: [-23.65, 1.51, 26.7], fov: 0.85 } },
};

const canvas = document.querySelector("canvas")!;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, false);
let delta = 1000 / 24;
engine.getDeltaTime = () => delta;
const noop = () => {};
let outdoor: ReturnType<typeof createEntranceScene> | undefined;
let indoor: Awaited<ReturnType<typeof createBuildingInteriorScene>> | undefined;
let freeCamera: FreeCamera | undefined;
let activeShot: { scene: Scene; frame(progress: number): void; finish(): void } | undefined;

function ensureOutdoor() {
  if (!outdoor) {
    outdoor = createEntranceScene(engine, canvas, noop, noop, noop);
    outdoor.setSettings({ ...defaultGameSettings, renderQuality: "high", campusSounds: false });
  }
  return outdoor;
}

function vector([x, y, z]: Position) {
  return new Vector3(x, y, z);
}

function freeMove(scene: Scene, move: CameraMove) {
  const from = vector(move.from);
  const to = vector(move.to);
  const lookFrom = vector(move.lookFrom);
  const lookTo = vector(move.lookTo ?? move.lookFrom);
  const look = lookFrom.clone();
  const camera = new FreeCamera("teaser-dolly", from.clone(), scene);
  camera.minZ = 0.05;
  camera.maxZ = 2200;
  camera.fov = move.fov ?? 0.83;
  scene.activeCamera = camera;
  freeCamera = camera;
  return (t: number) => {
    Vector3.LerpToRef(from, to, t, camera.position);
    Vector3.LerpToRef(lookFrom, lookTo, t, look);
    camera.setTarget(look);
  };
}

function sendKey(type: "keydown" | "keyup", code: string) {
  (type === "keydown" ? canvas : window).dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

async function select(id: string) {
  const shot = shots[id];
  if (!shot) throw new Error(`Unknown teaser shot ${id}`);
  activeShot?.finish();
  freeCamera?.dispose();
  freeCamera = undefined;
  indoor?.scene.dispose();
  indoor = undefined;
  let scene: Scene;
  let frame: (t: number) => void;
  let finish = noop;

  if ("interior" in shot) {
    indoor = await createBuildingInteriorScene(shot.interior, engine, canvas, noop, noop, noop);
    scene = indoor.scene;
    frame = freeMove(scene, shot.move);
  } else {
    const session = ensureOutdoor();
    scene = session.scene;
    session.setWalkPaused(false);
    if ("view" in shot) {
      session.setView(shot.view);
      const camera = scene.activeCamera as ArcRotateCamera;
      camera.detachControl();
      const { alpha, beta, radius } = camera;
      const orbit = shot.orbit ?? 0.1;
      const push = shot.push ?? 0.12;
      frame = (t) => {
        camera.alpha = alpha + (t - 0.5) * orbit;
        camera.beta = beta + t * (shot.elevate ?? 0.008);
        camera.radius = Math.max(camera.lowerRadiusLimit ?? 0, radius * (1.035 - t * push));
      };
    } else if ("action" in shot && shot.action === "player") {
      session.setView("walk");
      const player = scene.getMeshByName("walk-player");
      if (!player) throw new Error("No walk actor found");
      player.position.set(0.6, 0.025, 58);
      const camera = scene.activeCamera as ArcRotateCamera;
      camera.detachControl();
      camera.alpha = Math.PI / 2 + 0.24;
      camera.beta = 1.37;
      await scene.whenReadyAsync();
      sendKey("keydown", "KeyW");
      frame = noop;
      finish = () => sendKey("keyup", "KeyW");
    } else if ("action" in shot) {
      session.setView("gate");
      scene.activeCamera?.detachControl();
      const car = scene.getTransformNodeByName("campus-traffic");
      if (!car) throw new Error("No campus traffic actor found");
      const timeout = performance.now() + 12_000;
      while (!car.isEnabled() && performance.now() < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      if (!car.isEnabled()) throw new Error("The traffic model did not finish loading");
      const camera = new FreeCamera("teaser-traffic-tracking", Vector3.Zero(), scene);
      camera.minZ = 0.06;
      camera.maxZ = 800;
      camera.fov = 0.89;
      const target = Vector3.Zero();
      scene.activeCamera = camera;
      freeCamera = camera;
      frame = (t) => {
        const { x, z } = car.position;
        const dx = Math.sin(car.rotation.y);
        const dz = Math.cos(car.rotation.y);
        const behind = 5.2 - t * 1.45;
        const side = -5.5 + t * 0.8;
        camera.position.set(x - dx * behind + dz * side, 2.45 - t * 0.55, z - dz * behind - dx * side);
        target.set(x + dx * 1.08, 1.15, z + dz * 1.08);
        camera.setTarget(target);
      };
    } else {
      session.setView("entrance");
      frame = freeMove(scene, shot.move);
    }
  }

  activeShot = { scene, frame, finish };
  frame(0);
  await scene.whenReadyAsync();
  scene.render();
  scene.render();
  if ("action" in shot && shot.action === "player") {
    const timeout = performance.now() + 12_000;
    while (canvas.dataset.playerModel === "loading" && performance.now() < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    scene.render();
    scene.render();
  }
}

async function record(fps: number, seconds: number) {
  if (!activeShot) throw new Error("Select a shot before recording");
  if (typeof VideoEncoder === "undefined") throw new Error("Chrome's WebCodecs VideoEncoder is unavailable");
  const { scene, frame, finish } = activeShot;
  const config: VideoEncoderConfig = {
    codec: "avc1.420028", width: canvas.width, height: canvas.height,
    framerate: fps, bitrate: 4_300_000, latencyMode: "realtime", avc: { format: "annexb" },
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error(`Chrome cannot encode ${config.codec}`);
  const chunks: ArrayBuffer[] = [];
  let failure: DOMException | undefined;
  const encoder = new VideoEncoder({
    output(chunk) {
      const data = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push(data);
    },
    error(error) { failure = error; },
  });
  encoder.configure(config);
  delta = 1000 / fps;
  const count = Math.round(fps * seconds);
  try {
    for (let index = 0; index < count; index++) {
      if (failure) throw failure;
      const progress = index / Math.max(1, count - 1);
      frame(progress * progress * (3 - 2 * progress));
      scene.render();
      const stamp = Math.round(index * 1_000_000 / fps);
      const image = new VideoFrame(canvas, { timestamp: stamp, duration: Math.round((index + 1) * 1_000_000 / fps) - stamp });
      encoder.encode(image, { keyFrame: index % fps === 0 });
      image.close();
      while (encoder.encodeQueueSize > 4) await new Promise((resolve) => setTimeout(resolve, 8));
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
    finish();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = reject;
    reader.readAsDataURL(new Blob(chunks));
  });
}

async function still(progress = 0.4) {
  if (!activeShot) throw new Error("Select a shot before capturing a still");
  activeShot.frame(progress);
  activeShot.scene.render();
  return canvas.toDataURL("image/webp", 0.92).split(",", 2)[1];
}

export type CampusCapture = { names: string[]; select: typeof select; record: typeof record; still: typeof still };
Object.assign(window, { campusCapture: { names: Object.keys(shots), select, record, still } satisfies CampusCapture });
