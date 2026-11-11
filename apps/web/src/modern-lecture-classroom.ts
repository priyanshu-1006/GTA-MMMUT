import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type InteriorBounds } from "./interior-furnishing";

interface LectureRoomOptions {
  readonly id: string;
  readonly bounds: InteriorBounds;
  readonly floorY: number;
  readonly front: "north" | "south" | "east" | "west";
  readonly ceilingHeight?: number;
}

const firstTier = 3;
const tierPitch = 1.36;
const tierRise = 0.174;
const stageHeight = 0.17;

function createFinishes(scene: Scene) {
  const { material, patterned } = createInteriorFurnishing(scene, "modern-lecture");
  const display = material("slide", "#294451", true);
  if (typeof document !== "undefined") {
    const texture = new DynamicTexture("modern-lecture-slide", { width: 640, height: 360 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = "#18313e";
    context.fillRect(0, 0, 640, 360);
    context.fillStyle = "#598a96";
    context.fillRect(48, 65, 96, 5);
    context.fillStyle = "#d5e5df";
    context.font = "700 43px Segoe UI, sans-serif";
    context.fillText("MMMUT", 46, 135);
    context.font = "27px Segoe UI, sans-serif";
    context.fillText("Lecture session", 49, 185);
    context.fillStyle = "#7bb0b4";
    context.fillRect(50, 229, 310, 2);
    context.fillRect(50, 247, 236, 2);
    texture.update();
    texture.uScale = -1;
    texture.uOffset = 1;
    display.albedoTexture = texture;
  }
  return {
    tile: patterned("cream-ceramic", "#d8d3c7", "#bbb5a7"),
    treads: material("dark-bullnose", "#777771"),
    ceiling: material("acoustic-ceiling", "#e2ddce"),
    grid: material("ceiling-grid", "#b2aea1"),
    light: material("recessed-light", "#eef9ff", true),
    maple: patterned("maple-desks", "#d1ad73", "#c49b66", true),
    honey: patterned("honey-front-panel", "#be8859", "#a77851", true),
    oak: patterned("oak-side-paneling", "#baa27d", "#ad9672", true, [1, 1.3]),
    walnut: patterned("walnut-front-paneling", "#624433", "#523b31", true, [1.8, 1]),
    steel: material("steel-frames", "#272a2a"),
    white: material("air-conditioners-and-fans", "#f0ece0"),
    daylight: material("window-daylight", "#dce6e3", true),
    blinds: [material("blind-light", "#a6a39c"), material("blind-shadow", "#8e8b84")],
    accent: material("lectern-blue", "#345b72"),
    display,
    paper: material("notebook", "#e0d6c4"),
  };
}

const sceneFinishes = new WeakMap<Scene, ReturnType<typeof createFinishes>>();

/** Furnishes a room whose caller provides the walls and an open side doorway near the teaching area. */
export function buildModernLectureClassroom(scene: Scene, { id, bounds, floorY, front, ceilingHeight = 3.45 }: LectureRoomOptions) {
  let materials = sceneFinishes.get(scene);
  if (!materials) {
    materials = createFinishes(scene);
    sceneFinishes.set(scene, materials);
  }
  const { tile, treads, ceiling, grid, light, maple, honey, oak, walnut, steel, white, daylight, blinds, accent, display, paper } = materials;
  const [left, north, right, south] = bounds;
  const alongX = front === "east" || front === "west";
  const width = alongX ? south - north : right - left;
  const depth = alongX ? right - left : south - north;
  const half = width / 2;
  const rowCount = Math.max(1, Math.min(7, Math.floor((depth - firstTier - 1.05) / tierPitch)));
  const stageHalf = half - 1.12;
  const centerX = (left + right) / 2;
  const centerZ = (north + south) / 2;
  const batches = new Map<string, { finish: PBRMaterial; solid: boolean; meshes: Mesh[] }>();

  function locate(u: number, height: number, distance: number): [number, number, number] {
    if (front === "north") return [centerX + u, floorY + height, north + distance];
    if (front === "south") return [centerX - u, floorY + height, south - distance];
    if (front === "west") return [left + distance, floorY + height, centerZ - u];
    return [right - distance, floorY + height, centerZ + u];
  }

  function collect(mesh: Mesh, finish: PBRMaterial, solid = false) {
    const key = `${finish.name}/${solid}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { finish, solid, meshes: [] };
      batches.set(key, batch);
    }
    batch.meshes.push(mesh);
  }

  function box(finish: PBRMaterial, u: number, height: number, distance: number,
    span: number, tall: number, deep: number, solid = false, yaw = 0,
  ) {
    const mesh = CreateBox(finish.name, { width: alongX ? deep : span, height: tall, depth: alongX ? span : deep }, scene);
    mesh.position.set(...locate(u, height, distance));
    mesh.rotation.y = yaw;
    collect(mesh, finish, solid);
  }

  function ceramic(u: number, height: number, distance: number, span: number, deep: number) {
    const mesh = CreateGround(tile.name, { width: alongX ? deep : span, height: alongX ? span : deep }, scene);
    mesh.position.set(...locate(u, height, distance));
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    for (let index = 0; index < uv.length; index += 2) {
      uv[index] *= (alongX ? deep : span) / 0.64;
      uv[index + 1] *= (alongX ? span : deep) / 0.64;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
    collect(mesh, tile);
  }

  function fan(u: number, distance: number) {
    const y = ceilingHeight - 0.2;
    const hub = CreateCylinder(white.name, { diameter: 0.25, height: 0.18, tessellation: 10 }, scene);
    hub.position.set(...locate(u, y, distance));
    collect(hub, white);
    for (let blade = 0; blade < 3; blade++) {
      const angle = 0.19 + blade * Math.PI * 2 / 3;
      const [x, by, z] = locate(u, y - 0.024, distance);
      const mesh = CreateBox(white.name, { width: 0.79, height: 0.028, depth: 0.135 }, scene);
      mesh.position.set(x + Math.cos(angle) * 0.47, by, z - Math.sin(angle) * 0.47);
      mesh.rotation.y = angle;
      collect(mesh, white);
    }
  }

  ceramic(0, 0.002, depth / 2, width - 0.12, depth - 0.12);
  box(tile, 0, stageHeight / 2, 1.02, stageHalf * 2, stageHeight, 1.44);
  ceramic(0, stageHeight + 0.002, 1.02, stageHalf * 2, 1.44);
  box(treads, 0, stageHeight - 0.014, 1.732, stageHalf * 2, 0.023, 0.035);

  box(walnut, 0, ceilingHeight / 2, 0.101, width - 0.18, ceilingHeight, 0.06);
  box(steel, 0, 2.08, 0.16, Math.min(3.12, width * 0.44), 1.79, 0.074);
  const screen = CreatePlane("lecture-display", {
    width: Math.min(3.04, width * 0.43), height: 1.71, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  screen.position.set(...locate(0, 2.08, 0.205));
  screen.rotation.y = { north: Math.PI, south: 0, west: -Math.PI / 2, east: Math.PI / 2 }[front];
  collect(screen, display);

  const teachingWidth = Math.min(width * 0.38, 3.27);
  box(honey, 0.23, stageHeight + 0.415, 0.98, teachingWidth, 0.83, 0.62, true);
  box(maple, 0.23, stageHeight + 0.86, 0.98, teachingWidth + 0.12, 0.071, 0.73);
  box(steel, 0.51, stageHeight + 0.914, 0.94, 0.24, 0.02, 0.19);
  const lectern = -Math.min(half - 1.67, 3.08);
  box(white, lectern, stageHeight + 0.54, 0.98, 0.54, 1.08, 0.46, true);
  box(accent, lectern - 0.25, stageHeight + 0.57, 0.98, 0.105, 0.94, 0.47);
  box(accent, lectern, stageHeight + 1.113, 0.98, 0.66, 0.087, 0.55);
  box(steel, lectern + 0.18, stageHeight + 1.27, 0.89, 0.019, 0.23, 0.019);

  const aisleHalf = 0.78;
  const bankWidth = half - aisleHalf - 1.02;
  for (let row = 0; row < rowCount; row++) {
    const start = firstTier + row * tierPitch;
    const end = row === rowCount - 1 ? depth - 0.08 : start + tierPitch;
    const y = (row + 1) * tierRise;
    box(tile, 0, y / 2, (start + end) / 2, width - 0.16, y, end - start);
    ceramic(0, y + 0.002, (start + end) / 2, width - 0.16, end - start);
    box(treads, 0, y - 0.013, start + 0.021, width - 0.22, 0.023, 0.044);

    for (const side of [-1, 1]) {
      const bank = side * (aisleHalf + bankWidth / 2);
      const tableDepth = start + 0.34;
      const seatDepth = start + 0.945;
      box(maple, bank, y + 0.785, tableDepth, bankWidth, 0.093, 0.52, true);
      const fasciaHeight = row === 0 ? 0.48 : 0.18;
      box(row === 0 ? honey : maple, bank, y + 0.746 - fasciaHeight / 2, tableDepth - 0.219,
        bankWidth - 0.036, fasciaHeight, 0.073, true);
      box(steel, bank, y + 0.582, tableDepth + 0.105, bankWidth - 0.07, 0.1, 0.075);
      box(maple, bank, y + 0.455, seatDepth, bankWidth - 0.08, 0.065, 0.33, true);
      for (const support of [bank - bankWidth / 2 + 0.21, bank + bankWidth / 2 - 0.21]) {
        box(steel, support, y + 0.36, tableDepth, 0.054, 0.72, 0.053);
        box(steel, support, y + 0.202, seatDepth, 0.052, 0.404, 0.052);
        box(steel, support, y + 0.144, (tableDepth + seatDepth) / 2, 0.05, 0.049, seatDepth - tableDepth + 0.075);
      }
      if ((row + side + 1) % 3 === 0) box(paper, bank + bankWidth * 0.17, y + 0.839, tableDepth, 0.23, 0.015, 0.17);
    }
  }

  for (const side of [-1, 1]) {
    const wall = side * (half - 0.105);
    box(oak, wall, ceilingHeight / 2, (depth + 2.6) / 2, 0.057, ceilingHeight, depth - 2.6);
    for (let distance = 3.85; distance < depth - 1.12; distance += 3.23) {
      const windowY = 1.93;
      box(walnut, wall - side * 0.015, ceilingHeight / 2, distance - 1.18, 0.081, ceilingHeight, 0.32);
      box(daylight, wall - side * 0.054, windowY, distance, 0.061, 1.71, 1.72);
      for (let strip = 0; strip < 15; strip++) {
        box(blinds[strip % 2], wall - side * (0.103 + strip % 2 * 0.018),
          windowY, distance + (strip - 7) * 0.105, 0.048, 1.59, 0.101);
      }
      box(white, wall - side * 0.115, ceilingHeight - 0.41, distance + 0.72, 0.28, 0.29, 0.97);
      box(steel, wall - side * 0.204, ceilingHeight - 0.523, distance + 0.72, 0.13, 0.039, 0.87);
      box(steel, wall - side * 0.1, ceilingHeight - 0.4, distance - 1.09, 0.24, 0.36, 0.26);
    }
  }

  box(ceiling, 0, ceilingHeight + 0.045, depth / 2, width, 0.09, depth);
  for (let u = -half + 0.7; u < half - 0.1; u += 0.7) box(grid, u, ceilingHeight - 0.002, depth / 2, 0.019, 0.014, depth - 0.14);
  for (let d = 0.7; d < depth - 0.1; d += 0.7) box(grid, 0, ceilingHeight - 0.002, d, width - 0.14, 0.014, 0.019);
  for (let d = 1.75; d < depth - 0.7; d += 2.8) {
    for (const u of [-half * 0.57, half * 0.57]) {
      box(grid, u, ceilingHeight - 0.025, d, 0.68, 0.05, 0.68);
      box(light, u, ceilingHeight - 0.052, d, 0.62, 0.014, 0.62);
    }
  }
  for (let d = 3.05; d < depth - 0.75; d += 3.66) {
    fan(-half * 0.43, d);
    fan(half * 0.43, d);
  }

  for (const { finish, solid, meshes } of batches.values()) {
    const mesh = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = `${id}/${finish.name}${solid ? "-solid" : ""}`;
    mesh.material = finish;
    mesh.checkCollisions = solid;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
  }

  return (x: number, z: number) => {
    const distance = { north: z - north, south: south - z, west: x - left, east: right - x }[front];
    const lateral = alongX ? Math.abs(z - centerZ) : Math.abs(x - centerX);
    if (distance >= 0.3 && distance <= 1.74 && lateral < stageHalf) return floorY + stageHeight;
    if (distance < firstTier) return floorY;
    return floorY + tierRise * Math.min(rowCount, 1 + Math.floor((distance - firstTier) / tierPitch));
  };
}
