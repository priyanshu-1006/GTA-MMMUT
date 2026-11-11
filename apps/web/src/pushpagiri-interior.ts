import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type FurnishedInterior, type InteriorBounds } from "./interior-furnishing";
import { buildModernLectureClassroom } from "./modern-lecture-classroom";

const extent = [-33, -26.8, 33, 2.2] as const;
const upperY = 3.72;
const rearDoorZ = -14.4;
const frontDoorZ = -8.4;
const frontZ = extent[3];
const rearZ = extent[1];
const rearRoomHalf = 29;
const flankInner = 10.8;
const flankOuter = 25.4;
const washroomOuter = 28.9;
const stairInner = 30.6;
const stairEnd = 0.27;
const voidHalf = 8.3;
const voidFront = -0.3;
const wallHeight = 3.48;
const doorHeight = 2.32;

const rearIds = [
  ["L-121", "L-120", "L-119", "L-118", "L-117"],
  ["L-220", "L-219", null, "L-218", "L-217"],
] as const;

interface Room {
  readonly label: string;
  readonly floor: 0 | 1;
  readonly bounds: InteriorBounds;
  readonly doorZ: number;
  readonly kind: "lecture" | "washroom";
}

const frontIds = [["L-122", "L-116"], ["L-221", "L-216"]] as const;
const rooms: Room[] = [];
for (const level of [0, 1] as const) {
  const width = 2 * rearRoomHalf / 5;
  for (const [index, label] of rearIds[level].entries()) {
    if (!label) continue;
    const left = -rearRoomHalf + index * width;
    rooms.push({ label, floor: level, bounds: [left, rearZ, left + width, rearDoorZ], doorZ: rearDoorZ, kind: "lecture" });
  }
  rooms.push(
    { label: frontIds[level][0], floor: level, bounds: [-flankOuter, frontDoorZ, -flankInner, frontZ], doorZ: frontDoorZ, kind: "lecture" },
    { label: frontIds[level][1], floor: level, bounds: [flankInner, frontDoorZ, flankOuter, frontZ], doorZ: frontDoorZ, kind: "lecture" },
    { label: "Washroom", floor: level, bounds: [-washroomOuter, frontDoorZ, -flankOuter, frontZ], doorZ: frontDoorZ, kind: "washroom" },
  );
}

const rearTerrace = [-rearRoomHalf / 5, rearZ, rearRoomHalf / 5, rearDoorZ] as const;
const galleries: readonly InteriorBounds[] = [
  [-33, rearDoorZ, 33, frontDoorZ],
  [-flankInner, frontDoorZ, -voidHalf, frontZ],
  [voidHalf, frontDoorZ, flankInner, frontZ],
  [-voidHalf, voidFront, voidHalf, frontZ],
  [-stairInner, frontDoorZ, -washroomOuter, frontZ],
  [flankOuter, frontDoorZ, stairInner, frontZ],
  [-33, stairEnd, -stairInner, frontZ],
  [stairInner, stairEnd, 33, frontZ],
  rearTerrace,
];

function contains([left, rear, right, front]: InteriorBounds, x: number, z: number) {
  return x >= left && x <= right && z >= rear && z <= front;
}

function stairY(x: number, z: number) {
  if (Math.abs(x) < stairInner || z < frontDoorZ || z > stairEnd) return undefined;
  return upperY * (z - frontDoorZ) / (stairEnd - frontDoorZ);
}

