import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";
import { annotationToWorld, southernEntrance, type AnnotationPoint, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusGardens } from "@gta-mmmut/world-data/campus-gardens";
import { deoriaRoad } from "@gta-mmmut/world-data/deoria-road";
import { createContactShadowMaterial } from "./campus-vehicles";

export type TrafficObstacle = { readonly position: WorldGroundPoint } & (
  { readonly radius: number } |
  { readonly yaw: number; readonly halfWidth: number; readonly halfLength: number }
);

interface RoadPoint {
  position: WorldGroundPoint;
  speed: number;
}

interface RoutePoint extends RoadPoint {
  distance: number;
  yaw: number;
}

interface Route {
  points: readonly RoutePoint[];
  length: number;
}

const scorpio = {
  id: "scorpio",
  url: new URL("./assets/vehicles/scorpio.glb", import.meta.url).href,
  halfWidth: 0.97, halfLength: 2.28, height: 2.11, wheelRadius: 0.386, wheelbase: 2.848,
};
const alto = {
  id: "alto",
  url: new URL("./assets/vehicles/alto-800.glb", import.meta.url).href,
  halfWidth: 0.89, halfLength: 1.75, height: 1.54, wheelRadius: 0.257, wheelbase: 2.379,
};
type CarSpec = typeof scorpio;

interface TrafficCar {
  spec: CarSpec;
  model: TransformNode;
  wheels: { node: TransformNode; front: boolean }[];
  brakeLights: PBRMaterial[];
}

const wheelName = /^wheel-(front|rear)-(left|right)$/;
const rearLightName = /^(backlight|left_rear_light|right_rear_light)$/;
const ground = 0.026;
const acceleration = 1.8;
const braking = 4;
const lookAhead = 15;
const sampleSpacing = 0.65;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function distance(a: WorldGroundPoint, b: WorldGroundPoint) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function interpolate(a: WorldGroundPoint, b: WorldGroundPoint, t: number): WorldGroundPoint {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function routeFrom(waypoints: readonly RoadPoint[], cornerRadius = 3.2): Route {
  const path: RoadPoint[] = [waypoints[0]];
  for (let index = 1; index < waypoints.length - 1; index++) {
    const before = waypoints[index - 1];
    const corner = waypoints[index];
    const after = waypoints[index + 1];
    const incoming = distance(before.position, corner.position);
    const outgoing = distance(corner.position, after.position);
    const cut = Math.min(cornerRadius, incoming * 0.45, outgoing * 0.45);
    const entry = interpolate(corner.position, before.position, cut / incoming);
    const exit = interpolate(corner.position, after.position, cut / outgoing);
    path.push({ position: entry, speed: corner.speed });
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const start = interpolate(entry, corner.position, t);
      const end = interpolate(corner.position, exit, t);
      path.push({ position: interpolate(start, end, t), speed: corner.speed });
    }
  }
  path.push(waypoints[waypoints.length - 1]);

  let cumulative = 0;
  const points = path.map((point, index): RoutePoint => {
    const previous = path[Math.max(0, index - 1)].position;
    const next = path[Math.min(path.length - 1, index + 1)].position;
    cumulative += distance(previous, point.position);
    return { ...point, distance: cumulative, yaw: Math.atan2(next[0] - previous[0], next[1] - previous[1]) };
  });
  return { points, length: cumulative };
}

function sampleRoute(route: Route, offset: number) {
  let low = 0;
  let high = route.points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (route.points[middle].distance <= offset) low = middle;
    else high = middle;
  }
  const a = route.points[low];
  const b = route.points[high];
  const t = Math.max(0, Math.min(1, (offset - a.distance) / (b.distance - a.distance)));
  return {
    position: interpolate(a.position, b.position, t),
    yaw: a.yaw + angleDelta(a.yaw, b.yaw) * t,
    speed: lerp(a.speed, b.speed, t),
  };
}

function roadPoints(points: readonly AnnotationPoint[], speed: number): RoadPoint[] {
  return points.map((point) => ({ position: annotationToWorld(point), speed }));
}

function centerline(id: string) {
  const line = southernEntrance.centerlines.find((entry) => entry.id === id);
  if (!line) throw new Error(`Missing campus traffic centerline ${id}`);
  return line.points;
}

