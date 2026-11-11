import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { cseInteriorLayout, type CseBounds, type CseFloor, type CseRoom } from "./cse-interior-layout";
import { defaultPlayerAppearance } from "./player-appearance";
import { createPlayerAvatar } from "./player-avatar";

const wallHeight = 3.33;
const wallThickness = 0.16;
const doorHeight = 2.23;
const corridor = cseInteriorLayout.corridorHalfWidth;
const roomLights = 2.99;

interface MeshBatch {
  material: PBRMaterial;
  colliding: boolean;
  meshes: Mesh[];
}

interface Sign {
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
}

export function createCseInteriorGeometry(scene: Scene) {
  const batches = new Map<string, MeshBatch>();
  const signs: Sign[] = [];
  const roomPartitions = new Set<string>();
  let section = "corridor";

  function finish(name: string, color: string, unlit = false) {
    const material = new PBRMaterial(`cse-${name}`, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.metallic = 0;
    material.roughness = 0.85;
    material.unlit = unlit;
    return material;
  }

  const plaster = finish("painted-plaster", "#ece6da");
  const oldPlaster = finish("old-building-plaster", "#e9dcc4");
  const teal = finish("door-trim", "#295656");
  const skirting = finish("tile-skirting", "#967669");
  const ceiling = finish("ceiling", "#f5f2eb");
  const fixture = finish("light-diffuser", "#fff6e1", true);
  const wood = finish("wood-laminate", "#956749");
  const steel = finish("steel-frames", "#37434a");
  const fabric = finish("chair-fabric", "#385f74");
  const seminarFabric = finish("seminar-seating", "#863b40");
  const glass = finish("frosted-glazing", "#9cc0cf", true);
  const monitorCase = finish("equipment-cases", "#26333b");
  const display = finish("active-screens", "#418695", true);
  const indicator = finish("status-led", "#bde7a9", true);
  const porcelain = finish("porcelain", "#f3f4f0");
  const tileWall = finish("washroom-tile", "#a9c4c2");
  const mirror = finish("washroom-mirror", "#c2d5dd", true);
  const paper = finish("paper", "#e9e9dd");
  const warmStage = finish("stage", "#a16f57");
  const plant = finish("plant", "#4f793e");
  const floorTile = tiledFinish("terrazzo", "#e6dcc9", "#cbc0af");
  const oldTile = tiledFinish("old-floor", "#d3c8ad", "#b5a894");

  function tiledFinish(name: string, fill: string, grout: string) {
    const material = finish(name, "#ffffff");
    const texture = new DynamicTexture(`cse-${name}-texture`, 128, scene, true);
    const context = texture.getContext();
    context.fillStyle = fill;
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = grout;
    context.fillRect(0, 0, 2, 128);
    context.fillRect(0, 0, 128, 2);
    for (let index = 0; index < 95; index++) {
      const x = (index * 73 + 21) % 126 + 2;
      const y = (index * 41 + 9) % 126 + 2;
      context.globalAlpha = 0.22;
      context.fillRect(x, y, index % 3 + 1, 1);
    }
    context.globalAlpha = 1;
    texture.update();
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.albedoTexture = texture;
    return material;
  }

  function collect(mesh: Mesh, material: PBRMaterial, colliding: boolean) {
    mesh.material = material;
    mesh.isPickable = false;
    const key = colliding ? `${section}/${material.name}` : material.name;
    const batch = batches.get(key) ?? { material, colliding, meshes: [] };
    batch.meshes.push(mesh);
    batches.set(key, batch);
  }

  function block(
    material: PBRMaterial, x: number, y: number, z: number,
    width: number, height: number, depth: number, colliding = false,
  ) {
    const mesh = CreateBox(material.name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    collect(mesh, material, colliding);
  }

  function tube(
    material: PBRMaterial, x: number, y: number, z: number, diameter: number, height: number,
  ) {
    const mesh = CreateCylinder(material.name, { diameter, height, tessellation: 10 }, scene);
    mesh.position.set(x, y, z);
    collect(mesh, material, false);
  }

  function slab(bounds: CseBounds, y: number, material: PBRMaterial) {
    const [left, rear, right, front] = bounds;
    const width = right - left;
    const depth = front - rear;
    const mesh = CreateGround("cse-floor-surface", { width, height: depth }, scene);
    mesh.position.set((left + right) / 2, y, (rear + front) / 2);
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    for (let index = 0; index < uv.length; index += 2) {
      uv[index] = (left + uv[index] * width) / 0.65;
      uv[index + 1] = (rear + uv[index + 1] * depth) / 0.65;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
    collect(mesh, material, false);
    block(ceiling, mesh.position.x, y + wallHeight + 0.08, mesh.position.z, width, 0.16, depth);
  }

  function wallX(
    material: PBRMaterial, x: number, y: number, rear: number, front: number,
    height = wallHeight,
  ) {
    const length = front - rear;
    if (length < 0.015) return;
    block(material, x, y + height / 2, (rear + front) / 2, wallThickness, height, length, true);
    if (height === wallHeight) {
      block(skirting, x, y + 0.072, (rear + front) / 2, wallThickness + 0.024, 0.144, length);
    }
  }

  function partitionZ(material: PBRMaterial, left: number, right: number, y: number, z: number) {
    const key = `${left},${right},${y},${z.toFixed(3)}`;
    if (roomPartitions.has(key)) return;
    roomPartitions.add(key);
    block(material, (left + right) / 2, y + wallHeight / 2, z, right - left, wallHeight, wallThickness, true);
    block(skirting, (left + right) / 2, y + 0.072, z, right - left, 0.144, wallThickness + 0.024);
  }

  function doorWall(
    material: PBRMaterial, x: number, y: number, rear: number, front: number,
    center: number, width: number, side: number, label: string, subtitle?: string,
  ) {
    const edge = width / 2;
    wallX(material, x, y, rear, center - edge);
    wallX(material, x, y, center + edge, front);
    wallX(material, x, y + doorHeight, center - edge, center + edge, wallHeight - doorHeight);
    for (const offset of [-edge - 0.024, edge + 0.024]) {
      block(teal, x, y + doorHeight / 2, center + offset, 0.21, doorHeight, 0.055);
    }
    block(teal, x, y + doorHeight + 0.026, center, 0.21, 0.063, width + 0.11);
    signs.push({ label, subtitle, x: x - side * 0.091, y: y + 2.5, z: center, yaw: side * Math.PI / 2, width: 2.42 });
  }

  function ceilingLight(x: number, y: number, z: number, width = 1.35) {
    for (const offset of [-width / 3, width / 3]) {
      block(steel, x + offset, y + 3.18, z, 0.042, 0.31, 0.042);
    }
    block(steel, x, y + roomLights + 0.031, z, width + 0.05, 0.062, 0.36);
    block(fixture, x, y + roomLights, z, width, 0.041, 0.3);
  }

  function window(x: number, y: number, z: number, width: number, side: number) {
    block(teal, x, y + 1.97, z, 0.09, 1.24, width);
    block(glass, x - side * 0.058, y + 1.97, z, 0.04, 1.09, width - 0.12);
    block(teal, x - side * 0.087, y + 1.97, z, 0.03, 1.12, 0.042);
    block(teal, x - side * 0.087, y + 1.97, z, 0.03, 0.036, width - 0.12);
    block(porcelain, x - side * 0.06, y + 1.35, z, 0.25, 0.085, width + 0.1);
  }

  function chair(x: number, y: number, z: number, direction: 0 | 1 | 2 | 3, material = fabric) {
    block(material, x, y + 0.45, z, 0.45, 0.085, 0.44, true);
    const backX = direction === 1 ? -0.195 : direction === 3 ? 0.195 : 0;
    const backZ = direction === 0 ? 0.195 : direction === 2 ? -0.195 : 0;
    block(material, x + backX, y + 0.72, z + backZ, backX ? 0.08 : 0.45, 0.42, backZ ? 0.08 : 0.43);
    for (const dx of [-0.166, 0.166]) {
      for (const dz of [-0.166, 0.166]) block(steel, x + dx, y + 0.21, z + dz, 0.035, 0.42, 0.035);
    }
  }

  function table(x: number, y: number, z: number, width: number, depth: number, height = 0.75) {
    block(wood, x, y + height, z, width, 0.075, depth, true);
    for (const dx of [-width / 2 + 0.085, width / 2 - 0.085]) {
      for (const dz of [-depth / 2 + 0.085, depth / 2 - 0.085]) {
        block(steel, x + dx, y + (height - 0.05) / 2, z + dz, 0.06, height - 0.05, 0.06);
      }
    }
  }

  function monitor(x: number, y: number, z: number, direction: 1 | -1, wide = false) {
    const width = wide ? 0.65 : 0.49;
    block(monitorCase, x, y + 0.285, z, 0.08, 0.29, width);
    block(display, x + direction * 0.047, y + 0.289, z, 0.015, 0.24, width - 0.045);
    block(steel, x, y + 0.098, z, 0.045, 0.16, 0.08);
    block(monitorCase, x, y + 0.014, z, 0.26, 0.027, 0.24);
    block(monitorCase, x + direction * 0.26, y + 0.016, z, 0.128, 0.03, 0.31);
  }

  function bulletinBoard(x: number, y: number, z: number, width: number, side: number) {
    block(wood, x, y + 1.67, z, 0.09, 1.08, width);
    block(teal, x - side * 0.05, y + 1.67, z, 0.024, 0.98, width - 0.14);
    for (const [offset, rise] of [[-0.4, 0.19], [0.06, 0.14], [0.48, -0.16]]) {
      block(paper, x - side * 0.069, y + 1.67 + rise, z + offset, 0.008, 0.28, 0.21);
    }
  }

  function plantPot(x: number, y: number, z: number) {
    tube(wood, x, y + 0.14, z, 0.35, 0.28);
    for (const [dx, dz, height] of [[0, 0, 0.5], [0.092, 0.03, 0.33], [-0.09, -0.04, 0.32]]) {
      tube(plant, x + dx, y + 0.24 + height / 2, z + dz, 0.12, height);
    }
  }

  function office(room: CseRoom, y: number) {
    const [left, rear, right, front] = room.bounds;
    const side = Math.sign(room.door[0]) as 1 | -1;
    const outer = side === 1 ? right : left;
    const centerZ = (rear + front) / 2;
    const deskX = outer - side * (room.suite ? 1.48 : 2.32);
    const width = room.kind === "faculty" ? 0.78 : 0.94;
    const depth = room.suite ? 1.65 : room.kind === "hod" ? 2.3 : 2.1;
    table(deskX, y, centerZ, width, depth);
    const seatX = deskX + side * 0.87;
    chair(seatX, y, centerZ, side === 1 ? 3 : 1);
    chair(deskX - side * 0.96, y, centerZ - (room.suite ? 0 : 0.43), side === 1 ? 1 : 3);
    if (!room.suite) {
      chair(deskX - side * 0.96, y, centerZ + 0.43, side === 1 ? 1 : 3);
      plantPot(outer - side * 0.52, y, front - 0.53);
    }
    monitor(deskX + side * 0.14, y + 0.788, centerZ + 0.42, side);
    block(paper, deskX - side * 0.13, y + 0.794, centerZ - 0.42, 0.36, 0.024, 0.42);
    const cabinetZ = rear + 0.5;
    block(wood, outer - side * 0.38, y + 0.94, cabinetZ, 0.52, 1.8, 0.8, true);
    for (const height of [0.46, 0.87, 1.28]) {
      block(steel, outer - side * 0.66, y + height, cabinetZ, 0.041, 0.03, 0.65);
    }

    if (room.kind === "office") {
      const seat = new TransformNode("cse-common-office-clerk", scene);
      seat.position.set(seatX - side * 0.27, y, centerZ);
      seat.rotation.y = -side * Math.PI / 2;
      const clerk = createPlayerAvatar(scene, seat, document.createElement("canvas"));
      clerk.setAppearance({ ...defaultPlayerAppearance, skin: "skin-indian", shirt: "cream-polo", pants: "charcoal-jeans",
        hair: "ash-hair", shoes: "black-runners" });
      void clerk.prepare().then(() => clerk.animate("sit", 0.7));
      bulletinBoard(room.door[0] + side * 0.13, y, rear + 1.45, 1.65, -side);
    }
  }

  function serverRack(x: number, y: number, z: number) {
    block(monitorCase, x, y + 0.92, z, 0.6, 1.84, 0.63, true);
    for (let index = 0; index < 6; index++) {
      const level = y + 0.34 + 0.23 * index;
      block(steel, x - 0.304, level, z, 0.014, 0.16, 0.49);
      block(indicator, x - 0.316, level, z + 0.14, 0.017, 0.024, 0.09);
    }
  }

  function lab(room: CseRoom, y: number) {
    const [left, rear, right, front] = room.bounds;
    const centerZ = (rear + front) / 2;
    const depth = front - rear;
    const simulation = room.id === "ar-vr-lab";
    const equipment = room.id === "cn-lab" || room.id === "cybersecurity-lab" || room.id === "med-lab";
    const columns = depth >= 10 && !simulation ? 3 : 2;
    const boardX = right - 0.1;
    block(steel, boardX, y + 1.89, centerZ, 0.1, 1.39, 3.48);
    block(paper, boardX - 0.06, y + 1.89, centerZ, 0.026, 1.29, 3.36);
    block(steel, boardX - 0.16, y + 1.19, centerZ, 0.26, 0.048, 3.4);
    for (let row = 0; row < 2; row++) {
      const deskX = left + 2.6 + row * 2.05;
      for (const side of [-1, 1]) {
        for (let column = 0; column < columns; column++) {
          if (simulation && row === 0 && column === 0) continue;
          const deskZ = centerZ + side * (1.05 + column * 1.11);
          table(deskX, y, deskZ, 0.82, 1.06);
          chair(deskX - 0.74, y, deskZ, 1);
          monitor(deskX + 0.16, y + 0.788, deskZ, -1, room.id === "computer-vision-lab");
        }
      }
    }
    if (equipment) {
      serverRack(right - 0.49, y, rear + 0.65);
      serverRack(right - 0.49, y, rear + 1.4);
    }
    if (room.id === "iot-lab" || room.id === "computer-vision-lab" || simulation) {
      table(right - 1.03, y, front - 1.08, 0.84, 1.5, 0.83);
      if (room.id === "iot-lab") {
        for (const offset of [-0.4, 0, 0.4]) {
          block(teal, right - 1.03, y + 0.913, front - 1.08 + offset, 0.26, 0.11, 0.23);
          block(indicator, right - 1.03, y + 0.975, front - 1.08 + offset, 0.065, 0.015, 0.11);
        }
      } else if (simulation) {
        const x = right - 1.03;
        const z = front - 1.08;
        block(monitorCase, x - 0.11, y + 0.967, z, 0.17, 0.146, 0.36);
        block(glass, x - 0.205, y + 0.978, z, 0.032, 0.101, 0.31);
        for (const offset of [-0.156, 0.156]) {
          block(steel, x + 0.04, y + 0.974, z + offset, 0.25, 0.055, 0.043);
        }
        block(steel, x + 0.166, y + 0.974, z, 0.044, 0.055, 0.35);
      } else {
        tube(steel, right - 1.03, y + 0.977, front - 1.08, 0.16, 0.215);
        block(monitorCase, right - 1.03, y + 1.1, front - 1.08, 0.36, 0.14, 0.23);
        block(glass, right - 1.22, y + 1.1, front - 1.08, 0.05, 0.1, 0.16);
      }
    }
    bulletinBoard(left + 0.13, y, front - 1.35, 1.75, 1);
  }

  function conference(room: CseRoom, y: number) {
    const [left, rear, right, front] = room.bounds;
    const centerX = (left + right) / 2 + 0.38;
    const centerZ = (rear + front) / 2;
    table(centerX, y, centerZ, 3.7, 1.52);
    for (const offset of [-1.42, -0.47, 0.47, 1.42]) {
      chair(centerX + offset, y, centerZ + 1.18, 0);
      chair(centerX + offset, y, centerZ - 1.18, 2);
      block(paper, centerX + offset, y + 0.79, centerZ + 0.47, 0.24, 0.015, 0.31);
    }
    chair(centerX + 2.2, y, centerZ, 3);
    block(steel, right - 0.13, y + 1.85, centerZ, 0.12, 1.55, 3.04);
    block(paper, right - 0.2, y + 1.85, centerZ, 0.032, 1.43, 2.92);
    block(monitorCase, centerX + 0.55, y + 2.84, centerZ, 0.36, 0.14, 0.29);
    plantPot(right - 0.55, y, rear + 0.55);
  }

  function seminar(room: CseRoom, y: number) {
    const [left, rear, right] = room.bounds;
    const centerX = (left + right) / 2 - 0.28;
    const stageZ = rear + 2.2;
    block(warmStage, centerX, y + 0.16, stageZ, 6.66, 0.32, 3.16, true);
    block(steel, centerX, y + 1.97, rear + 0.12, 5.15, 2.03, 0.1);
    block(paper, centerX, y + 1.97, rear + 0.18, 4.98, 1.87, 0.032);
    block(wood, centerX - 2.4, y + 0.91, stageZ + 0.48, 0.65, 1.17, 0.5, true);
    block(monitorCase, centerX - 2.4, y + 1.53, stageZ + 0.47, 0.74, 0.085, 0.6);
    block(steel, centerX - 2.4, y + 1.68, stageZ + 0.38, 0.045, 0.23, 0.04);
    block(monitorCase, centerX, y + 2.86, rear + 7.45, 0.33, 0.13, 0.34);
    for (const z of [-3.1, -4.45, -5.8, -7.15, -8.5, -12.8, -14.15, -15.5]) {
      for (const dx of [-2.42, -1.84, -1.26, 1.26, 1.84, 2.42]) {
        chair(centerX + dx, y, z, 0, seminarFabric);
      }
    }
    signs.push({ label: "Alan Turing Hall", x: centerX, y: y + 3.02, z: rear + 0.242, yaw: Math.PI, width: 3.5 });
  }

  function washroom(room: CseRoom, y: number) {
    const [left, rear, right, front] = room.bounds;
    const side = Math.sign(room.door[0]);
    const outer = side === 1 ? right : left;
    const count = front - rear > 6 ? 3 : 2;
    block(tileWall, outer - side * 0.08, y + 0.88, (rear + front) / 2, 0.04, 1.76, front - rear - 0.18);
    block(tileWall, room.door[0] + side * 1.32, y + 1.04, room.door[1], 0.12, 2.08, 1.62, true);
    const stallX = outer - side * 1.12;
    for (let index = 0; index < count; index++) {
      const z = rear + 1.04 + index * 1.48;
      if (index > 0) block(teal, stallX, y + 1.08, z - 0.74, 2.03, 1.92, 0.064, true);
      block(porcelain, outer - side * 0.37, y + 0.6, z, 0.36, 0.53, 0.47);
      tube(porcelain, outer - side * 0.76, y + 0.24, z, 0.44, 0.48);
      tube(teal, outer - side * 0.79, y + 0.478, z, 0.36, 0.033);
      block(teal, outer - side * 2.14, y + 1.08, z - 0.56, 0.07, 1.9, 0.24);
    }
    const basinX = room.door[0] + side * 1.27;
    for (const offset of [1.02, 2.2]) {
      const x = basinX + side * offset;
      block(porcelain, x, y + 0.88, front - 0.34, 0.82, 0.18, 0.51, true);
      block(tileWall, x, y + 0.98, front - 0.34, 0.5, 0.03, 0.28);
      block(steel, x, y + 1.1, front - 0.16, 0.05, 0.23, 0.075);
      block(mirror, x, y + 1.57, front - 0.094, 0.75, 0.83, 0.035);
    }
  }

  function waterCooler(room: CseRoom, y: number) {
    const x = room.door[0] - 2.48;
    const z = room.door[1] - 1.53;
    block(steel, x, y + 0.63, z, 0.79, 1.26, 1.55, true);
    block(porcelain, x, y + 1.3, z, 0.82, 0.12, 1.58);
    block(teal, x + 0.385, y + 1.04, z, 0.065, 0.19, 1.48);
    for (const offset of [-0.45, 0.45]) {
      block(porcelain, x + 0.52, y + 0.79, z + offset, 0.38, 0.085, 0.41);
      block(steel, x + 0.5, y + 1.13, z + offset, 0.26, 0.055, 0.075);
    }
    signs.push({ label: "Drinking water", x: x + 0.43, y: y + 1.64, z, yaw: -Math.PI / 2, width: 1.76 });
  }

  function shellRoom(room: CseRoom) {
    section = room.id;
    const y = cseInteriorLayout.floorHeights[room.floor];
    const [left, rear, right, front] = room.bounds;
    const side = Math.sign(room.door[0]);
    const paint = room.wing === "new" ? plaster : oldPlaster;
    const tile = room.wing === "new" ? floorTile : oldTile;
    const width = room.kind === "staff" ? 1.85 : room.kind === "water" ? 2.02 : room.kind === "lab" || room.kind === "seminar" ? 1.52 : 1.17;
    if (!room.suite) slab(room.bounds, y, tile);
    if (!room.suite || rear !== -16) partitionZ(paint, left, right, y, rear);
    if (!room.suite || front !== 0) partitionZ(paint, left, right, y, front);
    doorWall(paint, room.door[0], y, rear, front, room.door[1], width, side, room.label, room.subtitle);
    if (room.kind !== "staff") {
      const outer = side === 1 ? right : left;
      if (room.kind !== "washroom") {
        const boardRoom = room.kind === "lab" || room.kind === "conference";
        const windowZ = boardRoom ? front - 1.36 : (rear + front) / 2;
        window(outer - side * 0.094, y, windowZ, Math.min(boardRoom ? 1.76 : 2.55, front - rear - 0.7), side);
      }
      ceilingLight((left + right) / 2, y, (rear + front) / 2);
      if (front - rear > 6.5) {
        ceilingLight((left + right) / 2, y, rear + 1.85);
        ceilingLight((left + right) / 2, y, front - 1.85);
      }
    } else {
      for (const z of [-2.8, -7.9, -13.2]) ceilingLight(3, y, z, 1);
    }
    switch (room.kind) {
      case "hod":
      case "office":
      case "faculty":
        office(room, y);
        break;
      case "lab":
        lab(room, y);
        break;
      case "conference":
        conference(room, y);
        break;
      case "seminar":
        seminar(room, y);
        break;
      case "washroom":
        washroom(room, y);
        break;
      case "water":
        waterCooler(room, y);
        break;
    }
  }

  function hallway(floor: CseFloor) {
    section = `hallway-${floor}`;
    const y = cseInteriorLayout.floorHeights[floor];
    const { new: newWing, old: oldWing } = cseInteriorLayout.wings;
    slab([-corridor, newWing.rear, corridor, floor ? 0 : newWing.front], y, floorTile);
    slab([-corridor, oldWing.front, corridor, newWing.rear], y, floorTile);
    slab([-corridor, oldWing.rear, corridor, oldWing.front], y, oldTile);
    for (const side of [-1, 1]) {
      wallX(plaster, side * newWing.halfWidth, y, newWing.rear, 0);
      wallX(oldPlaster, side * oldWing.halfWidth, y, oldWing.rear, oldWing.front);
      wallX(plaster, side * corridor, y, oldWing.front, newWing.rear);
      if (!floor) wallX(plaster, side * corridor, y, 0, newWing.front);
    }
    partitionZ(oldPlaster, -corridor, corridor, y, oldWing.rear);
    if (floor) {
      partitionZ(plaster, -corridor, corridor, y, 0);
      block(teal, 0, y + 1.92, -0.098, 2.6, 1.24, 0.08);
      block(glass, 0, y + 1.92, -0.15, 2.44, 1.08, 0.04);
    } else {
      block(teal, 0, y + 2.54, 1.96, 3.35, 0.53, 0.2);
      signs.push({ label: "Campus exit", x: 0, y: y + 2.56, z: 1.84, yaw: 0, width: 2.76 });
      wallX(plaster, -corridor, y, -21.2, -17.5);
      bulletinBoard(-corridor + 0.13, y, -19.35, 2.3, -1);
    }
    for (let z = -2.5; z > oldWing.rear; z -= 4.45) ceilingLight(0, y, z, 1.92);
    block(teal, 0, y + 2.72, -40.08, 3.36, 0.31, 0.22);
    block(teal, 0, y + 2.72, -44.92, 3.36, 0.31, 0.22);
    signs.push({ label: "Old CSE", subtitle: "Covered passage", x: 0, y: y + 2.73, z: -39.94, yaw: Math.PI, width: 2.52 });
    signs.push({ label: "New CSE", x: 0, y: y + 2.73, z: -45.06, yaw: 0, width: 2.52 });
    signs.push({ label: floor ? "First Floor" : "Ground Floor", subtitle: "Computer Science and Engineering", x: 0,
      y: y + 2.72, z: floor ? -0.22 : 0.86, yaw: 0, width: 2.8 });
  }

  function staircase() {
    section = "stairs";
    const { bounds: [left, rear, right, front], lowerRunZ, upperRunZ, lowerDoorZ, upperDoorZ, doorWidth } = cseInteriorLayout.stairs;
    const top = cseInteriorLayout.floorHeights[1];
    const width = right - left;
    const middleX = (right + left) / 2;
    const rise = top / 20;
    const depth = (lowerRunZ - upperRunZ) / 20;
    block(warmStage, middleX, -0.084, (front + lowerRunZ) / 2, width, 0.168, front - lowerRunZ);
    block(warmStage, middleX, top - 0.084, (rear + upperRunZ) / 2, width, 0.168, upperRunZ - rear);
    for (let step = 0; step < 20; step++) {
      const z = lowerRunZ - depth * (step + 0.5);
      const height = (step + 0.5) * rise;
      block(warmStage, middleX, height - 0.095, z, width, 0.19, depth);
      block(porcelain, middleX, height + 0.007, z + depth / 2 - 0.029, width - 0.12, 0.018, 0.047);
    }
    for (const x of [left + 0.145, right - 0.145]) {
      for (let step = 0; step <= 20; step++) {
        const z = lowerRunZ - depth * step;
        const y = rise * step;
        if (step % 4 === 0) block(steel, x, y + 0.46, z, 0.049, 0.91, 0.049);
      }
      const rail = CreateBox("cse-stair-handrail", {
        width: 0.055, height: 0.059, depth: Math.hypot(top, lowerRunZ - upperRunZ),
      }, scene);
      rail.position.set(x, top / 2 + 0.92, (lowerRunZ + upperRunZ) / 2);
      rail.rotation.x = Math.atan2(top, lowerRunZ - upperRunZ);
      collect(rail, steel, false);
    }
    for (const floor of [0, 1] as const) {
      const y = cseInteriorLayout.floorHeights[floor];
      wallX(plaster, left, y, rear, front);
      doorWall(plaster, right, y, rear, front, floor ? upperDoorZ : lowerDoorZ, doorWidth, -1,
        floor ? "Ground floor" : "First floor", "Stairs");
      if (!floor) partitionZ(plaster, left, right, y, front);
    }
    block(ceiling, middleX, top + wallHeight + 0.08, (front + rear) / 2, width, 0.16, front - rear);
    ceilingLight(middleX, top, (rear + front) / 2, 1.3);
  }

  for (const floor of [0, 1] as const) hallway(floor);
  staircase();
  for (const room of cseInteriorLayout.rooms) shellRoom(room);
  paintSigns();

  for (const [key, batch] of batches) {
    const mesh = batch.meshes.length === 1 ? batch.meshes[0] : Mesh.MergeMeshes(batch.meshes, true, true);
    if (!mesh) continue;
    mesh.name = key;
    mesh.material = batch.material;
    mesh.isPickable = false;
    mesh.checkCollisions = batch.colliding;
    mesh.freezeWorldMatrix();
  }

  function paintSigns() {
    const columns = 4;
    const cellWidth = 512;
    const cellHeight = 96;
    const height = Math.ceil(signs.length / columns) * cellHeight;
    const texture = new DynamicTexture("cse-room-labels", { width: columns * cellWidth, height }, scene, false);
    const context = texture.getContext();
    const material = finish("room-labels", "#ffffff", true);
    material.albedoTexture = texture;
    for (const [index, sign] of signs.entries()) {
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;
      context.fillStyle = "#163f46";
      context.fillRect(x, y, cellWidth, cellHeight);
      context.strokeStyle = "#88aaa1";
      context.lineWidth = 2;
      context.strokeRect(x + 5, y + 5, cellWidth - 10, cellHeight - 10);
      context.fillStyle = "#fff9e9";
      context.font = "bold 40px Segoe UI, sans-serif";
      const available = cellWidth - 28;
      const titleWidth = Math.min(context.measureText(sign.label).width, available);
      context.fillText(sign.label, x + (cellWidth - titleWidth) / 2, y + (sign.subtitle ? 47 : 62), available);
      if (sign.subtitle) {
        context.font = "24px Segoe UI, sans-serif";
        context.fillStyle = "#d6e5dc";
        const subtitleWidth = Math.min(context.measureText(sign.subtitle).width, available);
        context.fillText(sign.subtitle, x + (cellWidth - subtitleWidth) / 2, y + 77, available);
      }

      const plane = CreatePlane("cse-room-plaque", { width: sign.width, height: sign.width * 0.1875 }, scene);
      plane.position.set(sign.x, sign.y, sign.z);
      plane.rotation.y = sign.yaw;
      const uv = plane.getVerticesData(VertexBuffer.UVKind)!;
      for (let vertex = 0; vertex < uv.length; vertex += 2) {
        uv[vertex] = (x + 1 + (1 - uv[vertex]) * (cellWidth - 2)) / (columns * cellWidth);
        uv[vertex + 1] = 1 - (y + cellHeight - 1 - uv[vertex + 1] * (cellHeight - 2)) / height;
      }
      plane.setVerticesData(VertexBuffer.UVKind, uv);
      collect(plane, material, false);
    }
    texture.update();
  }
}
