import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { adminCoreBuildings } from "@gta-mmmut/world-data/admin-core";
import { applyMasonryUvs, createMasonryMaterial } from "./masonry-finishes";

function sign(
  scene: Scene, name: string, x: number, y: number, z: number, width: number, height: number,
  lines: readonly string[],
) {
  const texture = new DynamicTexture(name, { width: 1024, height: 160 }, scene, true);
  const context = texture.getContext();
  context.fillStyle = "#57342f";
  context.fillRect(0, 0, 1024, 160);
  context.fillStyle = "#f5ead6";
  for (const [index, line] of lines.entries()) {
    const size = lines.length === 1 ? 94 : 63;
    context.font = `bold ${size}px "Nirmala UI", sans-serif`;
    const left = (1024 - Math.min(context.measureText(line).width, 960)) / 2;
    const baseline = ((index + 0.5) * 160) / lines.length + size * 0.31;
    context.fillText(line, left, baseline, 960);
  }
  texture.update();

  const paint = new PBRMaterial(name, scene);
  paint.unlit = true;
  paint.albedoTexture = texture;
  const plane = CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
  plane.position.set(x, y, z);
  plane.material = paint;
  plane.isPickable = false;
}

export function createB71Facade(scene: Scene, shadows: ShadowGenerator) {
  const building = adminCoreBuildings.find(({ id }) => id === "B71");
  if (!building) return;
  const outline = building.footprint.map(annotationToWorld);
  const southWalls = outline.flatMap(([x, z], index) => {
    const [nextX, nextZ] = outline[(index + 1) % outline.length];
    return z === nextZ && nextX < x ? [{ left: nextX, right: x, z }] : [];
  });
  const entry = southWalls.reduce((front, wall) => wall.z > front.z ? wall : front);

  const pieces = new Map<PBRMaterial, Mesh[]>();
  function finish(name: string, color: string, roughness = 0.85) {
    const material = new PBRMaterial(`B71-${name}`, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.metallic = 0;
    material.roughness = roughness;
    return material;
  }

  const stone = createMasonryMaterial(scene, "B71-cream", "#ddd0b3");
  const pier = createMasonryMaterial(scene, "B71-sand-piers", "#c8a484", "stone");
  const frames = finish("window-frames", "#c7b79d");
  const glass = finish("dark-glazing", "#304650", 0.36);
  const deepGlass = finish("entry-glazing", "#25363b", 0.5);
  const fascia = createMasonryMaterial(scene, "B71-maroon-fascia", "#793f37");

  function box(
    material: PBRMaterial, x: number, y: number, z: number,
    width: number, height: number, depth: number,
  ) {
    const mesh = CreateBox(material.name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    applyMasonryUvs(mesh, material);
    const batch = pieces.get(material) ?? [];
    batch.push(mesh);
    pieces.set(material, batch);
  }

  function windowBay(x: number, y: number, z: number, width: number, height: number) {
    box(frames, x, y, z + 0.07, width + 0.19, height + 0.19, 0.14);
    box(glass, x, y, z + 0.16, width, height, 0.06);
    box(frames, x, y, z + 0.208, 0.065, height, 0.05);
    box(frames, x, y - height / 2 - 0.1, z + 0.15, width + 0.22, 0.12, 0.3);
  }

  for (const wall of southWalls) {
    const width = wall.right - wall.left;
    const midpoint = (wall.left + wall.right) / 2;
    const roof = building.height;
    box(stone, midpoint, roof + 0.21, wall.z + 0.02, width, 0.45, 0.3);
    box(pier, midpoint, 3.48, wall.z + 0.15, width, 0.22, 0.3);
    box(stone, midpoint, 0.34, wall.z + 0.06, width, 0.52, 0.14);

    if (wall === entry) continue;
    const bays = Math.max(3, Math.round(width / 4.65));
    const spacing = width / bays;
    for (let index = 0; index < bays; index++) {
      const x = wall.left + spacing * (index + 0.5);
      windowBay(x, 1.98, wall.z, spacing * 0.68, 1.52);
      windowBay(x, 5.12, wall.z, spacing * 0.64, 1.56);
    }
    for (let index = 0; index <= bays; index++) {
      const x = wall.left + spacing * index;
      box(pier, x, 3.86, wall.z + 0.19, 0.37, 7.72, 0.53);
    }
  }

  // The photo supports a raised sign band and a shallow maroon portico.
  const x = (entry.left + entry.right) / 2;
  const { z } = entry;
  const width = entry.right - entry.left;
  box(stone, x, building.height + 0.4, z - 0.8, width, 1.26, 2.05);
  box(deepGlass, x, 1.75, z + 0.05, width * 0.61, 3.3, 0.12);
  box(frames, x, 1.62, z + 0.14, 0.12, 3.02, 0.1);
  for (const offset of [-0.29, 0, 0.29]) {
    windowBay(x + width * offset, 5.11, z, width * 0.2, 1.63);
  }
  box(fascia, x, 3.55, z + 0.71, width + 0.35, 0.72, 1.57);
  box(stone, x, 3.99, z + 0.71, width + 0.55, 0.18, 1.68);

  for (const side of [-1, 1]) {
    const post = CreateBox("B71-portico-post", { width: 0.67, height: 3.24, depth: 0.65 }, scene);
    post.position.set(x + side * width * 0.42, 1.62, z + 1.22);
    applyMasonryUvs(post, pier);
    post.material = pier;
    post.checkCollisions = true;
    post.receiveShadows = true;
    shadows.addShadowCaster(post);
  }

  for (const [material, meshes] of pieces) {
    if (meshes.length === 0) continue;
    const batch = Mesh.MergeMeshes(meshes, true, true);
    if (!batch) continue;
    batch.name = material.name;
    batch.material = material;
    batch.receiveShadows = true;
    batch.checkCollisions = material === pier;
    batch.isPickable = false;
  }

  sign(scene, "B71-university-sign", x, 7.56, z + 0.255, width - 0.35, 0.86, [
    "मदन मोहन मालवीय प्रौद्योगिकी विश्वविद्यालय, गोरखपुर",
    "Madan Mohan Malaviya University of Technology, Gorakhpur",
  ]);
  sign(scene, "B71-entry-sign", x, 3.55, z + 1.505, 4.52, 0.53, ["Administrative Block"]);
}
