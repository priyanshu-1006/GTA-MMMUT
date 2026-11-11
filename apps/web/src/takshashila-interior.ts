import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type FurnishedInterior, type InteriorBounds } from "./interior-furnishing";
import { buildModernLectureClassroom } from "./modern-lecture-classroom";

type Side = "north" | "south" | "west" | "east";
type Floor = 0 | 1;
const extent = [-38, -39, 38, 8] as const;
const upper = 3.72;
const wallHeight = 3.48;
const doorHeight = 2.28;
const court = [-21, -21, 21, -6] as const;
const galleries: readonly InteriorBounds[] = [
  [-25, -25, 25, -21], [-25, -6, 25, -2],
  [-25, -21, -21, -6], [21, -21, 25, -6],
  [-38, -5, -25, -2], [-27, -2, -24, 8], [-30, 6, -27, 8],
  [17, -16, 21, -14],
];
const stairs = [
  { left: -30, right: -27, start: -2, end: 6 },
  { left: 17, right: 21, start: -6, end: -14 },
] as const;

interface Room {
  label: string;
  bounds: InteriorBounds;
  floor: Floor;
  opening: Side;
  teachingWall: Side;
  service?: true;
}

const rooms: readonly Room[] = ([0, 1] as const).flatMap((floor): Room[] => {
  const names = floor === 0
    ? ["L-109", "L-110", "L-111", "L-112", "L-113", "L-114", "L-115"]
    : ["L-201", "L-202", "L-203", "L-204", "L-205", "L-206", "L-207"];
  return [
    { label: names[0], bounds: [-24, -2, -2, 8], floor, opening: "north", teachingWall: "west" },
    { label: names[1], bounds: [-38, -22, -25, -5], floor, opening: "east", teachingWall: "north" },
    { label: names[2], bounds: [-25, -39, -8.3, -25], floor, opening: "south", teachingWall: "west" },
    { label: names[3], bounds: [-8.3, -39, 8.3, -25], floor, opening: "south", teachingWall: "west" },
    { label: names[4], bounds: [8.3, -39, 25, -25], floor, opening: "south", teachingWall: "west" },
    { label: names[5], bounds: [25, -22, 38, -5], floor, opening: "west", teachingWall: "north" },
    { label: names[6], bounds: [2, -2, 24, 8], floor, opening: "north", teachingWall: "west" },
    { label: "Washroom", bounds: [-37.6, -2, -30.6, 3.9], floor, opening: "north", teachingWall: "west", service: true },
  ];
});

function contains([left, rear, right, front]: InteriorBounds, x: number, z: number) {
  return x >= left && x <= right && z >= rear && z <= front;
}

function stairAt(x: number, z: number) {
  for (const { left, right, start, end } of stairs) {
    const fraction = (z - start) / (end - start);
    if (x >= left && x <= right && fraction >= 0 && fraction <= 1) return fraction * upper;
  }
  return undefined;
}