function createRoutes() {
  const frontageLane = deoriaRoad.carriageways[0].laneCenters[0];
  const west = deoriaRoad.annotationBounds.left;
  const east = deoriaRoad.annotationBounds.right;
  // The east half of the gate approach leaves room for the parked player sedan.
  const gateLane = [...centerline("gate-apron")].reverse()
    .concat([...centerline("entrance-approach")].reverse().slice(1))
    .map(([x, z]): AnnotationPoint => [x + 5, z]);
  const gateX = gateLane[0][0];
  const eastBranch = [
    ...centerline("splitter-east").slice(1),
    ...centerline("east-campus-connection").slice(1),
  ];
  const lane = centerline("east-paved-link");
  const { driveway, stalls } = campusGardens.placementParking;
  const drivewayX = (driveway[0][0] + driveway[1][0]) / 2;
  const drivewayMouth = driveway[0][1];
  const roadY = lerp(lane[0][1], lane[1][1], (drivewayX - lane[0][0]) / (lane[1][0] - lane[0][0]));
  const stallX = stalls.left + stalls.width * 4.5;
  const parkEntry: readonly AnnotationPoint[] = [
    [drivewayX, drivewayMouth],
    [stallX, stalls.top + stalls.depth + 5],
    [stallX, stalls.top + stalls.depth / 2],
  ];
  const roadTurn: AnnotationPoint = [drivewayX, roadY];
  const reverseEnd: AnnotationPoint = [drivewayX + 15, roadY];

  const arrival = routeFrom([
    ...roadPoints([[west + 18, frontageLane]], 10),
    ...roadPoints([[gateX - 34, frontageLane]], 7),
    ...roadPoints([[gateX, frontageLane], ...gateLane.slice(0, 3)], 3.2),
    ...roadPoints([...gateLane.slice(3), ...eastBranch], 5.5),
    ...roadPoints([[drivewayX - 14, roadY]], 4),
    ...roadPoints([roadTurn, ...parkEntry], 2.2),
  ]);
  const backing = routeFrom(roadPoints([...parkEntry].reverse().concat([roadTurn, reverseEnd]), 1.8));
  const departure = routeFrom([
    ...roadPoints([reverseEnd, roadTurn, [drivewayX - 14, roadY]], 2.8),
    ...roadPoints([...eastBranch].reverse(), 5.5),
    ...roadPoints([...gateLane.slice(3)].reverse(), 5.5),
    ...roadPoints([...gateLane.slice(0, 3)].reverse(), 3.2),
    ...roadPoints([[gateX, frontageLane]], 3.2),
    ...roadPoints([[gateX + 24, frontageLane], [east - 18, frontageLane]], 9),
  ]);
  const firstArrival = distance(annotationToWorld([west + 18, frontageLane]),
    annotationToWorld([gateX - 46, frontageLane]));
  return { arrival, backing, departure, firstArrival };
}

function overlaps(spec: CarSpec, position: WorldGroundPoint, yaw: number, other: TrafficObstacle) {
  const x = other.position[0] - position[0];
  const z = other.position[1] - position[1];
  const width = spec.halfWidth + 0.16;
  const length = spec.halfLength + 0.22;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const side = x * cos - z * sin;
  const front = x * sin + z * cos;
  if ("radius" in other) {
    const dx = Math.max(0, Math.abs(side) - width);
    const dz = Math.max(0, Math.abs(front) - length);
    return dx * dx + dz * dz <= other.radius * other.radius;
  }

  // Test the two axes of each oriented box so a parallel parked car does not block the lane.
  const across = Math.abs(Math.cos(other.yaw - yaw));
  const along = Math.abs(Math.sin(other.yaw - yaw));
  if (Math.abs(side) > width + other.halfWidth * across + other.halfLength * along ||
      Math.abs(front) > length + other.halfWidth * along + other.halfLength * across) return false;
  const otherSide = x * Math.cos(other.yaw) - z * Math.sin(other.yaw);
  const otherFront = x * Math.sin(other.yaw) + z * Math.cos(other.yaw);
  return Math.abs(otherSide) <= other.halfWidth + width * across + length * along &&
    Math.abs(otherFront) <= other.halfLength + width * along + length * across;
}

