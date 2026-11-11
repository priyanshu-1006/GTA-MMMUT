import "@babylonjs/core/Collisions/collisionCoordinator";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";
import { annotationToWorld, type AnnotationPoint, type WorldGroundPoint } from "@gta-mmmut/world-data";

export type VehicleId = "sedan" | "hatchback" | "scorpio" | "moped" | "bicycle";
export type VehicleKind = "car" | "two-wheel";

interface VehicleSpec {
  id: VehicleId;
  kind: VehicleKind;
  label: string;
  start: AnnotationPoint;
  yaw: number;
  model: string;
  halfWidth: number;
  halfLength: number;
  height: number;
  wheelBase: number;
  wheelRadius: number;
  forwardLimit: number;
  reverseLimit: number;
  acceleration: number;
  braking: number;
  steering: number;
  chaseDistance: number;
  seatHeight: number;
  seatOffset: number;
  seatSide?: number;
}

const specs: readonly VehicleSpec[] = [
  {
    id: "sedan", kind: "car", label: "Swift Dzire", start: [893, 864], yaw: Math.PI,
    model: new URL("./assets/vehicles/swift-dzire.glb", import.meta.url).href,
    halfWidth: 0.93, halfLength: 2.02, height: 1.62, wheelBase: 2.455, wheelRadius: 0.322,
    forwardLimit: 13, reverseLimit: 3.6, acceleration: 3.4, braking: 8.5, steering: 0.49,
    chaseDistance: 6.5, seatHeight: 0.86, seatOffset: 0.12, seatSide: -0.35,
  },
  {
    id: "hatchback", kind: "car", label: "Alto 800", start: [1064.75, 612], yaw: 0,
    model: new URL("./assets/vehicles/alto-800.glb", import.meta.url).href,
    halfWidth: 0.89, halfLength: 1.75, height: 1.54, wheelBase: 2.379, wheelRadius: 0.257,
    forwardLimit: 11.5, reverseLimit: 3.1, acceleration: 3.1, braking: 8, steering: 0.5,
    chaseDistance: 5.8, seatHeight: 0.87, seatOffset: 0.17, seatSide: -0.29,
  },
  {
    id: "scorpio", kind: "car", label: "Scorpio", start: [1075.75, 612.3], yaw: 0,
    model: new URL("./assets/vehicles/scorpio.glb", import.meta.url).href,
    halfWidth: 0.97, halfLength: 2.28, height: 2.11, wheelBase: 2.848, wheelRadius: 0.386,
    forwardLimit: 12.5, reverseLimit: 3.4, acceleration: 3.0, braking: 7.8, steering: 0.46,
    chaseDistance: 7.2, seatHeight: 1.18, seatOffset: 0.36, seatSide: -0.36,
  },
  {
    id: "moped", kind: "two-wheel", label: "Moped", start: [1037.25, 612], yaw: 0,
    model: new URL("./assets/vehicles/moped.glb", import.meta.url).href,
    halfWidth: 0.38, halfLength: 0.93, height: 1.03, wheelBase: 1.2, wheelRadius: 0.285,
    forwardLimit: 10, reverseLimit: 0, acceleration: 3.1, braking: 7.5, steering: 0.46,
    chaseDistance: 5.0, seatHeight: 0.78, seatOffset: -0.23,
  },
  {
    id: "bicycle", kind: "two-wheel", label: "Bicycle", start: [1031.75, 612], yaw: 0,
    model: new URL("./assets/vehicles/bicycle.glb", import.meta.url).href,
    halfWidth: 0.31, halfLength: 0.91, height: 1.09, wheelBase: 1.08, wheelRadius: 0.35,
    forwardLimit: 6.2, reverseLimit: 0, acceleration: 2.25, braking: 5.8, steering: 0.50,
    chaseDistance: 4.6, seatHeight: 1.02, seatOffset: -0.26,
  },
];

