import "@babylonjs/core/Collisions/collisionCoordinator";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { worldToAnnotation, type WorldGroundPoint } from "@gta-mmmut/world-data";
import type { createCampusVehicles, VehicleState } from "./campus-vehicles";
import { createPlayerAvatar, type PlayerAction } from "./player-avatar";
import { playerCameras, type PlayerCamera, type PlayerStatus } from "./player-controls";

const groundHeight = 0.025;
const movementKeys = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "ShiftLeft", "ShiftRight", "Space",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);
const cameraModes = Object.keys(playerCameras) as PlayerCamera[];

interface WalkOptions {
  readonly spawn?: readonly [x: number, y: number, z: number];
  readonly indoor?: boolean;
  readonly portal?: {
    contains(position: WorldGroundPoint, height: number): boolean;
    interact(): void;
  };
}

function angleDifference(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function createCampusWalk(
  scene: Scene,
  canvas: HTMLCanvasElement,
  [gateX, gateZ]: WorldGroundPoint,
  extent: readonly WorldGroundPoint[],
  raisedGroundAt: (x: number, z: number, currentY: number) => number | undefined,
  vehicles: ReturnType<typeof createCampusVehicles> | null,
  onStatus: (status: PlayerStatus) => void,
  walkOptions: WalkOptions = {},
) {
  const player = new Mesh("walk-player", scene);
  const spawn = new Vector3(...(walkOptions.spawn ?? [gateX, groundHeight, gateZ + 4]));
  player.position.copyFrom(spawn);
  player.ellipsoid.set(0.33, 0.83, 0.33);
  player.ellipsoidOffset.y = 0.83;
  player.isPickable = false;
  const avatar = createPlayerAvatar(scene, player, canvas);
  avatar.visual.rotation.y = Math.PI;
  player.setEnabled(false);

  const camera = new ArcRotateCamera("walk-follow", Math.PI / 2, 1.28, 5.2, spawn.clone(), scene);
  camera.panningSensibility = 0;
  camera.wheelDeltaPercentage = 0.08;
  camera.checkCollisions = true;
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  const xs = extent.map(([x]) => x);
  const zs = extent.map(([, z]) => z);
  const margin = walkOptions.indoor ? 0 : 12;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minZ = Math.min(...zs) - margin;
  const maxZ = Math.max(...zs) + margin;
  const floorAt = (x: number, z: number, y: number) => raisedGroundAt(x, z, y) ?? groundHeight;

  let active = false;
  let paused = false;
  let started = false;
  let grounded = true;
  let crouching = false;
  let jumpAge = 0;
  let landing = 0;
  let verticalSpeed = 0;
  let mode: PlayerCamera = walkOptions.indoor ? "first" : "follow";
  let shoulderSide = 1;
  let reducedMotion = false;
  let nearby: VehicleState | null = null;
  let previousStatus = "";
  const keys = new Set<string>();
  const velocity = new Vector3();
  const displacement = new Vector3();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function clearInput() {
    keys.clear();
    velocity.setAll(0);
  }

  function setCrouching(value: boolean) {
    crouching = value;
    player.ellipsoid.y = value ? 0.61 : 0.83;
    player.ellipsoidOffset.y = player.ellipsoid.y;
  }

  function configureCamera(vehicle: VehicleState | null = vehicles?.active() ?? null) {
    const first = !vehicle && mode === "first";
    const distance = vehicle?.chaseDistance ?? { follow: 5.2, shoulder: 2.65, wide: 8, first: 0.075 }[mode];
    camera.lowerRadiusLimit = first ? distance : vehicle ? 3 : 1.5;
    camera.upperRadiusLimit = first ? distance : vehicle ? 12 : 10;
    camera.lowerBetaLimit = first ? 0.17 : 0.48;
    camera.upperBetaLimit = first ? 2.97 : 1.55;
    camera.minZ = first ? 0.025 : 0.1;
    camera.collisionRadius.setAll(first ? 0.045 : 0.24);
    camera.radius = distance;
    camera.beta = first ? Math.PI / 2 : vehicle ? 1.2 : 1.28;
    if (vehicle) camera.alpha = Math.atan2(-Math.cos(vehicle.yaw), -Math.sin(vehicle.yaw));
    avatar.visual.setEnabled(!first && vehicle?.kind !== "car");
    canvas.dataset.playerCamera = vehicle ? "chase" : mode;
  }

  function publish(vehicle: VehicleState | null) {
    const { x, y, z } = player.position;
    for (const [axis, value] of [["X", x], ["Y", y], ["Z", z]] as const) {
      const key = `player${axis}`;
      const formatted = value.toFixed(3);
      if (canvas.dataset[key] !== formatted) canvas.dataset[key] = formatted;
    }
    const model = vehicle ? (vehicle.modelReady ? "ready" : "loading") : undefined;
    if (model !== canvas.dataset.playerVehicleModel) {
      if (model) canvas.dataset.playerVehicleModel = model;
      else delete canvas.dataset.playerVehicleModel;
    }
    const shoulder = !vehicle && mode === "shoulder" ? 0.51 * shoulderSide : 0;
    const eye = vehicle ? 1.12 : mode === "first" ? (crouching ? 1.16 : 1.61) : crouching ? 0.97 : 1.27;
    camera.target.set(x + Math.sin(camera.alpha) * shoulder, y + eye, z - Math.cos(camera.alpha) * shoulder);
    const status: PlayerStatus = { camera: mode, vehicle: vehicle?.label ?? null, vehicleKind: vehicle?.kind ?? null, nearby: nearby?.label ?? null,
      portalNearby: !vehicle && (walkOptions.portal?.contains([x, z], y) ?? false),
      speed: vehicle ? Math.round(Math.abs(vehicle.speed) * 3.6) : 0 };
    const key = `${status.camera}/${status.vehicle}/${status.vehicleKind}/${status.nearby}/${status.portalNearby}/${status.speed}`;
    if (key !== previousStatus) {
      previousStatus = key;
      onStatus(status);
    }
  }

  function interact() {
    if (!active || paused) return;
    const occupied = vehicles?.active();
    if (occupied) {
      const exit = vehicles?.exit();
      if (!exit) return;
      player.position.set(exit[0], floorAt(exit[0], exit[1], player.position.y), exit[1]);
      avatar.visual.position.setAll(0);
      grounded = true;
      canvas.removeAttribute("data-player-vehicle");
    } else {
      const position: WorldGroundPoint = [player.position.x, player.position.z];
      if (walkOptions.portal?.contains(position, player.position.y)) {
        clearInput();
        walkOptions.portal.interact();
        return;
      }
      nearby = vehicles?.nearby(position) ?? null;
      if (!nearby || !vehicles?.enter(nearby.id)) return;
      canvas.dataset.playerVehicle = nearby.id;
      nearby = null;
    }
    setCrouching(false);
    verticalSpeed = 0;
    clearInput();
    configureCamera();
  }

  function setCamera(next: PlayerCamera) {
    mode = next;
    configureCamera();
    if (active) publish(vehicles?.active() ?? null);
  }

  canvas.addEventListener("keydown", (event) => {
    if (!active || paused) return;
    const { code } = event;
    if (!movementKeys.has(code) && !["KeyC", "KeyE", "KeyV", "KeyX", "KeyR"].includes(code)) return;
    event.preventDefault();
    const occupied = vehicles?.active();
    if (movementKeys.has(code)) keys.add(code);
    if (event.repeat) return;
    if (code === "KeyE") interact();
    if (code === "KeyV" && !occupied) setCamera(cameraModes[(cameraModes.indexOf(mode) + 1) % cameraModes.length]);
    if (code === "KeyX" && !occupied) shoulderSide *= -1;
    if (code === "KeyC" && !occupied && grounded) {
      if (!crouching) setCrouching(true);
      else {
        const feet = player.position.clone();
        const rise = 0.44;
        player.moveWithCollisions(displacement.set(0, rise, 0));
        if (player.position.y >= feet.y + rise - 0.02) setCrouching(false);
        player.position.copyFrom(feet);
      }
    }
    if (code === "KeyR" && !occupied) {
      clearInput();
      player.position.copyFrom(spawn);
      setCrouching(false);
      verticalSpeed = 0;
      grounded = true;
      camera.alpha = Math.PI / 2;
    }
    if (code === "Space" && !occupied && grounded && !crouching) {
      verticalSpeed = 4.7;
      jumpAge = 0;
      grounded = false;
    }
  }, options);
  window.addEventListener("keyup", ({ code }) => keys.delete(code), options);
  canvas.addEventListener("blur", clearInput, options);
  window.addEventListener("blur", clearInput, options);
  document.addEventListener("pointerlockchange", clearInput, options);
  canvas.addEventListener("dblclick", () => {
    if (active && !paused) void canvas.requestPointerLock?.()?.catch(() => undefined);
  }, options);

  function walk(elapsed: number, forward: number, side: number) {
    const startX = player.position.x;
    const startZ = player.position.z;
    const yaw = camera.alpha;
    const moveX = -Math.cos(yaw) * forward + Math.sin(yaw) * side;
    const moveZ = -Math.sin(yaw) * forward - Math.cos(yaw) * side;
    const slow = keys.has("KeyZ");
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const pace = crouching ? 1.7 : slow ? 2.1 : running ? 7.5 : 4.2;
    const speed = Math.min(pace, walkOptions.indoor ? (running ? 4.6 : 2.8) : pace) / Math.max(1, Math.hypot(forward, side));
    const steps = Math.max(1, Math.ceil(elapsed * 60));
    const dt = elapsed / steps;
    landing = Math.max(0, landing - elapsed);
    if (!grounded) jumpAge += elapsed;
    for (let step = 0; step < steps; step++) {
      const ease = 1 - Math.exp(-dt * (forward || side ? 17 : 34));
      velocity.x += (moveX * speed - velocity.x) * ease;
      velocity.z += (moveZ * speed - velocity.z) * ease;
      const { x, y, z } = player.position;
      const nextX = Math.max(minX, Math.min(maxX, x + velocity.x * dt));
      const nextZ = Math.max(minZ, Math.min(maxZ, z + velocity.z * dt));
      const nextFloor = floorAt(nextX, nextZ, y);
      if (!grounded || y > nextFloor + 0.001) verticalSpeed -= 10.5 * dt;
      const nextY = Math.max(nextFloor, y + verticalSpeed * dt);
      displacement.set(nextX - x, nextY - y, nextZ - z);
      if (displacement.lengthSquared() < 1e-8) continue;
      player.moveWithCollisions(displacement);
      const wasGrounded = grounded;
      const floor = floorAt(player.position.x, player.position.z, player.position.y);
      grounded = player.position.y <= floor + 0.001 || (displacement.y < 0 && player.position.y > nextY + 0.001);
      if (grounded) {
        if (!wasGrounded && jumpAge > 0.18) landing = 0.21;
        verticalSpeed = 0;
        jumpAge = 0;
      }
    }
    const actualSpeed = elapsed > 0 ? Math.hypot(player.position.x - startX, player.position.z - startZ) / elapsed : 0;
    if (forward || side) {
      const wanted = Math.atan2(moveX, moveZ);
      const current = avatar.visual.rotation.y;
      avatar.visual.rotation.y += angleDifference(current, wanted) * Math.min(1, elapsed * 15);
    }
    let action: PlayerAction;
    if (!grounded) action = jumpAge < 0.16 ? "takeoff" : "air";
    else if (landing > 0) action = "land";
    else if (crouching) action = actualSpeed > 0.3 ? "sneak" : "crouch";
    else action = actualSpeed < 0.32 ? "idle" : running && !slow ? "sprint" : slow || walkOptions.indoor ? "walk" : "jog";
    const moving = action === "walk" || action === "jog" || action === "sprint" || action === "sneak";
    avatar.animate(action, moving ? Math.max(0.7, Math.min(1.45, actualSpeed / speed)) : 1);
    nearby = vehicles?.nearby([player.position.x, player.position.z]) ?? null;
  }

  scene.onBeforeRenderObservable.add(() => {
    if (!active) return;
    const elapsed = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.12);
    let occupied = vehicles?.active() ?? null;
    if (paused) {
      avatar.animate(occupied ? "ride" : "idle");
      return;
    }
    const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const side = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    const turn = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    const tilt = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
    camera.alpha += turn * elapsed * 1.4;
    camera.beta = Math.min(camera.upperBetaLimit!, Math.max(camera.lowerBetaLimit!, camera.beta + tilt * elapsed * 1.1));
    if (occupied && vehicles) {
      vehicles.update(elapsed, { throttle: forward, steer: side, brake: keys.has("Space") });
      occupied = vehicles.active()!;
      player.position.set(occupied.position[0], groundHeight, occupied.position[1]);
      avatar.visual.position.set(occupied.seat[0] - player.position.x, occupied.seat[1] - 0.56,
        occupied.seat[2] - player.position.z);
      avatar.visual.rotation.y = occupied.yaw;
      avatar.animate("ride", 0.8);
      if (Math.abs(occupied.speed) > 0.4) {
        const chase = Math.atan2(-Math.cos(occupied.yaw), -Math.sin(occupied.yaw));
        camera.alpha += angleDifference(camera.alpha, chase) * Math.min(1, elapsed * (reducedMotion ? 1.6 : 4));
      }
    } else {
      walk(elapsed, forward, side);
    }
    publish(occupied);
  });

  function stopInput() {
    clearInput();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  scene.onDisposeObservable.addOnce(() => {
    stopInput();
    listeners.abort();
  });

  configureCamera();
  return {
    camera, setCamera, interact,
    setAppearance: avatar.setAppearance,
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      camera.inertia = value ? 0.28 : 0.85;
    },
    setActive(enabled: boolean) {
      if (active === enabled) return;
      active = enabled;
      player.setEnabled(enabled);
      if (enabled) {
        started = true;
        void avatar.prepare();
        scene.activeCamera = camera;
        camera.attachControl(false);
        canvas.dataset.cameraView = "walk";
        publish(vehicles?.active() ?? null);
      } else {
        camera.detachControl();
        stopInput();
      }
    },
    setPaused(value: boolean) {
      paused = value;
      if (value) stopInput();
    },
    worldPosition() {
      return active ? player.position : null;
    },
    mapPose() {
      if (!started) return null;
      return {
        point: worldToAnnotation([player.position.x, player.position.z]),
        heading: 180 - avatar.visual.rotation.y * 180 / Math.PI,
      };
    },
  };
}
