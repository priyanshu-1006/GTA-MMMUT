import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

type Point3 = readonly [x: number, y: number, z: number];
export type InteriorBounds = readonly [minX: number, minZ: number, maxX: number, maxZ: number];

interface FurnishedLocation {
  readonly section: string;
  readonly floor?: number;
  readonly room?: string;
  readonly roomId?: string;
}

export interface FurnishedInterior {
  readonly spawn: Point3;
  readonly extent: InteriorBounds;
  floorAt(x: number, z: number, currentY: number): number;
  location(x: number, y: number, z: number): string | FurnishedLocation;
  exitNear(x: number, y: number, z: number): boolean;
}

const interpolate = (from: number, to: number, fraction: number) => from + (to - from) * fraction;

export function createInteriorFurnishing(scene: Scene, prefix: string) {
  const batches = new Map<PBRMaterial, Mesh[]>();

  function material(name: string, color: string, unlit = false) {
    const finish = new PBRMaterial(`${prefix}-${name}`, scene);
    finish.albedoColor = Color3.FromHexString(color).toLinearSpace();
    finish.metallic = 0;
    finish.roughness = 0.86;
    finish.unlit = unlit;
    return finish;
  }

  function patterned(name: string, color: string, joint: string, wood = false, repeat: readonly [number, number] = [1, 1]) {
    const finish = material(name, "#ffffff");
    const size = 128;
    const pixels = new Uint8Array(size * size * 4);
    const base = Color3.FromHexString(color).asArray().map((value) => value * 255);
    const seam = Color3.FromHexString(joint).asArray().map((value) => value * 255);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const plank = Math.floor(x / 32);
        const grain = wood ? Math.sin(x * 1.05 + Math.sin(y * 0.09) * 0.4) * 3.1 + (plank % 3 - 1) * 4.5 : 0;
        const onSeam = wood ? x % 32 === 0 || (y + plank * 41) % size === 0 : x === 0 || y === 0;
        const fleck = ((x * 47 ^ y * 31) % 11 - 5) * (wood ? 0.6 : 0.9);
        const offset = (y * size + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          pixels[offset + channel] = Math.min(255, Math.max(0, onSeam ? seam[channel] : base[channel] + grain + fleck));
        }
        pixels[offset + 3] = 255;
      }
    }
    const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene, true, false);
    texture.name = `${prefix}-${name}-surface`;
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    [texture.uScale, texture.vScale] = repeat;
    finish.albedoTexture = texture;
    return finish;
  }

  function collect(mesh: Mesh, finish: PBRMaterial, collider: boolean) {
    mesh.material = finish;
    mesh.isPickable = false;
    if (collider) {
      mesh.checkCollisions = true;
      mesh.freezeWorldMatrix();
    } else {
      const batch = batches.get(finish) ?? [];
      batch.push(mesh);
      batches.set(finish, batch);
    }
  }

  function box(finish: PBRMaterial, at: Point3, size: Point3, collider = false) {
    const mesh = CreateBox(finish.name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(...at);
    collect(mesh, finish, collider);
    return mesh;
  }

  function openClassroomDoor(steel: PBRMaterial, glazing: PBRMaterial, [x, y, z]: Point3,
    alongZ: boolean, inward: number, width: number, height: number) {
    const span = width / 2 - 0.035;
    for (const side of [-1, 1]) {
      const edge = side * (width / 2 - 0.035);
      const inside = inward * span / 2;
      const px = x + (alongZ ? inside : edge);
      const pz = z + (alongZ ? edge : inside);
      box(steel, [px, y + height / 2, pz], alongZ ? [span, height - 0.06, 0.054] : [0.054, height - 0.06, span], true);
      const glassOffset = -side * 0.032;
      box(glazing, [px + (alongZ ? 0 : glassOffset), y + height * 0.7, pz + (alongZ ? glassOffset : 0)],
        alongZ ? [span * 0.64, height * 0.32, 0.012] : [0.012, height * 0.32, span * 0.64]);
    }
  }

  function floor(finish: PBRMaterial, [left, rear, right, front]: InteriorBounds, height: number, repeat = 1) {
    const width = right - left;
    const depth = front - rear;
    const mesh = CreateGround(finish.name, { width, height: depth }, scene);
    mesh.position.set((left + right) / 2, height, (rear + front) / 2);
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    for (let index = 0; index < uv.length; index += 2) {
      uv[index] = (left + uv[index] * width) / repeat;
      uv[index + 1] = (rear + uv[index + 1] * depth) / repeat;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
    collect(mesh, finish, false);
  }

  function beam(finish: PBRMaterial, start: Point3, end: Point3, width: number, height: number) {
    const [ax, ay, az] = start;
    const [bx, by, bz] = end;
    const horizontal = Math.hypot(bx - ax, bz - az);
    const mesh = box(finish, [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2],
      [width, height, Math.hypot(horizontal, by - ay)]);
    mesh.rotation.set(-Math.atan2(by - ay, horizontal), Math.atan2(bx - ax, bz - az), 0);
  }

  function railing(rail: PBRMaterial, cap: PBRMaterial, from: Point3, to: Point3) {
    const [x, y, z] = from;
    const [x2, y2, z2] = to;
    const length = Math.hypot(x2 - x, z2 - z);
    const height = 1.04;
    beam(cap, [x, y + height, z], [x2, y2 + height, z2], 0.12, 0.07);
    beam(rail, [x, y + 0.14, z], [x2, y2 + 0.14, z2], 0.043, 0.043);
    const bars = Math.max(1, Math.ceil(length / 0.23));
    for (let index = 0; index <= bars; index++) {
      const fraction = index / bars;
      const thickness = index === 0 || index === bars ? 0.075 : 0.029;
      box(rail, [interpolate(x, x2, fraction), interpolate(y, y2, fraction) + height / 2,
        interpolate(z, z2, fraction)], [thickness, height, thickness]);
    }
    // Two adjacent balusters cannot be traversed by the player collider. Use simple
    // transparent segments to preserve the same barrier on sloped stair rails.
    const pieces = Math.max(1, Math.ceil(Math.abs(y2 - y) / 0.26));
    for (let index = 0; index < pieces; index++) {
      const fraction = (index + 0.5) / pieces;
      const collider = box(rail, [interpolate(x, x2, fraction), interpolate(y, y2, fraction) + height / 2,
        interpolate(z, z2, fraction)], [0.095, height, length / pieces + 0.025], true);
      collider.unfreezeWorldMatrix();
      collider.rotation.y = Math.atan2(x2 - x, z2 - z);
      collider.visibility = 0;
      collider.freezeWorldMatrix();
    }
  }

  function sign(name: string, at: Point3, width: number, height: number, title: string, subtitle?: string, yaw = 0) {
    if (typeof document === "undefined") return;
    const finish = material(name, "#ffffff", true);
    const texture = new DynamicTexture(`${prefix}-${name}-text`, { width: 1024, height: 192 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = "#172d35";
    context.fillRect(0, 0, 1024, 192);
    context.strokeStyle = "#c9a774";
    context.lineWidth = 3;
    context.strokeRect(8, 8, 1008, 176);
    context.fillStyle = "#fff8e8";
    context.font = "bold 60px 'Segoe UI', sans-serif";
    const titleWidth = Math.min(context.measureText(title).width, 960);
    context.fillText(title, (1024 - titleWidth) / 2, subtitle ? 91 : 118, 960);
    if (subtitle) {
      context.fillStyle = "#ded5be";
      context.font = "34px 'Segoe UI', sans-serif";
      const subtitleWidth = Math.min(context.measureText(subtitle).width, 960);
      context.fillText(subtitle, (1024 - subtitleWidth) / 2, 151, 960);
    }
    texture.update();
    finish.albedoTexture = texture;
    const panel = CreatePlane(`${prefix}-${name}`, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    panel.position.set(...at);
    panel.rotation.y = yaw;
    collect(panel, finish, false);
  }

  function finish() {
    for (const [material, meshes] of batches) {
      const mesh = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true);
      if (!mesh) continue;
      mesh.name = material.name;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
    }
  }

  return { material, patterned, box, floor, railing, sign, openClassroomDoor, finish };
}
