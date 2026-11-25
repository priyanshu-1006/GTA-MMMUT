import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import { createBuildingInteriorScene } from "../src/building-interior-scene";
import { createCampusActors } from "../src/campus-actors";
import { campusMissionLocations } from "../src/campus-mission-locations";
import { missionFriendShirt } from "../src/campus-missions";
import type { createEntranceScene } from "../src/entrance-scene";

export const bulletShortNames = [
  "short-hook", "short-meet", "short-ignition", "short-side", "short-chase", "short-west",
  "short-arrive", "short-door", "short-cafe", "short-chai", "short-table",
] as const;
type ShortName = typeof bulletShortNames[number];
type Position = readonly [number, number, number];
type Outdoor = ReturnType<typeof createEntranceScene>;
const noop = () => {};
const driverShirt = "#23475c";

function dolly(scene: Scene, from: Position, to: Position, target: Position, fov: number) {
  const camera = new FreeCamera("short-camera", new Vector3(...from), scene);
  camera.fov = fov;
  camera.minZ = 0.05;
  camera.maxZ = 900;
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const aim = new Vector3(...target);
  scene.activeCamera = camera;
  return {
    camera,
    frame(progress: number) {
      Vector3.LerpToRef(a, b, progress, camera.position);
      camera.setTarget(aim);
    },
  };
}