export function buildPushpagiriInterior(scene: Scene): FurnishedInterior {
  scene.clearColor = new Color4(0.66, 0.77, 0.81, 1);
  const { material, patterned, box, floor, railing, sign, openClassroomDoor, finish } = createInteriorFurnishing(scene, "pushpagiri");
  const plaster = material("cream-plaster", "#e8d5c0");
  const wallTrim = material("brown-skirting", "#825d48");
  const jamb = material("blue-green-door-frames", "#386465");
  const doorGlass = material("smoked-door-glazing", "#2e4246");
  const concrete = material("stair-risers", "#a89f90");
  const rail = material("railing-iron", "#3e4a48");
  const railCap = material("railing-handles", "#6f5043");
  const light = material("corridor-fixtures", "#fff0d8", true);
  const ceiling = material("ceiling-soffit", "#ddd5c8", true);
  const roof = material("reinforced-concrete-roof", "#c6bcae");
  const gateTile = patterned("courtyard-paving", "#b4a28c", "#8f8174");
  const corridorTile = patterned("gallery-terrazzo", "#d8ccbb", "#aba08f");
  const roomTile = patterned("classroom-floor", "#c6c3b9", "#a49f93");
  const washTile = patterned("washroom-floor", "#9fbbb8", "#718e8d");
  const porcelain = material("porcelain", "#f2eee3");
  const partition = material("washroom-partition", "#7e908b");
  const mirror = material("washroom-mirror", "#c5dde0", true);
  const placedWalls = new Set<string>();
  const roomSurfaces: { room: Room; surface(x: number, z: number): number }[] = [];

  floor(gateTile, extent, 0, 0.69);
  floor(corridorTile, [-33, rearDoorZ, 33, frontDoorZ], 0.003, 0.72);

  for (const bounds of galleries) deck(bounds, upperY);

  // The rear gallery spans L-119. The front gallery wraps the void over the
  // entrance court beneath a continuous roof.
  railing(rail, railCap, [rearTerrace[0], upperY, rearZ], [rearTerrace[2], upperY, rearZ]);
  railing(rail, railCap, [-voidHalf, upperY, frontDoorZ], [voidHalf, upperY, frontDoorZ]);
  railing(rail, railCap, [-voidHalf, upperY, voidFront], [voidHalf, upperY, voidFront]);
  railing(rail, railCap, [-flankInner, upperY, frontZ], [flankInner, upperY, frontZ]);
  for (const side of [-1, 1]) {
    railing(rail, railCap, [side * voidHalf, upperY, frontDoorZ], [side * voidHalf, upperY, voidFront]);
    railing(rail, railCap, [side * 33, upperY, rearDoorZ], [side * 33, upperY, frontDoorZ]);
    railing(rail, railCap, [side * 33, upperY, rearDoorZ], [side * rearRoomHalf, upperY, rearDoorZ]);
    const walkwayEdge = side < 0 ? -washroomOuter : flankOuter;
    railing(rail, railCap, [side * 33, upperY, frontZ], [walkwayEdge, upperY, frontZ]);
    staircase(side);
  }

  const gate = 2.6;
  wallAlongX(-flankInner, -gate / 2, frontZ, 0);
  wallAlongX(gate / 2, flankInner, frontZ, 0);
  box(plaster, [0, (doorHeight + wallHeight) / 2, frontZ], [gate, wallHeight - doorHeight, 0.18], true);
  for (const side of [-1, 1]) {
    box(jamb, [side * (gate / 2 + 0.03), doorHeight / 2, frontZ - 0.08], [0.13, doorHeight, 0.24]);
    wallAlongZ(side * 33, rearDoorZ, frontZ, 0);
    wallAlongX(side < 0 ? -33 : rearRoomHalf, side < 0 ? -rearRoomHalf : 33, rearDoorZ, 0);
    wallAlongX(side < 0 ? -33 : flankOuter, side < 0 ? -washroomOuter : 33, frontZ, 0);
  }
  sign("entry-gallery-sign", [0, 2.94, frontZ - 0.11], 5.9, 0.74, "PUSHPAGIRI LECTURE HALL COMPLEX", "पुष्पागिरि व्याख्यान भवन", Math.PI);

  for (const room of rooms) {
    const y = room.floor * upperY;
    const [left, rear, right, front] = room.bounds;
    const doorway = room.kind === "washroom" ? (left + right) / 2 : left + 1.64;
    const doorWidth = room.kind === "washroom" ? 1.17 : 1.58;
    const inward = room.doorZ === front ? 1 : -1;
    wallAlongZ(left, rear, front, y);
    wallAlongZ(right, rear, front, y);
    wallAlongX(left, right, room.doorZ === front ? rear : front, y);
    wallAlongX(left, doorway - doorWidth / 2, room.doorZ, y);
    wallAlongX(doorway + doorWidth / 2, right, room.doorZ, y);
    box(plaster, [doorway, y + (doorHeight + wallHeight) / 2, room.doorZ], [doorWidth, wallHeight - doorHeight, 0.18], true);
    box(jamb, [doorway, y + doorHeight, room.doorZ + inward * 0.02], [doorWidth + 0.15, 0.11, 0.23]);
    for (const edge of [-1, 1]) {
      box(jamb, [doorway + edge * (doorWidth / 2 + 0.025), y + doorHeight / 2, room.doorZ + inward * 0.02],
        [0.11, doorHeight, 0.23]);
    }
    const id = room.kind === "washroom" ? `washroom-${room.floor}` : room.label.toLowerCase();
    sign(id, [doorway, y + 2.62, room.doorZ + inward * 0.104], 1.38, 0.33, room.label, undefined, inward > 0 ? 0 : Math.PI);
    if (room.kind === "washroom") {
      floor(washTile, room.bounds, y + 0.008, 0.48);
      washroom(room.bounds, y);
      roomSurfaces.push({ room, surface: () => y });
    } else {
      openClassroomDoor(jamb, doorGlass, [doorway, y, room.doorZ], false, -inward, doorWidth, doorHeight);
      floor(roomTile, room.bounds, y + 0.008, 0.71);
      roomSurfaces.push({ room, surface: buildModernLectureClassroom(scene, {
        id: `pushpagiri-${id}`, bounds: room.bounds, floorY: y, front: "west", ceilingHeight: wallHeight,
      }) });
    }
    box(ceiling, [(left + right) / 2, y + wallHeight + 0.08, (rear + front) / 2],
      [right - left, 0.16, front - rear], true);
  }

  for (const x of [-30, -23, -16, -9, 0, 9, 16, 23, 30]) {
    box(light, [x, upperY - 0.235, (frontDoorZ + rearDoorZ) / 2], [1.46, 0.045, 0.25]);
  }
  const roofBase = upperY + wallHeight + 0.16;
  const roofWidth = extent[2] - extent[0] + 0.5;
  const roofDepth = frontZ - rearZ + 0.5;
  const roofCenterZ = (rearZ + frontZ) / 2;
  box(roof, [0, roofBase + 0.14, roofCenterZ], [roofWidth, 0.28, roofDepth], true);
  for (const x of [-32.5, -11, 11, 32.5]) {
    box(ceiling, [x, roofBase - 0.145, roofCenterZ], [0.26, 0.29, roofDepth - 0.4]);
  }
  for (const z of [rearDoorZ - 1.2, (rearDoorZ + frontDoorZ) / 2, frontZ - 0.95]) {
    box(ceiling, [0, roofBase - 0.13, z], [roofWidth - 0.4, 0.26, 0.32]);
    for (const x of [-27, -18, -8, 0, 8, 18, 27]) {
      box(light, [x, roofBase - 0.28, z], [1.52, 0.035, 0.16]);
    }
  }
  finish();

  function wallAlongX(left: number, right: number, z: number, y: number) {
    const key = `x/${left}/${right}/${z}/${y}`;
    if (placedWalls.has(key) || right <= left) return;
    placedWalls.add(key);
    box(plaster, [(left + right) / 2, y + wallHeight / 2, z], [right - left, wallHeight, 0.18], true);
    box(wallTrim, [(left + right) / 2, y + 0.078, z], [right - left, 0.156, 0.194]);
  }

  function wallAlongZ(x: number, rear: number, front: number, y: number) {
    const key = `z/${x}/${rear}/${front}/${y}`;
    if (placedWalls.has(key)) return;
    placedWalls.add(key);
    box(plaster, [x, y + wallHeight / 2, (rear + front) / 2], [0.18, wallHeight, front - rear], true);
    box(wallTrim, [x, y + 0.078, (rear + front) / 2], [0.194, 0.156, front - rear]);
  }

  function deck(bounds: InteriorBounds, height: number) {
    const [left, rear, right, front] = bounds;
    box(ceiling, [(left + right) / 2, height - 0.115, (rear + front) / 2],
      [right - left, 0.23, front - rear], true);
    floor(corridorTile, bounds, height + 0.006, 0.72);
  }

  function staircase(side: number) {
    const width = 33 - stairInner;
    const x = side * (33 + stairInner) / 2;
    const steps = 22;
    const run = (stairEnd - frontDoorZ) / steps;
    for (let step = 0; step < steps; step++) {
      const y = (step + 1) * upperY / steps;
      const z = frontDoorZ + (step + 0.5) * run;
      box(concrete, [x, y / 2, z], [width, y, run + 0.002]);
      box(wallTrim, [x, y - 0.022, z - run / 2 + 0.025], [width, 0.044, 0.05]);
      if (y > 0.24) {
        const collision = box(concrete, [x, (y - 0.24) / 2, z], [width, y - 0.24, run], true);
        collision.visibility = 0;
      }
    }
    for (const edge of [stairInner, 33]) {
      railing(rail, railCap, [side * edge, 0, frontDoorZ], [side * edge, upperY, stairEnd]);
    }
    railing(rail, railCap, [side * stairInner, upperY, frontDoorZ], [side * stairInner, upperY, stairEnd]);
    sign(`stairs-${side}`, [x, 2.74, frontZ - 0.12], 1.5, 0.34, "STAIRS", undefined, Math.PI);
  }

  function washroom([left, rear, right, front]: InteriorBounds, y: number) {
    const sinkX = left + 0.49;
    for (const z of [rear + 1.95, rear + 3.32]) {
      box(porcelain, [sinkX, y + 0.77, z], [0.53, 0.12, 0.59]);
      box(porcelain, [sinkX, y + 0.405, z], [0.13, 0.72, 0.14]);
      box(mirror, [left + 0.095, y + 1.41, z], [0.045, 0.67, 0.61]);
      box(rail, [sinkX - 0.19, y + 0.89, z], [0.025, 0.18, 0.034]);
    }
    const stall = (left + right) / 2 + 0.14;
    for (const z of [front - 1.08, front - 3.16]) {
      box(partition, [(stall + right) / 2, y + 0.99, z - 0.98], [right - stall, 1.98, 0.1], true);
      box(porcelain, [right - 0.55, y + 0.31, z], [0.75, 0.49, 0.47]);
      box(porcelain, [right - 0.24, y + 0.59, z], [0.26, 0.61, 0.5]);
      box(partition, [stall, y + 0.99, z + 0.52], [0.1, 1.98, 0.8], true);
    }
  }

  function roomAt(x: number, z: number, level: 0 | 1) {
    return roomSurfaces.find(({ room }) => room.floor === level && contains(room.bounds, x, z));
  }

  return {
    spawn: [0, 0, 0.86], extent,
    floorAt(x, z, y) {
      const onStair = stairY(x, z);
      if (onStair !== undefined && y >= onStair - 0.25) return onStair;
      if (y >= upperY - 0.24) {
        const upperRoom = roomAt(x, z, 1);
        if (upperRoom) return upperRoom.surface(x, z);
        if (galleries.some((bounds) => contains(bounds, x, z))) return upperY;
      }
      return roomAt(x, z, 0)?.surface(x, z) ?? 0;
    },
    location(x, y, z) {
      const level = y >= upperY - 0.24 ? 1 : 0;
      const current = roomAt(x, z, level)?.room;
      const section = level ? contains(rearTerrace, x, z) ? "Rear Gallery" : "First-floor Gallery"
        : y > 0.2 && stairY(x, z) !== undefined ? "Staircase" : z >= frontDoorZ && Math.abs(x) < flankInner ? "Entrance Court" : "Ground-floor Corridor";
      return { section, floor: level, room: current?.label, roomId: current?.label.toLowerCase() };
    },
    exitNear: (x, y, z) => Math.abs(x) < 1.65 && y < 0.35 && z > 0.05,
  };
}
