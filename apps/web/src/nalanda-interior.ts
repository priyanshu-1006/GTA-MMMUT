import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type FurnishedInterior } from "./interior-furnishing";

const leftEdge = -24;
const wingEnd = 20;
const outerEdge = 25;
const hallEdge = 12;
const courtEdge = 8.8;
const serviceEdge = 29;
const hallWidth = (wingEnd - leftEdge) / 3;
const hallDepth = outerEdge - hallEdge;
const entranceZ = 6.1;
const hallHeight = 4.35;
const doorHeight = 2.28;
const aisleHalf = 0.99;
const tierStart = 3.25;
const tierPitch = 1.67;
const tierRise = 0.205;
const tierCount = 6;

// B35 faces the Library to the south, B33 is beside Electrical to the north,
// and the B34 wing closes the east side of the courtyard.
const wings = [
  { side: 1, label: "Library-side wing", halls: ["L-103", "L-104", "L-105"] },
  { side: -1, label: "Electrical-side wing", halls: ["L-106", "L-107", "L-108"] },
] as const;

export function buildNalandaInterior(scene: Scene): FurnishedInterior {
  scene.clearColor = new Color4(0.64, 0.75, 0.81, 1);
  const batches = new Map<string, { material: PBRMaterial; solid: boolean; meshes: Mesh[] }>();
  const signs: { text: string; x: number; y: number; z: number; yaw: number; width: number }[] = [];
  let section = "court";
  const { patterned } = createInteriorFurnishing(scene, "nalanda");

  function finish(name: string, color: string, unlit = false) {
    const material = new PBRMaterial(`nalanda-${name}`, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.roughness = 0.86;
    material.metallic = 0;
    material.unlit = unlit;
    return material;
  }

  const plaster = finish("plaster", "#e3dfd8");
  const beam = finish("concrete-beams", "#ccc9c2");
  const cement = patterned("worn-grey-treads", "#8c8880", "#7d776c");
  const edge = finish("tread-edges", "#a39d90");
  const paving = patterned("court-paving", "#b8aa97", "#a29482");
  const lawn = finish("court-grass", "#77895b");
  const wood = patterned("dark-bench-wood", "#62412d", "#4c352a", true);
  const woodFace = finish("worn-bench-edges", "#805c42");
  const steel = finish("desk-frames", "#353b38");
  const teal = finish("blue-green-frames", "#366069");
  const glass = finish("daylit-windows", "#c6dad2", true);
  const curtains = [finish("burgundy-curtains", "#75363e"), finish("burgundy-folds", "#592e37")];
  const chalk = finish("chalkboard", "#315144");
  const white = finish("whiteboard", "#ebe7dd");
  const light = finish("fluorescent-tubes", "#f8f0dd", true);
  const porcelain = finish("washroom-fixtures", "#edeae3");
  const washTile = finish("washroom-tile", "#a7bbba");
  const paper = [finish("notebook-cream", "#ddd6bc"), finish("notebook-red", "#99534e"), finish("notebook-blue", "#4c7780")];
  const draftingScreen = finish("graphics-display", "#496871", true);
  const note = finish("chalk-tray", "#beb3a1");

  function collect(mesh: Mesh, material: PBRMaterial, solid = false) {
    const key = solid ? `${section}/${material.name}` : material.name;
    let batch = batches.get(key);
    if (!batch) {
      batch = { material, solid, meshes: [] };
      batches.set(key, batch);
    }
    batch.meshes.push(mesh);
  }

  function box(material: PBRMaterial, x: number, y: number, z: number,
    width: number, height: number, depth: number, solid = false, yaw = 0,
  ) {
    const mesh = CreateBox(material.name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    collect(mesh, material, solid);
  }

  function rect(material: PBRMaterial, x0: number, z0: number, x1: number, z1: number, y = 0) {
    const mesh = CreateGround(material.name, { width: x1 - x0, height: z1 - z0 }, scene);
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    for (let vertex = 0; vertex < uv.length; vertex += 2) {
      uv[vertex] = (x0 + uv[vertex] * (x1 - x0)) / 1.45;
      uv[vertex + 1] = (z0 + uv[vertex + 1] * (z1 - z0)) / 1.45;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
    collect(mesh, material);
  }

  function cylinder(material: PBRMaterial, x: number, y: number, z: number, diameter: number, height: number) {
    const mesh = CreateCylinder(material.name, { diameter, height, tessellation: 10 }, scene);
    mesh.position.set(x, y, z);
    collect(mesh, material);
  }

  function wallZ(x0: number, x1: number, z: number, height: number, bottom = 0) {
    box(plaster, (x0 + x1) / 2, bottom + height / 2, z, x1 - x0, height, 0.17, true);
  }

  function wallX(x: number, z0: number, z1: number, height: number, bottom = 0) {
    box(plaster, x, bottom + height / 2, (z0 + z1) / 2, 0.17, height, z1 - z0, true);
  }

  function tubeLight(x: number, y: number, z: number, yaw = 0) {
    box(steel, x, y + 0.045, z, 1.63, 0.06, 0.17, false, yaw);
    box(light, x, y, z, 1.58, 0.056, 0.11, false, yaw);
  }

  function fan(x: number, z: number, ceiling: number, yaw: number) {
    const y = ceiling - 0.59;
    cylinder(steel, x, y + 0.22, z, 0.066, 0.44);
    cylinder(steel, x, y, z, 0.25, 0.15);
    for (let blade = 0; blade < 3; blade++) {
      const angle = yaw + blade * 2 * Math.PI / 3;
      box(steel, x + Math.cos(angle) * 0.53, y - 0.014, z - Math.sin(angle) * 0.53,
        0.92, 0.045, 0.14, false, angle);
    }
  }

  function window(x: number, z: number, inward: number, hasCurtain: boolean) {
    const face = z + inward * 0.091;
    box(teal, x, 2.41, face, 1.86, 1.94, 0.055);
    box(glass, x, 2.41, face + inward * 0.039, 1.73, 1.81, 0.027);
    box(teal, x, 2.41, face + inward * 0.059, 0.054, 1.84, 0.033);
    for (const y of [1.98, 2.59]) box(teal, x, y, face + inward * 0.059, 1.77, 0.047, 0.033);
    box(beam, x, 1.41, face + inward * 0.102, 1.98, 0.09, 0.25);
    if (hasCurtain) {
      box(steel, x, 3.51, face + inward * 0.16, 2.14, 0.037, 0.037);
      for (const side of [-1, 1]) {
        for (let pleat = 0; pleat < 5; pleat++) {
          const xPleat = x + side * (0.44 + pleat * 0.105);
          box(curtains[pleat % 2], xPleat, 2.39, face + inward * (0.15 + pleat % 2 * 0.037), 0.12, 2.22, 0.082);
        }
      }
    }
  }

  function classroom(id: string, x0: number, x1: number, side: number) {
    section = id;
    const front = side * hallEdge;
    const back = side * outerEdge;
    const center = (front + back) / 2;
    const z0 = Math.min(front, back);
    const z1 = Math.max(front, back);
    const door = x0 + 1.66;
    const doorHalf = 0.94;
    const depth = x1 - x0;
    const signYaw = side === 1 ? 0 : Math.PI;

    rect(cement, x0, z0, x1, z1);
    wallZ(x0, x1, back, hallHeight);
    wallZ(x0, door - doorHalf, front, hallHeight);
    wallZ(door + doorHalf, x1, front, hallHeight);
    wallZ(door - doorHalf, door + doorHalf, front, hallHeight - doorHeight, doorHeight);
    wallX(x0, z0, z1, hallHeight);
    if (x1 === wingEnd) wallX(x1, z0, z1, hallHeight);
    box(plaster, (x0 + x1) / 2, hallHeight + 0.07, center, depth, 0.14, hallDepth);
    for (const x of [door - doorHalf - 0.035, door + doorHalf + 0.035]) box(teal, x, doorHeight / 2, front, 0.085, doorHeight, 0.215);
    box(teal, door, doorHeight + 0.035, front, doorHalf * 2 + 0.17, 0.086, 0.215);
    const leaf = door + doorHalf - 0.043;
    box(teal, leaf + 0.13, doorHeight / 2, front + side * 0.455, 0.91, doorHeight - 0.075, 0.073, false, side * -1.3);
    box(steel, leaf + 0.23, 1.02, front + side * 0.8, 0.13, 0.065, 0.05);
    signs.push({ text: id, x: door, y: 2.59, z: front - side * 0.097, yaw: signYaw, width: 1.51 });

    for (const along of [4.5, 8.62, 12.2]) {
      window(x0 + along, front, side, true);
      window(x0 + along, front, -side, false);
      window(x0 + along, back, -side, true);
    }

    box(woodFace, x0 + 0.18, 1.92, center - 0.76, 0.15, 1.37, 6.18);
    box(chalk, x0 + 0.264, 1.92, center - 0.76, 0.036, 1.24, 6.04);
    box(white, x0 + 0.247, 1.94, center + 3.81, 0.067, 1.25, 2.57);
    box(note, x0 + 0.305, 1.26, center - 0.76, 0.155, 0.055, 6.16);
    box(porcelain, x0 + 0.23, 3.37, center + 3.12, 0.36, 0.34, 0.95);
    box(beam, x0 + 0.28, 3.29, center + 3.12, 0.39, 0.06, 0.82);
    const deskZ = center + side * 2.75;
    box(wood, x0 + 1.57, 0.46, deskZ, 0.72, 0.92, 2.63, true);
    box(woodFace, x0 + 1.57, 0.946, deskZ, 0.86, 0.052, 2.78);
    box(paper[0], x0 + 1.62, 0.978, deskZ + 0.39, 0.26, 0.015, 0.35);
    box(woodFace, x0 + 0.85, 0.57, center - side * 4.71, 0.46, 1.14, 0.57, true);

    const halfBank = (hallDepth / 2 - aisleHalf) / 2;
    const aisle = aisleHalf * 2;
    for (let row = 0; row < tierCount; row++) {
      const start = tierStart + row * tierPitch;
      const end = row === tierCount - 1 ? depth : start + tierPitch;
      const split = start + 0.55;
      const base = (row + 1) * tierRise;
      for (const bank of [-1, 1]) {
        const bankZ = center + bank * (aisleHalf + halfBank);
        box(cement, x0 + (start + end) / 2, base / 2, bankZ, end - start, base, halfBank * 2);
        box(edge, x0 + start + 0.023, base + 0.002, bankZ, 0.046, 0.015, halfBank * 2);
        const seatZ = center + bank * (aisleHalf + 2.16);
        const deskX = x0 + start + 0.36;
        box(wood, deskX, base + 0.765, seatZ, 0.51, 0.067, 4.26, true);
        box(woodFace, deskX - 0.242, base + 0.664, seatZ, 0.053, 0.19, 4.23);
        box(wood, x0 + start + 1.03, base + 0.445, seatZ, 0.34, 0.064, 4.26, true);
        for (const z of [seatZ - 1.68, seatZ + 1.68]) {
          box(steel, deskX, base + 0.36, z, 0.054, 0.72, 0.052);
          box(steel, x0 + start + 1.03, base + 0.208, z, 0.058, 0.416, 0.052);
        }
        box(paper[(row + (bank > 0 ? 1 : 0)) % paper.length], deskX + 0.02, base + 0.806, seatZ + bank * 0.65,
          0.16, 0.014, 0.24, false, bank * 0.14);
      }
      const lower = base - tierRise / 2;
      box(cement, x0 + (start + split) / 2, lower / 2, center, split - start, lower, aisle);
      box(cement, x0 + (split + end) / 2, base / 2, center, end - split, base, aisle);
      for (const [treadX, treadY] of [[start, lower], [split, base]]) {
        box(edge, x0 + treadX + 0.023, treadY + 0.002, center, 0.046, 0.015, aisle);
      }
    }

    for (const distance of [2.7, 6.35, 10, 13.45]) {
      box(beam, x0 + distance, hallHeight - 0.15, center, 0.35, 0.31, hallDepth);
      tubeLight(x0 + distance + 0.36, hallHeight - 0.28, center - 3.7, Math.PI / 2);
      tubeLight(x0 + distance + 0.36, hallHeight - 0.28, center + 3.7, Math.PI / 2);
    }
    for (const along of [4.1, 8.15, 12.15]) {
      fan(x0 + along, center - 2.84, hallHeight, 0.36);
      fan(x0 + along, center + 2.84, hallHeight, -0.19);
    }
  }

  function serviceRoom(name: string, z0: number, z1: number) {
    section = name;
    const height = 3.35;
    const door = (z0 + z1) / 2;
    rect(cement, wingEnd, z0, serviceEdge, z1);
    wallX(serviceEdge, z0, z1, height);
    wallX(wingEnd, z0, door - 0.93, height);
    wallX(wingEnd, door + 0.93, z1, height);
    wallX(wingEnd, door - 0.93, door + 0.93, height - doorHeight, doorHeight);
    wallZ(wingEnd, serviceEdge, z0, height);
    if (z1 === hallEdge) wallZ(wingEnd, serviceEdge, z1, height);
    box(plaster, (wingEnd + serviceEdge) / 2, height + 0.07, door, serviceEdge - wingEnd, 0.14, z1 - z0);
    for (const z of [door - 0.96, door + 0.96]) box(teal, wingEnd, doorHeight / 2, z, 0.219, doorHeight, 0.088);
    box(teal, wingEnd, doorHeight + 0.036, door, 0.219, 0.087, 2);
    signs.push({ text: name, x: wingEnd - 0.098, y: 2.59, z: door, yaw: Math.PI / 2, width: name === "Washroom" ? 2.12 : 3.4 });
    tubeLight(23.4, height - 0.17, door - 2);
    tubeLight(26.3, height - 0.17, door + 2);
    return door;
  }

  // The courtyard and covered walks keep all three wings connected at grade.
  rect(paving, leftEdge - 0.24, -hallEdge, wingEnd, hallEdge);
  wallX(leftEdge - 0.24, -hallEdge, entranceZ - 1.4, 2.3);
  wallX(leftEdge - 0.24, entranceZ + 1.4, hallEdge, 2.3);
  box(beam, leftEdge - 0.24, 2.69, entranceZ, 0.25, 0.33, 2.97);
  signs.push({ text: "Campus exit", x: leftEdge - 0.1, y: 2.7, z: entranceZ, yaw: -Math.PI / 2, width: 2.45 });
  for (const [x, z] of [[-11.6, -3.8], [-11.6, 3.8], [7.7, -3.8], [7.7, 3.8]]) {
    box(beam, x, 0.11, z, 13.4, 0.22, 4.28, true);
    box(lawn, x, 0.224, z, 13.08, 0.019, 3.98);
  }
  for (const { side, label, halls } of wings) {
    section = label;
    const roofZ = side * (courtEdge + hallEdge) / 2;
    box(beam, (leftEdge + wingEnd) / 2, 3.26, roofZ, wingEnd - leftEdge, 0.18, hallEdge - courtEdge);
    for (let x = leftEdge + 0.25; x < wingEnd; x += 5.45) {
      box(plaster, x, 1.59, side * (courtEdge + 0.18), 0.28, 3.18, 0.28, true);
      if (x + 2 < wingEnd) tubeLight(x + 2, 3.04, roofZ);
    }
    signs.push({ text: label, x: -18.2, y: 2.84, z: side * (courtEdge - 0.14), yaw: side === 1 ? 0 : Math.PI, width: 3.05 });
    for (const [index, id] of halls.entries()) {
      const x0 = leftEdge + index * hallWidth;
      classroom(id, x0, index === 2 ? wingEnd : x0 + hallWidth, side);
    }
  }
  section = "east-walk";
  box(beam, wingEnd - 1.7, 3.26, 0, 3.4, 0.18, hallEdge * 2);
  for (const z of [-8, -4, 0, 4, 8]) box(plaster, wingEnd - 3.24, 1.59, z, 0.28, 3.18, 0.28, true);

  const graphicsZ = serviceRoom("Graphics Designing Room", -hallEdge, -0.45);
  for (const x of [23.5, 25.37]) {
    for (const z of [graphicsZ - 2.82, graphicsZ + 2.82]) {
      box(woodFace, x, 0.85, z, 1.31, 0.078, 1.54, true);
      for (const side of [-1, 1]) box(steel, x, 0.395, z + side * 0.63, 0.76, 0.79, 0.07);
      box(porcelain, x - 0.04, 0.9, z, 0.81, 0.018, 1.01);
      box(note, x + 0.17, 0.922, z + 0.28, 0.51, 0.02, 0.048);
    }
  }
  box(wood, 28.17, 0.78, graphicsZ, 0.67, 0.084, 7.52, true);
  for (const z of [graphicsZ - 2.2, graphicsZ, graphicsZ + 2.2]) {
    box(steel, 28.27, 1.145, z, 0.14, 0.5, 0.83);
    box(draftingScreen, 28.184, 1.17, z, 0.036, 0.41, 0.74);
    box(steel, 28.08, 0.84, z, 0.36, 0.041, 0.59);
  }
  fan(25.2, graphicsZ, 3.35, 0.38);

  const washZ = serviceRoom("Washroom", -0.45, hallEdge);
  for (const side of [-1, 1]) {
    box(washTile, 24.5, 0.68, washZ + side * 6.122, 8.79, 1.36, 0.044);
  }
  for (const z of [washZ - 3.16, washZ - 1.57, washZ + 0.02]) {
    box(washTile, 27.71, 1.03, z - 0.75, 2.4, 2.06, 0.105, true);
    box(teal, 26.55, 0.98, z - 0.52, 0.05, 1.79, 0.45);
    cylinder(porcelain, 28.24, 0.32, z, 0.38, 0.55);
    box(porcelain, 28.49, 0.47, z, 0.23, 0.34, 0.34);
  }
  box(washTile, 27.71, 1.03, washZ + 0.83, 2.4, 2.06, 0.105, true);
  for (const z of [washZ + 2.35, washZ + 3.78]) {
    box(porcelain, 28.54, 0.84, z, 0.62, 0.17, 0.72, true);
    box(glass, 28.88, 1.48, z, 0.041, 0.71, 0.58);
    box(steel, 28.72, 0.99, z, 0.15, 0.14, 0.043);
  }

  paintSigns();
  for (const [key, { material, solid, meshes }] of batches) {
    const mesh = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = key;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.checkCollisions = solid;
    mesh.freezeWorldMatrix();
  }

  function paintSigns() {
    if (typeof document === "undefined") return;
    const columns = 3;
    const cellWidth = 480;
    const cellHeight = 90;
    const width = columns * cellWidth;
    const height = Math.ceil(signs.length / columns) * cellHeight;
    const texture = new DynamicTexture("nalanda-sign-atlas", { width, height }, scene, false);
    const context = texture.getContext();
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const signFinish = finish("room-signs", "#ffffff", true);
    signFinish.albedoTexture = texture;
    for (const [index, sign] of signs.entries()) {
      const u = index % columns * cellWidth;
      const v = Math.floor(index / columns) * cellHeight;
      context.fillStyle = "#243846";
      context.fillRect(u, v, cellWidth, cellHeight);
      context.strokeStyle = "#b4c0b5";
      context.lineWidth = 2;
      context.strokeRect(u + 6, v + 6, cellWidth - 12, cellHeight - 12);
      context.font = "bold 38px Segoe UI, sans-serif";
      context.fillStyle = "#fcf2de";
      const titleWidth = Math.min(context.measureText(sign.text).width, cellWidth - 26);
      context.fillText(sign.text, u + (cellWidth - titleWidth) / 2, v + 59, cellWidth - 26);

      const mesh = CreatePlane("nalanda-room-plaque", { width: sign.width, height: 0.4 }, scene);
      mesh.position.set(sign.x, sign.y, sign.z);
      mesh.rotation.y = sign.yaw;
      const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
      for (let vertex = 0; vertex < uv.length; vertex += 2) {
        uv[vertex] = (u + 1 + (1 - uv[vertex]) * (cellWidth - 2)) / width;
        uv[vertex + 1] = 1 - (v + cellHeight - 1 - uv[vertex + 1] * (cellHeight - 2)) / height;
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uv);
      collect(mesh, signFinish);
    }
    texture.update();
  }

  function classroomAt(x: number, z: number) {
    if (x < leftEdge || x >= wingEnd || Math.abs(z) <= hallEdge || Math.abs(z) > outerEdge) return undefined;
    const index = Math.min(2, Math.floor((x - leftEdge) / hallWidth));
    const wing = z > 0 ? wings[0] : wings[1];
    return { id: wing.halls[index], distance: x - (leftEdge + index * hallWidth) };
  }

  return {
    spawn: [-22.65, 0, entranceZ] as const,
    extent: [leftEdge - 0.24, -outerEdge, serviceEdge, outerEdge] as const,
    floorAt(x: number, z: number, _currentY: number) {
      const classroom = classroomAt(x, z);
      if (!classroom || classroom.distance < tierStart) return 0;
      const row = Math.min(tierCount - 1, Math.floor((classroom.distance - tierStart) / tierPitch));
      const inAisle = Math.abs(Math.abs(z) - (hallEdge + outerEdge) / 2) < aisleHalf;
      const firstTread = classroom.distance < tierStart + row * tierPitch + 0.55;
      return tierRise * (row + 1 - (inAisle && firstTread ? 0.5 : 0));
    },
    location(x: number, _y: number, z: number) {
      const classroom = classroomAt(x, z);
      if (classroom) return classroom.id;
      if (x > wingEnd) return z < -0.45 ? "Graphics Designing Room" : "Washroom";
      if (z > courtEdge) return wings[0].label;
      if (z < -courtEdge) return wings[1].label;
      if (x > wingEnd - 3.4) return "Transverse wing";
      return "Nalanda courtyard";
    },
    exitNear(x: number, y: number, z: number) {
      return x < leftEdge + 1.8 && y < 0.4 && Math.abs(z - entranceZ) < 1.62;
    },
  };
}