async function waitFor(test: () => boolean, description: string) {
  const start = performance.now();
  while (!test()) {
    if (performance.now() - start > 22_000) throw new Error("Could not load " + description);
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
}

const rideAngles = {
  "short-hook": { x: -1.15, z: 54, yaw: Math.PI, side: 2.7, forward: 3.7, height: 1.16, focus: 1.22, fov: 0.81 },
  "short-ignition": { x: 0.85, z: 37, yaw: Math.PI, side: -1.65, forward: 0.82, height: 0.78, focus: 0.85, fov: 0.84 },
  "short-side": { x: -0.6, z: 43, yaw: Math.PI, side: -3.30, forward: 2.34, height: 1.48, focus: 1.14, fov: 0.89 },
  "short-chase": { x: -0.9, z: 53, yaw: Math.PI, side: 0.52, forward: -4.7, height: 2.28, focus: 1.24, fov: 0.89 },
  "short-west": { x: -184, z: -143, yaw: Math.PI, side: 2.54, forward: 4.28, height: 1.8, focus: 1.18, fov: 0.84 },
  "short-arrive": { x: -111, z: -258, yaw: Math.PI, side: 1.32, forward: -5.35, height: 2.16, focus: 1.33, fov: 0.93 },
} as const;

function isRide(name: ShortName): name is keyof typeof rideAngles {
  return Object.hasOwn(rideAngles, name);
}

export async function setupBulletShort(name: ShortName, engine: Engine, canvas: HTMLCanvasElement,
  outdoor: () => Outdoor, key: (type: "keydown" | "keyup", code: string) => void) {
  if (name === "short-cafe" || name === "short-chai" || name === "short-table") {
    const interior = await createBuildingInteriorScene("cafeteria", engine, canvas, noop, noop, noop,
      { cafeteriaFriendShirt: missionFriendShirt });
    const { scene } = interior;
    interior.activate();
    scene.activeCamera?.detachControl();
    const player = scene.getMeshByName("walk-player");
    if (!player) throw new Error("Cafeteria player is unavailable");
    player.position.set(2.85, 0.025, -9.65);
    const avatar = scene.getTransformNodeByName("player-visual");
    if (avatar) avatar.setEnabled(false);
    const seating = createCampusActors(scene);
    seating.add("short-driver-at-chai", { position: [5.05, 0.018, -10.18], yaw: Math.PI, action: "sit" }, driverShirt);
    const move = name === "short-cafe"
      ? dolly(scene, [0.36, 1.81, 0.68], [0.52, 1.60, -3.7], [0.95, 1.36, -10.35], 0.93)
      : name === "short-table"
        ? dolly(scene, [1.66, 1.77, -8.34], [1.96, 1.68, -8.59], [4.54, 1.09, -10.88], 1.16)
        : dolly(scene, [3.38, 1.50, -9.16], [3.64, 1.46, -9.42], [4.05, 1.15, -11.24], 0.87);
    if (name === "short-chai") {
      const chaiCups = scene.transformNodes.filter(({ name }) => name === "cafeteria-cup").slice(-2);
      for (const cup of chaiCups) cup.scaling.setAll(1.23);
    }
    await waitFor(() => Boolean(scene.getTransformNodeByName("cafeteria-mission-friend/hand_r")), "the cafeteria friend");
    let serving = false;
    return { scene, camera: move.camera, finish: noop,
      frame(progress: number) {
        move.frame(progress);
        if (name === "short-chai" && !serving && progress > 0.10) {
          serving = true;
          void interior.shareChai();
        }
        const closeup = scene.activeCamera;
        if (closeup instanceof FreeCamera && closeup.name === "cafeteria-chai-closeup") {
          closeup.position.copyFrom(move.camera.position);
          closeup.setTarget(new Vector3(4.05, 1.15, -11.24));
          closeup.fov = 0.87;
        }
      },
    };
  }

  const session = outdoor();
  const { scene } = session;
  session.setView("walk");
  session.setWalkPaused(false);
  scene.activeCamera?.detachControl();
  const player = scene.getMeshByName("walk-player");
  if (!player) throw new Error("Campus player is unavailable");
  if (isRide(name)) {
    const shot = rideAngles[name];
    if (!session.prepareMission("chai")) throw new Error("The Bullet is unavailable");
    session.setMissionProgress({ id: "chai", step: "mountBike" });
    const bike = scene.getMeshByName("vehicle-bullet");
    if (!bike) throw new Error("No Bullet mesh");
    bike.position.set(shot.x, 0.025, shot.z);
    bike.rotation.y = shot.yaw;
    player.position.set(shot.x + 1.05, 0.025, shot.z);
    await waitFor(() => {
      if (session.missionSnapshot("chai")?.driving === "bullet") return true;
      session.interactWithVehicle();
      return session.missionSnapshot("chai")?.driving === "bullet";
    }, "the Royal Enfield Bullet");
    await waitFor(() => canvas.dataset.playerModel === "ready" &&
      Boolean(scene.getTransformNodeByName("mission-friend/hand_r")), "both riders");
    session.setMissionProgress({ id: "chai", step: "parkBike" });
    scene.getTransformNodeByName("campus-mission-marker")?.setEnabled(false);
    const camera = new FreeCamera("short-ride-camera", Vector3.Zero(), scene);
    camera.fov = shot.fov;
    camera.minZ = 0.05;
    camera.maxZ = 900;
    scene.activeCamera = camera;
    const focus = Vector3.Zero();
    let accelerating = false;
    let braking = false;
    return {
      scene, camera,
      finish() { key("keyup", "KeyW"); key("keyup", "Space"); },
      frame(progress: number) {
        if (progress > 0 && !accelerating) {
          accelerating = true;
          key("keydown", "KeyW");
        }
        if (name === "short-arrive" && progress > 0.62 && !braking) {
          braking = true;
          key("keyup", "KeyW");
          key("keydown", "Space");
        }
        const { x, z } = bike.position;
        const yaw = bike.rotation.y;
        const sin = Math.sin(yaw), cos = Math.cos(yaw);
        const side = shot.side * (1 - 0.14 * progress);
        const ahead = shot.forward + (name === "short-chase" ? 0.85 * progress : 0.15 * progress);
        camera.position.set(x + side * cos + ahead * sin, shot.height + 0.13 * progress, z - side * sin + ahead * cos);
        focus.set(x + 0.14 * sin, shot.focus, z + 0.14 * cos);
        camera.setTarget(focus);
      },
    };
  }

  const actors = createCampusActors(scene);
  session.setView("entrance");
  scene.activeCamera?.detachControl();
  if (name === "short-meet") {
    const [x, z] = campusMissionLocations.gardenFriend.point;
    const friend = actors.add("short-garden-friend", { position: [x, 0.025, z], yaw: -1.42, action: "talk" }, missionFriendShirt);
    const driver = actors.add("short-garden-driver", { position: [x - 1.25, 0.025, z + 0.1], yaw: 1.57, action: "idle" }, driverShirt);
    const move = dolly(scene, [x - 3.6, 1.83, z + 3.45], [x - 2.0, 1.65, z + 2.7], [x - 0.60, 1.06, z], 0.86);
    await waitFor(() => Boolean(scene.getTransformNodeByName("short-garden-friend/hand_r")), "the garden friend");
    return { scene, camera: move.camera, frame: move.frame, finish() { friend.setVisible(false); driver.setVisible(false); } };
  }

  const x = -116.39, z = -285.05;
  const driver = actors.add("short-cafe-driver", { position: [x - 0.48, 0.025, z + 4.9], yaw: Math.PI, action: "walk" }, driverShirt);
  const friend = actors.add("short-cafe-friend", { position: [x + 0.50, 0.025, z + 5.65], yaw: Math.PI, action: "walk" }, missionFriendShirt);
  const move = dolly(scene, [x + 1.8, 1.86, z + 8.95], [x + 1.3, 1.68, z + 7.4], [x, 1.75, z + 0.5], 0.91);
  await waitFor(() => Boolean(scene.getTransformNodeByName("short-cafe-friend/hand_r")), "the arriving friend");
  return { scene, camera: move.camera, finish: noop, frame(progress: number) {
    const approach = progress * 3.45;
    driver.setPose({ position: [x - 0.48, 0.025 + Math.max(0, progress - 0.73) * 0.9, z + 4.9 - approach], yaw: Math.PI, action: "walk" });
    friend.setPose({ position: [x + 0.50, 0.025, z + 5.65 - approach], yaw: Math.PI, action: "walk" });
    move.frame(progress);
  } };
}