export function buildTakshashilaInterior(scene: Scene): FurnishedInterior {
  scene.clearColor = new Color4(0.64, 0.76, 0.82, 1);
  const { material, patterned, box, floor, railing, sign, openClassroomDoor, finish } = createInteriorFurnishing(scene, "takshashila");
  const plaster = material("cream-plaster", "#e8ded0");
  const trim = material("maroon-skirting", "#78514d");
  const frame = material("blue-steel-frames", "#466970");
  const doorGlass = material("smoked-door-glazing", "#2e4246");
  const rail = material("gallery-ironwork", "#303c40");
  const railTop = material("gallery-handles", "#634740");
  const concrete = material("stairs", "#a9a5a0");
  const ceiling = material("covered-gallery-soffit", "#ddd3c8");
  const lamp = material("gallery-lights", "#fff2db", true);
  const yard = patterned("courtyard-pavers", "#aa9c8b", "#8c8075");
  const tile = patterned("gallery-tile", "#d8cfc0", "#a9a092");
  const washTile = patterned("washroom-tiles", "#aebfb9", "#8d9d96");
  const porcelain = material("porcelain", "#f2eee5");
  const washPartition = material("washroom-partitions", "#7c9190");
  const mirror = material("washroom-mirrors", "#d8e8e9", true);
  const surfaces: { room: Room; height(x: number, z: number): number }[] = [];
  const walls = new Set<string>();

  floor(yard, extent, 0, 0.76);
  floor(tile, [-2, -2, 2, 8], 0.009, 0.66);
  for (const bounds of galleries) {
    floor(tile, bounds, 0.008, 0.66);
    slab(bounds, upper - 0.105, 0.21, true);
    floor(tile, bounds, upper + 0.005, 0.66);
    slab(bounds, upper + wallHeight + 0.095, 0.19);
  }
  const [left, rear, right, front] = court;
  railing(rail, railTop, [left, upper, rear], [right, upper, rear]);
  railing(rail, railTop, [left, upper, front], [right, upper, front]);
  railing(rail, railTop, [left, upper, rear], [left, upper, front]);
  railing(rail, railTop, [right, upper, rear], [right, upper, -16]);
  railing(rail, railTop, [right, upper, -14], [right, upper, front]);
  railing(rail, railTop, [17, upper, -16], [21, upper, -16]);
  railing(rail, railTop, [17, upper, -16], [17, upper, -14]);
  railing(rail, railTop, [-2, upper, -2], [2, upper, -2]);
  railing(rail, railTop, [-30, upper, 8], [-24, upper, 8]);
  railing(rail, railTop, [-27, upper, -2], [-27, upper, 6]);
  for (const stair of stairs) staircase(stair);

  // The central door is between L-109 and L-115. The galleries look down onto the open court.
  wall(false, 8, -2, -1.35, 0);
  wall(false, 8, 1.35, 2, 0);
  box(plaster, [0, (2.68 + wallHeight) / 2, 8], [2.7, wallHeight - 2.68, 0.18], true);
  sign("entry-sign", [0, 2.84, 7.87], 3.98, 0.42, "TAKSHASHILA", "Lecture Hall Complex", Math.PI);
  for (const x of [-21.7, -14, -7, 7, 14, 21.7]) {
    for (const z of [-21.3, -5.75]) {
      box(plaster, [x, upper / 2, z], [0.24, upper, 0.24], true);
      box(plaster, [x, upper + wallHeight / 2, z], [0.24, wallHeight, 0.24], true);
      box(lamp, [x, upper - 0.26, z === -21.3 ? -23.2 : -4.4], [1.08, 0.04, 0.21]);
      box(lamp, [x, upper + wallHeight - 0.035, z === -21.3 ? -23.2 : -4.4], [1.08, 0.035, 0.21]);
    }
  }
  for (const room of rooms) buildRoom(room);
  finish();

  function slab([x0, z0, x1, z1]: InteriorBounds, y: number, height: number, collider = false) {
    box(ceiling, [(x0 + x1) / 2, y, (z0 + z1) / 2], [x1 - x0, height, z1 - z0], collider);
  }

  function wall(alongZ: boolean, position: number, start: number, end: number, y: number) {
    if (end <= start) return;
    const key = `${alongZ}/${position}/${start}/${end}/${y}`;
    if (walls.has(key)) return;
    walls.add(key);
    const mid = (start + end) / 2;
    const x = alongZ ? position : mid;
    const z = alongZ ? mid : position;
    box(plaster, [x, y + wallHeight / 2, z],
      [alongZ ? 0.18 : end - start, wallHeight, alongZ ? end - start : 0.18], true);
    box(trim, [x, y + 0.071, z], [alongZ ? 0.197 : end - start, 0.142, alongZ ? end - start : 0.197]);
  }

  function buildRoom(room: Room) {
    const { label, bounds, floor: level, opening, teachingWall, service } = room;
    const [x0, z0, x1, z1] = bounds;
    const y = level * upper;
    const id = `${label.toLowerCase()}-${level}`;
    const roomEdges: readonly { side: Side; alongZ: boolean; at: number; from: number; to: number }[] = [
      { side: "north", alongZ: false, at: z0, from: x0, to: x1 },
      { side: "south", alongZ: false, at: z1, from: x0, to: x1 },
      { side: "west", alongZ: true, at: x0, from: z0, to: z1 },
      { side: "east", alongZ: true, at: x1, from: z0, to: z1 },
    ];
    for (const edge of roomEdges) {
      if (edge.side !== opening) {
        wall(edge.alongZ, edge.at, edge.from, edge.to, y);
        continue;
      }
      const width = service ? 1.24 : 1.62;
      const midpoint = service ? (edge.from + edge.to) / 2 : edge.from + 1.66;
      wall(edge.alongZ, edge.at, edge.from, midpoint - width / 2, y);
      wall(edge.alongZ, edge.at, midpoint + width / 2, edge.to, y);
      const outward = opening === "north" || opening === "west" ? -1 : 1;
      const x = edge.alongZ ? edge.at : midpoint;
      const z = edge.alongZ ? midpoint : edge.at;
      if (!service) openClassroomDoor(frame, doorGlass, [x, y, z], edge.alongZ, -outward, width, doorHeight);
      box(plaster, [x, y + (doorHeight + wallHeight) / 2, z],
        [edge.alongZ ? 0.18 : width, wallHeight - doorHeight, edge.alongZ ? width : 0.18], true);
      for (const side of [-1, 1]) {
        const offset = side * (width / 2 + 0.028);
        box(frame, [x + (edge.alongZ ? 0 : offset), y + doorHeight / 2, z + (edge.alongZ ? offset : 0)],
          [edge.alongZ ? 0.24 : 0.1, doorHeight, edge.alongZ ? 0.1 : 0.24]);
      }
      box(frame, [x, y + doorHeight, z], [edge.alongZ ? 0.23 : width + 0.16, 0.096, edge.alongZ ? width + 0.16 : 0.23]);
      sign(id, [x + (edge.alongZ ? outward * 0.105 : 0), y + 2.62, z + (edge.alongZ ? 0 : outward * 0.105)],
        1.45, 0.32, label, undefined, edge.alongZ ? outward * Math.PI / 2 : outward > 0 ? 0 : Math.PI);
    }
    if (level === 1) slab(bounds, y - 0.115, 0.23, true);
    if (service) {
      floor(washTile, bounds, y + 0.013, 0.51);
      slab(bounds, y + wallHeight + 0.08, 0.16, true);
      for (const z of [z0 + 1.43, z0 + 2.72]) {
        box(porcelain, [x0 + 0.47, y + 0.75, z], [0.65, 0.14, 0.59], true);
        box(porcelain, [x0 + 0.47, y + 0.4, z], [0.16, 0.67, 0.18]);
        box(mirror, [x0 + 0.12, y + 1.42, z], [0.043, 0.65, 0.57]);
      }
      for (const x of [x1 - 1.05, x1 - 3.05]) {
        box(porcelain, [x, y + 0.31, z1 - 0.55], [0.47, 0.48, 0.67]);
        box(porcelain, [x, y + 0.58, z1 - 0.27], [0.51, 0.61, 0.29]);
        box(washPartition, [x - 0.94, y + 1, z1 - 0.85], [0.098, 2, 1.7], true);
      }
      surfaces.push({ room, height: () => y });
    } else {
      surfaces.push({ room, height: buildModernLectureClassroom(scene, {
        id: `takshashila-${id}`, bounds, floorY: y, front: teachingWall, ceilingHeight: wallHeight,
      }) });
    }
  }

  function staircase({ left: x0, right: x1, start, end }: (typeof stairs)[number]) {
    const count = 22;
    const run = (end - start) / count;
    for (let step = 0; step < count; step++) {
      const top = upper * (step + 1) / count;
      const z = start + (step + 0.5) * run;
      box(concrete, [(x0 + x1) / 2, top / 2, z], [x1 - x0, top, Math.abs(run) + 0.003]);
      box(trim, [(x0 + x1) / 2, top - 0.022, z - run * 0.38], [x1 - x0, 0.044, 0.045]);
    }
    for (const x of [x0, x1]) railing(rail, railTop, [x, 0, start], [x, upper, end]);
    sign(`stairs-${x0}`, [(x0 + x1) / 2, 2.34, start - 0.025], 1.3, 0.3, "STAIRS", undefined, run < 0 ? 0 : Math.PI);
  }

  const findRoom = (x: number, z: number, level: Floor) =>
    surfaces.find(({ room }) => room.floor === level && contains(room.bounds, x, z));
  return {
    spawn: [0, 0, 6.95], extent,
    floorAt(x, z, y) {
      const stair = stairAt(x, z);
      if (stair !== undefined && y >= stair - 0.25) return stair;
      if (y >= upper - 0.25) {
        const room = findRoom(x, z, 1);
        if (room) return room.height(x, z);
        if (galleries.some((bounds) => contains(bounds, x, z))) return upper;
      }
      return findRoom(x, z, 0)?.height(x, z) ?? 0;
    },
    location(x, y, z) {
      const level = y >= upper - 0.25 ? 1 : 0;
      const room = findRoom(x, z, level)?.room;
      const section = level ? "First-floor gallery" : contains(court, x, z) ? "Open courtyard" : "Ground-floor gallery";
      return { section, floor: level, room: room?.label, roomId: room?.label.toLowerCase() };
    },
    exitNear: (x, y, z) => Math.abs(x) < 1.68 && z > 6.3 && y < 0.35,
  };
}
