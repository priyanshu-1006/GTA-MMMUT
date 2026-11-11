import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, type AnnotationPoint, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { coveredWalkways } from "@gta-mmmut/world-data/covered-walkways";
import { createContactShadowMaterial } from "./campus-vehicles";
import "@babylonjs/loaders/glTF";

export interface PedestrianBlocker {
  readonly position: WorldGroundPoint;
  readonly radius: number;
}

type Action = "Idle_Loop" | "Walk_Loop" | "Sitting_Idle_Loop" | "Idle_Talking_Loop" | "Gate_Register_Loop" | "Campus_Chant_Loop";

interface Actor {
  readonly root: TransformNode;
  readonly action: Action;
  readonly phase: number;
  readonly radius: number;
  readonly palette: number;
  readonly guard: boolean;
  model?: TransformNode;
  animations?: Map<Action, AnimationGroup>;
  current?: AnimationGroup;
  head?: TransformNode;
  cap?: TransformNode;
  writingHand?: TransformNode;
  pen?: TransformNode;
  shadow?: TransformNode;
  walking: boolean;
}

interface Patrol {
  readonly points: readonly WorldGroundPoint[];
  readonly distances: readonly number[];
  readonly members: readonly Actor[];
  readonly speed: number;
  distance: number;
  forward: boolean;
  pause: number;
}

const crowdUrl = new URL("./assets/player/campus-crowd.glb", import.meta.url).href;
const chantCenters = ([[988, 770], [793, 747.8]] as const).map(annotationToWorld);
const palettes = [
  { shirt: "#465d7c", pants: "#353c49", skin: "#fff3dd" },
  { shirt: "#944d45", pants: "#35343a", skin: "#e7b699" },
  { shirt: "#687a4c", pants: "#4b4845", skin: "#e8c8ad" },
  { shirt: "#c3a367", pants: "#3a495e", skin: "#f6dfc6" },
  { shirt: "#875d75", pants: "#424d53", skin: "#eac4a6" },
  { shirt: "#75a3a5", pants: "#565061", skin: "#f8e4d1" },
  { shirt: "#334662", pants: "#2f3741", skin: "#efd4b5" },
] as const;

function offset([x, z]: WorldGroundPoint, yaw: number, side: number, forward: number): WorldGroundPoint {
  return [x + side * Math.cos(yaw) + forward * Math.sin(yaw), z - side * Math.sin(yaw) + forward * Math.cos(yaw)];
}

function heading([x, z]: WorldGroundPoint, [targetX, targetZ]: WorldGroundPoint) {
  return Math.atan2(targetX - x, targetZ - z);
}

