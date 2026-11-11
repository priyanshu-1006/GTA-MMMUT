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

export function createB72Facade(scene: Scene, shadows: ShadowGenerator): void {
  const building = adminCoreBuildings.find(({ id }) => id === "B72");
  if (!building) return;

  const footprint = building.footprint.map(annotationToWorld);
  const xs = footprint.map(([x]) => x);
  const zs = footprint.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const backZ = Math.min(...zs);
  const frontZ = Math.max(...zs);
  const width = maxX - minX;
  const centerX = (minX + maxX) / 2;
  const levelHeight = building.height / 2;

  function material(name: string, hex: string, roughness = 0.9) {
    const result = new PBRMaterial(`B72-${name}`, scene);
    result.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    result.roughness = roughness;
    result.metallic = 0;
    return result;
  }

  const plaster = material("ivory-plaster", "#e4e1d6");
  const reveal = material("concrete-reveal", "#a9a598");
  const fin = material("oxide-fin", "#5c4541");
  const frames = material("dark-frames", "#3a4146");
  const glass = material("wing-glazing", "#536570", 0.46);
  const entryGlass = material("blue-entry-glazing", "#345e89", 0.37);
  const entryGlassLight = material("blue-entry-glazing-light", "#416e97", 0.37);
  const batches = new Map<PBRMaterial, Mesh[]>();

  function box(surface: PBRMaterial, size: readonly [number, number, number], x: number, y: number, z: number) {
    const [width, height, depth] = size;
    const mesh = CreateBox(surface.name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    const batch = batches.get(surface) ?? [];
    batch.push(mesh);
    batches.set(surface, batch);
    return mesh;
  }

  // Every detail is thin cladding on the existing collidable mass.
  function face(surface: PBRMaterial, x: number, y: number, w: number, h: number, projection: number) {
    return box(surface, [w, h, projection + 0.035], x, y, frontZ + (projection - 0.035) / 2);
  }

  face(plaster, centerX, building.height / 2, width, building.height, 0.025);
  face(reveal, centerX, 0.16, width, 0.32, 0.075);
  face(plaster, centerX, building.height + 0.24, width, 0.34, 0.08);
  box(plaster, [width, 0.34, 0.17], centerX, building.height + 0.24, backZ + 0.065);
  for (const x of [minX + 0.075, maxX - 0.075]) {
    box(plaster, [0.15, 0.34, frontZ - backZ], x, building.height + 0.24, (frontZ + backZ) / 2);
  }

  // The partial photo supports pale cladding, a blue upper bay and a dark sign.
  // The bay position and the unseen wing rhythm are illustrative.
  const entryX = minX + width * 0.26;
  const entryWidth = 6.4;
  const bayTop = building.height - 0.45;
  face(plaster, entryX, bayTop / 2, entryWidth + 0.8, bayTop, 0.12);
  face(fin, entryX - entryWidth / 2 - 0.58, bayTop / 2, 0.48, bayTop - 0.15, 0.19).rotation.z = 0.075;

  const signY = 2.76;
  const signHeight = 0.47;
  const upperBayBottom = signY + signHeight / 2;
  const upperBayTop = bayTop - 0.36;
  const upperBayHeight = upperBayTop - upperBayBottom;
  const glassWidth = entryWidth - 1.02;
  const glassY = (upperBayTop + upperBayBottom) / 2;
  face(frames, entryX, glassY, glassWidth + 0.17, upperBayHeight + 0.17, 0.15);
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) {
      const cellWidth = glassWidth / 3;
      const cellHeight = upperBayHeight / 3;
      face(
        column === 1 && row !== 0 ? entryGlassLight : entryGlass,
        entryX - glassWidth / 2 + cellWidth * (column + 0.5),
        upperBayBottom + cellHeight * (row + 0.5),
        cellWidth - 0.045,
        cellHeight - 0.045,
        0.17,
      );
    }
  }

  face(frames, entryX, 1.27, 3.35, 2.36, 0.17);
  for (const offset of [-0.78, 0.78]) {
    face(glass, entryX + offset, 1.3, 1.48, 2.14, 0.195);
  }
  face(reveal, entryX, 0.055, 3.52, 0.11, 0.2);

  const wings = [
    [minX + 1.3, entryX - entryWidth / 2 - 1.1],
    [entryX + entryWidth / 2 + 1.1, maxX - 1.3],
  ];
  for (const [start, end] of wings) {
    const count = Math.max(1, Math.round((end - start) / 3.75));
    const spacing = (end - start) / count;
    for (let i = 0; i < count; i++) {
      const x = start + spacing * (i + 0.5);
      for (const y of [levelHeight * 0.47, levelHeight * 1.46]) {
        face(reveal, x, y, 2.15, 1.49, 0.075);
        face(frames, x, y, 1.93, 1.26, 0.10);
        face(glass, x, y, 1.78, 1.12, 0.12);
        face(frames, x, y, 0.07, 1.12, 0.145);
      }
    }
  }

  for (const [surface, pieces] of batches) {
    const merged = Mesh.MergeMeshes(pieces, true, true);
    if (!merged) continue;
    merged.name = surface.name;
    merged.material = surface;
    // The very shallow plaster overlay sits inside the shell's shadow bias.
    merged.receiveShadows = surface !== plaster;
    if (surface === plaster || surface === fin) shadows.addShadowCaster(merged);
  }

  const signTexture = new DynamicTexture("B72-nameplate", { width: 1024, height: 96 }, scene, true);
  signTexture.drawText("TRAINING AND PLACEMENT CELL", null, 67, "700 55px sans-serif", "#f7f5ef", "#262a30");
  const signMaterial = material("nameplate", "#ffffff");
  signMaterial.albedoTexture = signTexture;
  const sign = CreatePlane("B72-nameplate", {
    width: entryWidth,
    height: signHeight,
    sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  sign.position.set(entryX, signY, frontZ + 0.225);
  sign.material = signMaterial;
}