const grade = 0.025;
const interactionRange = 2.5;
const exitSpeed = 0.7;
const prefetchRange = 24;

export interface VehicleInput {
  readonly throttle: number;
  readonly steer: number;
  readonly brake: boolean;
}

export interface VehicleState {
  readonly id: VehicleId;
  readonly kind: VehicleKind;
  readonly label: string;
  readonly position: WorldGroundPoint;
  readonly yaw: number;
  readonly speed: number;
  readonly chaseDistance: number;
  readonly seat: readonly [number, number, number];
  readonly modelReady: boolean;
}

interface Wheel {
  readonly node: TransformNode;
  readonly steers: boolean;
}

interface VehicleRig {
  readonly spec: VehicleSpec;
  readonly node: Mesh;
  readonly pose: TransformNode;
  readonly collider: Mesh;
  readonly contactShadow: Mesh;
  fallback?: TransformNode;
  wheels: Wheel[];
  speed: number;
  steer: number;
  spin: number;
  modelReady: boolean;
  modelRequested: boolean;
}

const approach = (value: number, target: number, amount: number) =>
  value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createContactShadowMaterial(scene: Scene) {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index++) {
    const x = (index % size + 0.5) * 2 / size - 1;
    const z = (Math.floor(index / size) + 0.5) * 2 / size - 1;
    const fade = clamp((1 - Math.hypot(x, z)) / 0.57, 0, 1);
    pixels[index * 4 + 3] = Math.round(128 * fade * fade * (3 - 2 * fade));
  }
  const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene, false, false);
  texture.hasAlpha = true;
  const material = new PBRMaterial("vehicle-contact-shadow", scene);
  material.albedoTexture = texture;
  material.useAlphaFromAlbedoTexture = true;
  material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  material.unlit = true;
  return material;
}

function describe(rig: VehicleRig): VehicleState {
  const { spec, node, speed, modelReady } = rig;
  const { x, y, z } = node.position;
  const yaw = node.rotation.y;
  const side = spec.seatSide ?? 0;
  return {
    id: spec.id, kind: spec.kind, label: spec.label, position: [x, z], yaw, speed, modelReady,
    chaseDistance: spec.chaseDistance,
    seat: [
      x + Math.sin(yaw) * spec.seatOffset + Math.cos(yaw) * side,
      y + spec.seatHeight,
      z + Math.cos(yaw) * spec.seatOffset - Math.sin(yaw) * side,
    ],
  };
}

function createFallback(scene: Scene, rig: VehicleRig, shadows: ShadowGenerator) {
  const { id, kind, halfWidth, halfLength, wheelRadius, wheelBase } = rig.spec;
  const root = new TransformNode(`${id}-fallback`, scene);
  root.parent = rig.pose;
  const finish = (name: string, color: string) => {
    const result = new PBRMaterial(`${id}-fallback-${name}`, scene);
    result.albedoColor = Color3.FromHexString(color).toLinearSpace();
    result.roughness = 0.75;
    result.metallic = 0;
    return result;
  };
  const paint = finish("paint", kind === "car" ? "#476a7c" : "#5c754d");
  const dark = finish("dark", "#313638");
  const glazing = finish("glazing", "#617782");

  function mount(mesh: Mesh, parent: TransformNode, x: number, y: number, z: number, material: PBRMaterial) {
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.isPickable = false;
    shadows.addShadowCaster(mesh, false);
  }

  if (kind === "car") {
    mount(CreateBox("car-body-proxy", { width: 1.9 * halfWidth, height: 0.62, depth: 1.98 * halfLength }, scene),
      root, 0, 0.6, 0, paint);
    mount(CreateBox("car-cabin-proxy", { width: 1.57 * halfWidth, height: 0.48, depth: 0.88 * halfLength }, scene),
      root, 0, 1.14, -0.15, glazing);
  } else {
    const moped = id === "moped";
    mount(CreateBox("cycle-frame-proxy", { width: moped ? 0.28 : 0.07, height: moped ? 0.28 : 0.1, depth: 1.12 }, scene),
      root, 0, 0.52, 0, paint);
    mount(CreateBox("cycle-saddle-proxy", { width: 0.27, height: 0.085, depth: 0.33 }, scene),
      root, 0, rig.spec.seatHeight - 0.04, rig.spec.seatOffset, dark);
    mount(CreateBox("cycle-handle-proxy", { width: 0.57, height: 0.06, depth: 0.11 }, scene),
      root, 0, 0.98, 0.37, dark);
  }

  for (const front of [true, false]) {
    for (const x of kind === "car" ? [-halfWidth * 0.8, halfWidth * 0.8] : [0]) {
      const wheel = new TransformNode("proxy-wheel", scene);
      wheel.parent = root;
      wheel.position.set(x, wheelRadius, (front ? 1 : -1) * wheelBase / 2);
      const tire = CreateCylinder("proxy-tire", {
        diameter: 2 * wheelRadius, height: kind === "car" ? 0.24 : 0.06, tessellation: 18,
      }, scene);
      tire.rotation.z = Math.PI / 2;
      mount(tire, wheel, 0, 0, 0, dark);
      rig.wheels.push({ node: wheel, steers: front });
    }
  }
  return root;
}

