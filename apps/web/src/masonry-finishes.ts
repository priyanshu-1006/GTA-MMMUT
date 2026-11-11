import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export type MasonryFinish = "plaster" | "concrete" | "stone";

const concretePhoto = new URL("./assets/materials/concrete-wall.webp", import.meta.url).href;
const texturesByScene = new WeakMap<Scene, Map<MasonryFinish, Texture>>();
const materialRepeat = new WeakMap<PBRMaterial, number>();
const repeatMeters: Readonly<Record<MasonryFinish, number>> = { plaster: 3.6, concrete: 4, stone: 2.5 };

function grain(x: number, y: number) {
  let seed = Math.imul(x + 11, 1376312589) ^ Math.imul(y + 23, 789221);
  seed = Math.imul(seed ^ seed >>> 16, 0x45d9f3b);
  return ((seed ^ seed >>> 16) >>> 0) / 4294967295;
}

function weathering(x: number, y: number, cells: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = x - ix;
  const sy = y - iy;
  const fx = sx * sx * (3 - 2 * sx);
  const fy = sy * sy * (3 - 2 * sy);
  const left = ix % cells;
  const top = iy % cells;
  const right = (ix + 1) % cells;
  const bottom = (iy + 1) % cells;
  const north = grain(left, top) * (1 - fx) + grain(right, top) * fx;
  const south = grain(left, bottom) * (1 - fx) + grain(right, bottom) * fx;
  return north * (1 - fy) + south * fy;
}

function weatheredTexture(scene: Scene, finish: "plaster" | "stone") {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  const stone = finish === "stone";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broad = weathering(x / 32, y / 32, 8);
      const pores = weathering(x / 8, y / 8, 32);
      const fine = grain(x, y);
      const value = 236 + 16 * broad + (stone ? 16 : 8) * (pores - 0.5) + (stone ? 17 : 10) * (fine - 0.5);
      const start = (y * size + x) * 4;
      pixels[start] = pixels[start + 1] = pixels[start + 2] = Math.min(255, Math.round(value));
      pixels[start + 3] = 255;
    }
  }
  const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.level = 1.08;
  return texture;
}

function getTexture(scene: Scene, finish: MasonryFinish) {
  let textures = texturesByScene.get(scene);
  if (!textures) texturesByScene.set(scene, textures = new Map());
  let texture = textures.get(finish);
  if (!texture) {
    texture = finish === "concrete" ? new Texture(concretePhoto, scene) : weatheredTexture(scene, finish);
    texture.name = `campus-${finish}-surface`;
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    if (finish === "concrete") texture.level = 3;
    textures.set(finish, texture);
  }
  return texture;
}

export function createMasonryMaterial(scene: Scene, name: string, color: string, finish: MasonryFinish = "plaster") {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = Color3.FromHexString(color).toLinearSpace();
  material.albedoTexture = getTexture(scene, finish);
  material.metallic = 0;
  material.roughness = finish === "stone" ? 0.94 : 0.9;
  materialRepeat.set(material, repeatMeters[finish]);
  return material;
}

export function applyMasonryUvs(mesh: Mesh, material: PBRMaterial) {
  const repeat = materialRepeat.get(material);
  if (repeat === undefined) return;
  const points = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!points || !normals) return;

  // The hard normal of each façade gives its horizontal axis, including diagonal walls.
  const uvs = new Float32Array(points.length / 3 * 2);
  const at = mesh.position;
  for (let i = 0, uv = 0; i < points.length; i += 3, uv += 2) {
    const x = points[i] + at.x;
    const z = points[i + 2] + at.z;
    if (Math.abs(normals[i + 1]) > 0.9) {
      uvs[uv] = x / repeat;
      uvs[uv + 1] = z / repeat;
    } else {
      const nx = normals[i];
      const nz = normals[i + 2];
      uvs[uv] = (nz * x - nx * z) / (repeat * Math.hypot(nx, nz));
      uvs[uv + 1] = (points[i + 1] + at.y) / repeat;
    }
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}