export function createCampusTraffic(scene: Scene) {
  const routes = createRoutes();
  const root = new TransformNode("campus-traffic", scene);
  const collider = CreateBox("campus-traffic-collider", { size: 1 }, scene);
  collider.parent = root;
  collider.material = new PBRMaterial("campus-traffic-collider", scene);
  collider.isVisible = false;
  collider.isPickable = false;
  collider.checkCollisions = true;
  const shadow = CreateGround("campus-traffic-shadow", { width: 1, height: 1 }, scene);
  shadow.parent = root;
  shadow.position.y = 0.025;
  shadow.material = createContactShadowMaterial(scene);
  shadow.isPickable = false;
  root.setEnabled(false);

  let phase: "arrival" | "parking" | "backing" | "departure" | "cooldown" = "arrival";
  let offset = routes.firstArrival;
  let wait = 0;
  let speed = 0;
  let roll = 0;
  let active: TrafficCar | undefined;
  let firstCar: TrafficCar | undefined;
  let secondCar: TrafficCar | undefined;
  let loadingSecond = false;
  const brakeGlow = new Color3(0.3, 0.014, 0.01);

  async function loadCar(spec: CarSpec): Promise<TrafficCar | undefined> {
    const model = new TransformNode(`campus-traffic-${spec.id}`, scene);
    model.setEnabled(false);
    model.parent = root;
    const car: TrafficCar = { spec, model, wheels: [], brakeLights: [] };
    try {
      const parkedAlto = spec === alto
        ? scene.getTransformNodeByName("hatchback-model-pose")?.getChildMeshes(true)
            .find((mesh) => mesh.name === "__root__")
        : undefined;
      if (parkedAlto) {
        parkedAlto.instantiateHierarchy(model, { doNotInstantiate: true }, (source, clone) => {
          if (wheelName.test(source.name)) car.wheels.push({ node: clone, front: source.name.startsWith("wheel-front") });
          // Keep the parked car's materials shared, except for its independently lit brake lenses.
          if (clone instanceof AbstractMesh && clone.material instanceof PBRMaterial && rearLightName.test(clone.material.name)) {
            const lens = clone.material.clone(`traffic-${clone.material.name}`);
            clone.material = lens;
            car.brakeLights.push(lens);
          }
        });
        return car;
      }
      const container = await LoadAssetContainerAsync(spec.url, scene);
      if (scene.isDisposed) return;
      const modelRoot = container.meshes[0];
      if (!modelRoot) {
        container.dispose();
        throw new Error("Traffic model is empty");
      }
      for (const mesh of container.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      }
      for (const material of container.materials) {
        if (!(material instanceof PBRMaterial)) continue;
        if (spec === scorpio && material.name === "body_mat") {
          material.albedoColor = Color3.FromHexString("#75454f").toLinearSpace();
        }
        if (rearLightName.test(material.name)) car.brakeLights.push(material);
      }
      for (const node of new Set([...container.meshes, ...container.transformNodes])) {
        if (wheelName.test(node.name)) car.wheels.push({ node, front: node.name.startsWith("wheel-front") });
      }
      container.addAllToScene();
      modelRoot.parent = model;
      return car;
    } catch (error) {
      if (!scene.isDisposed) {
        model.dispose();
        console.warn(`Could not load the ${spec.id} campus traffic car.`, error);
      }
    }
  }

  function selectCar(car: TrafficCar) {
    active?.model.setEnabled(false);
    active = car;
    const { halfWidth, halfLength, height } = car.spec;
    collider.scaling.set(halfWidth * 2, height, halfLength * 2);
    collider.position.y = height / 2;
    shadow.scaling.set(halfWidth * 2.95, 1, halfLength * 2.6);
    car.model.setEnabled(true);
  }

  void loadCar(scorpio).then((car) => {
    if (!car || scene.isDisposed) return;
    firstCar = car;
    selectCar(car);
    place(car, routes.arrival, offset, false);
    root.setEnabled(true);
  });

  function place(car: TrafficCar, route: Route, at: number, reverse: boolean) {
    const { position: [x, z], yaw } = sampleRoute(route, at);
    root.position.set(x, ground, z);
    root.rotation.y = yaw + (reverse ? Math.PI : 0);
    collider.computeWorldMatrix(true);
    const upcoming = sampleRoute(route, Math.min(route.length, at + 0.8)).yaw;
    const turn = Math.max(-0.52, Math.min(0.52, angleDelta(yaw, upcoming) * car.spec.wheelbase / 0.8));
    for (const { node, front } of car.wheels) {
      const steer = front ? turn * (reverse ? -1 : 1) : 0;
      node.rotationQuaternion ??= Quaternion.Identity();
      Quaternion.RotationYawPitchRollToRef(steer, roll, 0, node.rotationQuaternion);
    }
  }

  function remainingSpace(spec: CarSpec, route: Route, reverse: boolean, blockers: readonly TrafficObstacle[]) {
    const limit = Math.min(lookAhead, route.length - offset);
    for (let ahead = 0; ahead <= limit; ahead += sampleSpacing) {
      const { position, yaw } = sampleRoute(route, offset + ahead);
      if (blockers.some((obstacle) => overlaps(spec, position, yaw + (reverse ? Math.PI : 0), obstacle))) {
        return Math.max(0, ahead - sampleSpacing);
      }
    }
    return limit;
  }

  function cameraNear([x, z]: WorldGroundPoint) {
    const camera = scene.activeCamera?.globalPosition;
    return camera && Math.hypot(camera.x - x, camera.y - ground, camera.z - z) < 40;
  }

  return {
    update(elapsed: number, blockers: readonly TrafficObstacle[]) {
      if (!active || !Number.isFinite(elapsed) || elapsed <= 0) return;
      const dt = Math.min(elapsed, 0.1);
      if (phase === "parking" || phase === "cooldown") {
        wait -= dt;
        if (wait > 0) return;
        if (phase === "cooldown") {
          const next = (active === firstCar ? secondCar : firstCar) ?? active;
          const spawn = routes.arrival.points[0];
          if (cameraNear(spawn.position) ||
              blockers.some((obstacle) => overlaps(next.spec, spawn.position, spawn.yaw, obstacle))) return;
          if (next !== active) selectCar(next);
          roll = 0;
          phase = "arrival";
        } else {
          phase = "backing";
        }
        offset = 0;
        place(active, routes[phase], offset, phase === "backing");
        root.setEnabled(true);
      }

      const route = routes[phase];
      const reverse = phase === "backing";
      const left = route.length - offset;
      const clear = remainingSpace(active.spec, route, reverse, blockers);
      const target = Math.min(sampleRoute(route, offset).speed,
        Math.sqrt(2 * braking * Math.max(0, clear - (clear < Math.min(left, lookAhead) ? 0.45 : 0))));
      const delta = target - speed;
      speed += Math.sign(delta) * Math.min(Math.abs(delta), (delta < 0 ? braking : acceleration) * dt);
      const step = Math.min(clear, speed * dt);
      for (const light of active.brakeLights) {
        if (delta < -0.15 || target < 0.1) light.emissiveColor.copyFrom(brakeGlow);
        else light.emissiveColor.set(0, 0, 0);
      }
      offset += step;
      roll = (roll + (reverse ? -1 : 1) * step / active.spec.wheelRadius) % (2 * Math.PI);
      place(active, route, offset, reverse);
      if (route.length - offset > 0.025) return;

      speed = 0;
      offset = 0;
      if (phase === "arrival") {
        phase = "parking";
        wait = 16;
        if (!secondCar && !loadingSecond) {
          loadingSecond = true;
          void loadCar(alto).then((car) => {
            secondCar = car;
            loadingSecond = false;
          });
        }
      } else if (phase === "backing") {
        phase = "departure";
      } else {
        if (cameraNear([root.position.x, root.position.z])) {
          offset = route.length;
          return;
        }
        phase = "cooldown";
        wait = 9;
        root.setEnabled(false);
      }
    },
    obstacle(): TrafficObstacle | null {
      if (!active || !root.isEnabled()) return null;
      const { halfWidth, halfLength } = active.spec;
      return { position: [root.position.x, root.position.z], yaw: root.rotation.y, halfWidth, halfLength };
    },
  };
}