export function createCampusVehicles(scene: Scene, shadows: ShadowGenerator, extent: readonly WorldGroundPoint[]) {
  const xs = extent.map(([x]) => x);
  const zs = extent.map(([, z]) => z);
  const minX = Math.min(...xs) - 12;
  const maxX = Math.max(...xs) + 12;
  const minZ = Math.min(...zs) - 12;
  const maxZ = Math.max(...zs) + 12;
  const displacement = new Vector3();
  const collisionMaterial = new PBRMaterial("vehicle-collision-surface", scene);
  const contactShadowMaterial = createContactShadowMaterial(scene);
  const dismountProbe = new Mesh("vehicle-dismount-probe", scene);
  dismountProbe.ellipsoid.set(0.33, 0.83, 0.33);
  dismountProbe.ellipsoidOffset.set(0, 0.83, 0);
  dismountProbe.isPickable = false;
  let occupied: VehicleRig | null = null;

  const rigs = specs.map((spec): VehicleRig => {
    const [x, z] = annotationToWorld(spec.start);
    const node = new Mesh(`vehicle-${spec.id}`, scene);
    node.position.set(x, grade, z);
    node.rotation.y = spec.yaw;
    node.ellipsoidOffset.set(0, spec.height * 0.47, 0);
    node.isPickable = false;

    const pose = new TransformNode(`${spec.id}-model-pose`, scene);
    pose.parent = node;
    const collider = CreateBox(`${spec.id}-occupancy-collider`, {
      width: spec.halfWidth * 2, height: spec.height, depth: spec.halfLength * 2,
    }, scene);
    collider.parent = node;
    collider.position.y = spec.height / 2;
    collider.material = collisionMaterial;
    collider.checkCollisions = spec.kind === "two-wheel";
    collider.isVisible = false;
    collider.isPickable = false;

    const contactShadow = CreateGround(`${spec.id}-contact-shadow`, {
      width: 2.95 * spec.halfWidth, height: 2.6 * spec.halfLength,
    }, scene);
    contactShadow.parent = node;
    contactShadow.position.y = 0.024;
    contactShadow.material = contactShadowMaterial;
    contactShadow.isPickable = false;
    contactShadow.setEnabled(spec.kind === "two-wheel");

    const rig: VehicleRig = {
      spec, node, pose, collider, contactShadow, wheels: [], speed: 0, steer: 0, spin: 0,
      modelReady: false, modelRequested: false,
    };
    if (spec.kind === "two-wheel") rig.fallback = createFallback(scene, rig, shadows);
    return rig;
  });

  function loadModel(rig: VehicleRig) {
    if (rig.modelRequested) return;
    rig.modelRequested = true;
    const { spec, pose, fallback } = rig;
    void ImportMeshAsync(spec.model, scene).then(({ meshes, transformNodes }) => {
      if (scene.isDisposed) return;
      if (!meshes.length) throw new Error("Vehicle GLB contains no meshes");
      meshes[0].parent = pose;
      for (const mesh of meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        if (mesh.getTotalVertices() > 0) shadows.addShadowCaster(mesh, false);
      }
      const nodes = new Set([...meshes, ...transformNodes]);
      rig.wheels = [...nodes]
        .filter(({ name }) => /^wheel-(front|rear|back)(-(left|right))?$/.test(name))
        .map((wheel) => ({ node: wheel, steers: wheel.name.startsWith("wheel-front") }));
      if (fallback) {
        for (const part of fallback.getChildMeshes()) shadows.removeShadowCaster(part, false);
        fallback.dispose(false, true);
        rig.fallback = undefined;
      }
      rig.modelReady = true;
      rig.collider.checkCollisions = true;
      rig.contactShadow.setEnabled(true);
    }).catch((error: unknown) => {
      if (scene.isDisposed) return;
      console.warn(`Could not load ${spec.label} model; using the local proxy.`, error);
      rig.fallback ??= createFallback(scene, rig, shadows);
      rig.collider.checkCollisions = true;
      rig.contactShadow.setEnabled(true);
    });
  }

  function prefetchNearby(x: number, z: number, kind?: VehicleKind) {
    for (const rig of rigs) {
      if (kind && rig.spec.kind !== kind) continue;
      if (Math.hypot(x - rig.node.position.x, z - rig.node.position.z) < prefetchRange) loadModel(rig);
    }
  }

  function move(rig: VehicleRig, dt: number, input: VehicleInput) {
    const { node, spec, collider } = rig;
    const throttle = clamp(input.throttle, -1, 1);
    const directionChange = Math.sign(rig.speed) !== Math.sign(throttle) && Math.abs(rig.speed) > 0.001;
    const limit = throttle >= 0 ? spec.forwardLimit : spec.reverseLimit;
    const target = input.brake ? 0 : throttle * limit;
    const rate = input.brake || (throttle !== 0 && directionChange) ? spec.braking
      : throttle === 0 ? (spec.id === "bicycle" ? 1.1 : 1.7) : spec.acceleration;
    rig.speed = approach(rig.speed, target, rate * dt);
    // In this right-handed scene, local −X is to the driver's right when facing +Z.
    const targetSteer = -clamp(input.steer, -1, 1) * spec.steering / (1 + Math.abs(rig.speed) * 0.085);
    rig.steer = approach(rig.steer, targetSteer, 3.2 * dt);

    const yaw = node.rotation.y;
    const proposed = yaw + (rig.speed / spec.wheelBase) * Math.tan(rig.steer) * dt;
    const sin = Math.sin(proposed);
    const cos = Math.cos(proposed);
    node.ellipsoid.set(
      Math.hypot(cos * spec.halfWidth, sin * spec.halfLength),
      spec.height * 0.47,
      Math.hypot(sin * spec.halfWidth, cos * spec.halfLength),
    );
    const { x, z } = node.position;
    const nextX = clamp(x + sin * rig.speed * dt, minX, maxX);
    const nextZ = clamp(z + cos * rig.speed * dt, minZ, maxZ);
    displacement.set(nextX - x, 0, nextZ - z);
    const requested = displacement.length();
    if (requested < 0.00001) {
      rig.speed = 0;
      return;
    }

    collider.checkCollisions = false;
    try {
      node.moveWithCollisions(displacement);
    } finally {
      collider.checkCollisions = true;
    }
    const distance = Math.hypot(node.position.x - x, node.position.z - z);
    node.position.y = grade;
    if (distance > 0.0001) node.rotation.y = proposed;
    // Tiny launch steps can be below Babylon's collision epsilon.
    if (requested > 0.003 && distance < requested * 0.8) {
      rig.speed *= Math.max(0, distance / requested - 0.15);
    }
    rig.spin += Math.sign(rig.speed) * distance / spec.wheelRadius;
    collider.computeWorldMatrix(true);
  }

  function findDismount(rig: VehicleRig): WorldGroundPoint | null {
    const { node, spec, collider } = rig;
    const side = spec.halfWidth + 0.65;
    const sin = Math.sin(node.rotation.y);
    const cos = Math.cos(node.rotation.y);
    const rear = spec.halfLength + 0.56;
    collider.checkCollisions = false;
    try {
      for (const [dx, dz] of [[cos * side, -sin * side], [-cos * side, sin * side], [-sin * rear, -cos * rear]]) {
        const x = node.position.x + dx;
        const z = node.position.z + dz;
        if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
        dismountProbe.position.copyFrom(node.position);
        dismountProbe.computeWorldMatrix(true);
        displacement.set(dx, 0, dz);
        dismountProbe.moveWithCollisions(displacement);
        if (Math.hypot(x - dismountProbe.position.x, z - dismountProbe.position.z) < 0.05) return [x, z];
      }
      return null;
    } finally {
      collider.checkCollisions = true;
    }
  }

  return {
    prefetchNearby,
    nearby([x, z]: WorldGroundPoint): VehicleState | null {
      if (occupied) return null;
      prefetchNearby(x, z);
      let distance = interactionRange;
      let match: VehicleRig | undefined;
      for (const rig of rigs) {
        if (!rig.modelReady && !rig.fallback) continue;
        const dx = x - rig.node.position.x;
        const dz = z - rig.node.position.z;
        const sin = Math.sin(rig.node.rotation.y);
        const cos = Math.cos(rig.node.rotation.y);
        const side = Math.max(0, Math.abs(dx * cos - dz * sin) - rig.spec.halfWidth);
        const end = Math.max(0, Math.abs(dx * sin + dz * cos) - rig.spec.halfLength);
        const next = Math.hypot(side, end);
        if (next > distance) continue;
        distance = next;
        match = rig;
      }
      return match ? describe(match) : null;
    },
    enter(id: VehicleId): boolean {
      if (occupied) return false;
      const rig = rigs.find(({ spec }) => spec.id === id);
      if (!rig) return false;
      loadModel(rig);
      if (!rig.modelReady && !rig.fallback) return false;
      occupied = rig;
      return true;
    },
    exit(): WorldGroundPoint | null {
      if (!occupied || Math.abs(occupied.speed) > exitSpeed) return null;
      const position = findDismount(occupied);
      if (!position) return null;
      occupied.speed = 0;
      occupied.steer = 0;
      occupied.pose.rotation.z = 0;
      for (const wheel of occupied.wheels) wheel.node.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, occupied.spin, 0);
      occupied = null;
      return position;
    },
    update(elapsed: number, input: VehicleInput) {
      if (!occupied || !Number.isFinite(elapsed) || elapsed <= 0) return;
      const dt = Math.min(elapsed, 0.1);
      const steps = Math.ceil(dt * 60);
      for (let step = 0; step < steps; step++) move(occupied, dt / steps, input);
      prefetchNearby(occupied.node.position.x, occupied.node.position.z);
      for (const wheel of occupied.wheels) {
        wheel.node.rotationQuaternion = Quaternion.RotationYawPitchRoll(wheel.steers ? occupied.steer : 0, occupied.spin, 0);
      }
      if (occupied.spec.kind === "two-wheel") occupied.pose.rotation.z = -occupied.steer * Math.abs(occupied.speed) * 0.075;
    },
    active: (): VehicleState | null => occupied ? describe(occupied) : null,
    states: (): readonly VehicleState[] => rigs.map(describe),
  };
}