export function createCampusPedestrians(
  scene: Scene,
  shadows: ShadowGenerator,
  nearbyObstacles: () => readonly PedestrianBlocker[] = () => [],
) {
  const actors: Actor[] = [];
  const patrols: Patrol[] = [];
  const materialPalettes = new Map<string, PBRMaterial>();
  let paused = false;
  let reducedMotion = false;
  let time = 0;
  let poseAge = 0;
  let source: AssetContainer | undefined;

  function material(name: string, hex: string) {
    const value = new PBRMaterial(name, scene);
    value.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    value.metallic = 0;
    value.roughness = 0.86;
    return value;
  }
  const wood = material("campus-bench-varnished-wood", "#7b4e30");
  const steel = material("campus-bench-painted-metal", "#294640");
  const securityBlue = material("security-uniform-blue", "#273e59");
  const brass = material("security-badge-brass", "#bf9c58");
  const concrete = material("security-pad", "#b4aa9a");
  const paper = material("security-register-paper", "#e7dfc1");
  const ink = material("security-register-ink", "#353a3d");
  const contactShadow = createContactShadowMaterial(scene);

  function box(
    parent: TransformNode,
    name: string,
    finish: PBRMaterial,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    solid = false,
  ) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.material = finish;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.checkCollisions = solid;
    return mesh;
  }

  function rootAt(name: string, [x, z]: WorldGroundPoint, yaw: number, floor: number) {
    const root = new TransformNode(name, scene);
    root.position.set(x, floor, z);
    root.rotation.y = yaw;
    return root;
  }

  function person(
    id: string,
    position: WorldGroundPoint,
    yaw: number,
    floor: number,
    action: Action,
    palette: number,
    scale: number,
    guard = false,
    phase = actors.length * 0.37,
  ) {
    const root = rootAt(id, position, yaw, floor);
    root.scaling.setAll(scale);
    const actor: Actor = { root, action, palette, guard, radius: 0.3, phase, walking: true };
    actors.push(actor);
    return actor;
  }

  function bench(id: string, pin: AnnotationPoint, floor: number, yaw: number, palette: number, withFriend: boolean) {
    const position = annotationToWorld(pin);
    const root = rootAt(`campus-bench-${id}`, position, yaw, floor);
    for (const x of [-0.74, 0.74]) {
      box(root, "bench-foot", steel, 0.105, 0.36, 0.54, x, 0.18, 0);
      box(root, "bench-back-support", steel, 0.062, 0.48, 0.055, x, 0.63, -0.24);
    }
    for (const z of [-0.17, 0, 0.17]) {
      const slat = box(root, "bench-seat-slat", wood, 1.92, 0.055, 0.158, 0, 0.421, z, true);
      shadows.addShadowCaster(slat);
    }
    for (const y of [0.62, 0.76]) {
      box(root, "bench-back-slat", wood, 1.92, 0.102, 0.064, 0, y, -0.205, true);
    }
    const sitter = offset(position, yaw, withFriend ? -0.35 : 0, 0.28);
    person(`campus-student-seated-${id}`, sitter, yaw, floor, "Sitting_Idle_Loop", palette, 1);
    if (withFriend) {
      const friend = offset(position, yaw, 0.65, 1.26);
      person(`campus-student-talking-${id}`, friend, heading(friend, sitter), floor, "Idle_Talking_Loop",
        (palette + 2) % 6, 1.035);
    }
  }

  bench("atal-garden", [767, 744.2], 0.035, 0, 0, true);
  bench("east-garden", [965, 767.9], 0.035, 0, 2, true);
  bench("forecourt", [936, 638.4], 0.02, Math.PI * 0.22, 4, true);
  bench("central-lawn", [914, 510.6], 0.015, Math.PI, 5, false);

  function addPatrol(id: string, pins: readonly AnnotationPoint[], floor: number, speed: number, count: number, start: number) {
    const points = pins.map(annotationToWorld);
    const distances = [0];
    for (let index = 1; index < points.length; index++) {
      const [x, z] = points[index - 1];
      distances.push(distances[index - 1] + Math.hypot(points[index][0] - x, points[index][1] - z));
    }
    const members = Array.from({ length: count }, (_, index) => person(`campus-student-walking-${id}-${index + 1}`,
      points[0], heading(points[0], points[1]), floor, "Walk_Loop", (index + start) % 6, 0.97 + index * 0.055));
    patrols.push({ points, distances, members, speed, distance: distances.at(-1)! * 0.27, forward: true, pause: 0 });
  }

  addPatrol("gate-east-pair", [[912.8, 861], [910.5, 844], [910.5, 816], [910.5, 785]], 0.21, 1.05, 2, 1);
  addPatrol("gate-west", [[883.3, 854], [884.4, 842], [885.1, 813], [885.2, 780]], 0.21, 1.17, 1, 5);
  const coveredPath = coveredWalkways.segments.find(({ id }) => id === "central-lawn-connector")!.points;
  addPatrol("covered-path-pair", coveredPath, 0.041, 1.03, 2, 2);

  for (const [group, center] of chantCenters.entries()) {
    for (let member = 0; member < 3; member++) {
      const yaw = (member / 3) * Math.PI * 2;
      const position = offset(center, yaw, 0, 0.95);
      person(`campus-student-chanting-${group + 1}-${member + 1}`, position, heading(position, center), 0.035,
        "Campus_Chant_Loop", (member * 2 + group + 3) % 6, [0.99, 1.05, 0.955][member], false, group * 1.2);
    }
  }

  // Just beyond the open leaves, the guards stay beside the road and the register table
  // sits on the paved shoulder clear of the gate's moving-vehicle lane.
  person("campus-guard-west", annotationToWorld([882.5, 846.2]), Math.PI * 0.23, 0.21, "Idle_Loop", 6, 1.07, true);
  person("campus-guard-east", annotationToWorld([913.7, 853.7]), -Math.PI * 0.32, 0.21, "Idle_Loop", 6, 1.03, true);
  const writerPosition = annotationToWorld([908.5, 857.2]);
  const writerYaw = -Math.PI / 2;
  const desk = rootAt("gate-security-station", writerPosition, writerYaw, 0.065);
  box(desk, "gate-security-concrete-pad", concrete, 2.45, 0.08, 2.22, 0, -0.04, 0.22);
  box(desk, "gate-security-desk-top", wood, 1.28, 0.075, 0.66, 0, 0.713, 0.45, true);
  for (const x of [-0.54, 0.54]) {
    for (const z of [0.19, 0.71]) box(desk, "gate-security-desk-leg", steel, 0.065, 0.67, 0.065, x, 0.335, z);
  }
  box(desk, "gate-security-chair-seat", steel, 0.49, 0.058, 0.49, 0, 0.425, -0.28, true);
  box(desk, "gate-security-chair-back", steel, 0.49, 0.28, 0.062, 0, 0.74, -0.5, true);
  for (const x of [-0.19, 0.19]) {
    for (const z of [-0.46, -0.1]) box(desk, "gate-security-chair-leg", steel, 0.04, 0.42, 0.04, x, 0.21, z);
    box(desk, "gate-security-chair-back-upright", steel, 0.045, 0.41, 0.044, x, 0.625, -0.496);
  }
  box(desk, "gate-security-open-register-cover", steel, 0.47, 0.018, 0.3, 0.024, 0.759, 0.305);
  for (const x of [-0.085, 0.133]) {
    box(desk, "gate-security-register-page", paper, 0.213, 0.013, 0.279, x, 0.772, 0.305);
    for (let line = 0; line < 6; line++) {
      box(desk, "gate-security-register-line", ink, 0.176, 0.001, 0.002, x, 0.779, 0.212 + line * 0.032);
    }
  }
  const writer = person("campus-guard-register", writerPosition, writerYaw, 0.065, "Gate_Register_Loop", 6, 1, true);
  writer.pen = box(desk, "gate-security-pen", ink, 0.012, 0.103, 0.012, -0.1, 0.83, 0.28);
  writer.pen.rotation.z = -0.38;

  if (typeof document !== "undefined") {
    const label = new DynamicTexture("security-register-label", { width: 512, height: 112 }, scene, false);
    label.drawText("SECURITY  ·  ENTRY REGISTER", null, 69, "bold 29px sans-serif", "#faf1db", "#2b3d4e", true, true);
    const labelFinish = material("security-register-plaque", "#ffffff");
    labelFinish.albedoTexture = label;
    labelFinish.unlit = true;
    labelFinish.backFaceCulling = false;
    const sign = CreatePlane("gate-security-entry-sign", { width: 1.11, height: 0.242 }, scene);
    sign.parent = desk;
    sign.position.set(0, 0.552, 0.755);
    sign.rotation.y = Math.PI;
    sign.material = labelFinish;
    sign.isPickable = false;
  }

  function enableRig(actor: Actor, container: AssetContainer) {
    const name = actor.root.name;
    const clone = container.instantiateModelsToScene((original) => `${name}/${original}`, false, {
      predicate: (item) => !(item instanceof AnimationGroup) || item.name === actor.action ||
        actor.action === "Walk_Loop" && item.name === "Idle_Loop",
    });
    const animations = new Map<Action, AnimationGroup>();
    for (const animation of clone.animationGroups) {
      animations.set(animation.name.slice(name.length + 1) as Action, animation);
    }
    actor.animations = animations;
    const shadow = CreateGround(`${name}-contact-shadow`, { width: 0.8, height: 1.06 }, scene);
    shadow.parent = actor.root;
    shadow.position.y = 0.005;
    shadow.material = contactShadow;
    shadow.isPickable = false;
    actor.shadow = shadow;
    for (const model of clone.rootNodes) {
      model.parent = actor.root;
      if (!(model instanceof TransformNode)) continue;
      actor.model = model;
      actor.head = model.getChildTransformNodes().find((node) => node.name === `${name}/head`);
      actor.writingHand = model.getChildTransformNodes().find((node) => node.name === `${name}/hand_r`);
      for (const mesh of model.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const base = mesh.material;
        if (!(base instanceof PBRMaterial)) continue;
        const tone = palettes[actor.palette];
        const color = base.name === "top" ? tone.shirt : base.name === "bottom" ? tone.pants : base.name === "body" ? tone.skin : null;
        if (!color) continue;
        const key = `${base.name}-${color}`;
        let finish = materialPalettes.get(key);
        if (!finish) {
          finish = base.clone(`crowd-${key}`);
          finish.albedoColor = Color3.FromHexString(color).toLinearSpace();
          materialPalettes.set(key, finish);
        }
        mesh.material = finish;
      }
    }
    if (actor.guard) {
      actor.cap = new TransformNode(`${name}-cap`, scene);
      const hat = CreateCylinder("security-cap", { height: 0.056, diameterTop: 0.22, diameterBottom: 0.197, tessellation: 12 }, scene);
      hat.parent = actor.cap;
      hat.material = securityBlue;
      hat.isPickable = false;
      box(actor.cap, "security-cap-visor", securityBlue, 0.165, 0.016, 0.107, 0, -0.018, 0.109);
      box(actor.cap, "security-cap-badge", brass, 0.032, 0.026, 0.008, 0, 0.002, 0.114);
    }
  }

  function pose(actor: Actor) {
    const action = actor.walking ? actor.action : "Idle_Loop";
    const group = actor.animations?.get(action);
    if (!group) return;
    if (group !== actor.current) {
      actor.current?.stop();
      group.start(true);
      group.pause();
      actor.current = group;
    }
    const duration = group.to - group.from;
    const framesPerSecond = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    const phase = action === "Campus_Chant_Loop" ? actor.phase + time * 1.18
      : actor.phase + time * (action === "Walk_Loop" ? 0.94 : reducedMotion ? 0.35 : 1);
    const frame = reducedMotion && action === "Campus_Chant_Loop" ? duration * 0.14 : phase * framesPerSecond % duration;
    group.goToFrame(group.from + frame);
    if (actor.cap && actor.head) {
      actor.cap.position.copyFrom(actor.head.getAbsolutePosition());
      actor.cap.position.y += 0.177 * actor.root.scaling.y;
      actor.cap.rotation.y = actor.root.rotation.y;
    }
    if (actor.pen && actor.writingHand) {
      const hand = actor.writingHand.getAbsolutePosition();
      const inverse = actor.pen.parent!.getWorldMatrix().clone().invert();
      Vector3.TransformCoordinatesToRef(hand, inverse, actor.pen.position);
      actor.pen.position.y -= 0.029;
      actor.pen.position.z += 0.034;
    }
  }

  function updatePatrol(patrol: Patrol, delta: number, blockers: readonly PedestrianBlocker[]) {
    const length = patrol.distances.at(-1)!;
    const next = Math.min(length, Math.max(0, patrol.distance + (patrol.forward ? 1 : -1) * patrol.speed * delta));
    const segment = Math.max(0, Math.min(patrol.distances.length - 2, patrol.distances.findIndex((at) => at > next) - 1));
    const index = next === length ? patrol.distances.length - 2 : segment;
    const start = patrol.points[index];
    const end = patrol.points[index + 1];
    const yaw = heading(start, end);
    const ratio = (next - patrol.distances[index]) / (patrol.distances[index + 1] - patrol.distances[index]);
    const center: WorldGroundPoint = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
    const positions = patrol.members.map((_, member) => offset(center, yaw, (member - (patrol.members.length - 1) / 2) * 0.66, 0));
    const blocked = positions.some(([x, z]) => blockers.some(({ position: [obstacleX, obstacleZ], radius }) =>
      Math.hypot(x - obstacleX, z - obstacleZ) < radius + 0.36,
    ));
    const walking = !blocked && patrol.pause <= 0;
    if (walking) patrol.distance = next;
    patrol.pause = Math.max(0, patrol.pause - delta);
    for (const [member, actor] of patrol.members.entries()) {
      if (walking || delta === 0) {
        const [x, z] = positions[member];
        actor.root.position.x = x;
        actor.root.position.z = z;
      }
      const direction = yaw + (patrol.forward ? 0 : Math.PI);
      const turn = direction - actor.root.rotation.y;
      actor.root.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, delta * 8);
      actor.walking = walking;
    }
    if (walking && (next === 0 && !patrol.forward || next === length && patrol.forward)) {
      patrol.forward = !patrol.forward;
      patrol.pause = 0.55;
    }
  }

  for (const patrol of patrols) updatePatrol(patrol, 0, []);
  const forwardAxis = Vector3.Forward(scene.useRightHandedSystem);
  void LoadAssetContainerAsync(crowdUrl, scene, { pluginOptions: { gltf: { animationStartMode: 0 } } })
    .then((container) => {
      if (scene.isDisposed) {
        container.dispose();
        return;
      }
      source = container;
      for (const actor of actors) {
        enableRig(actor, container);
        pose(actor);
      }
    }).catch((error: unknown) => {
      if (!scene.isDisposed) console.warn("Campus pedestrians could not be loaded.", error);
    });

  scene.onBeforeRenderObservable.add(() => {
    if (paused) return;
    const delta = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    time += delta;
    const obstacles = nearbyObstacles();
    for (const patrol of patrols) updatePatrol(patrol, delta, obstacles);
    poseAge += delta;
    if (poseAge < 1 / 30) return;
    poseAge %= 1 / 30;
    const camera = scene.activeCamera;
    const eye = camera?.globalPosition;
    const forward = camera?.getDirection(forwardAxis);
    const range = scene.getEngine().getHardwareScalingLevel() >= 1.5 ? 68 : 105;
    for (const actor of actors) {
      const { x, z } = actor.root.position;
      const dx = x - (eye?.x ?? 0);
      const dz = z - (eye?.z ?? 0);
      const distanceSquared = dx * dx + dz * dz;
      const inFront = !forward || distanceSquared < 12 ** 2 || dx * forward.x + dz * forward.z > -5;
      const close = !eye || (distanceSquared < range ** 2 && eye.y < 75 && inFront);
      actor.model?.setEnabled(close);
      actor.cap?.setEnabled(close);
      actor.shadow?.setEnabled(close);
      if (close) pose(actor);
    }
  });

  scene.onDisposeObservable.addOnce(() => { source?.dispose(); });
  return {
    chantCenters,
    blockers: (): PedestrianBlocker[] => actors.map(({ root, radius }) => ({ position: [root.position.x, root.position.z], radius })),
    setPaused(value: boolean) { paused = value; },
    setReducedMotion(value: boolean) { reducedMotion = value; },
  };
}
