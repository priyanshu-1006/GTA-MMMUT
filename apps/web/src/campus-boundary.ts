import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { campusBoundary } from "@gta-mmmut/world-data/campus-boundary";

export function createCampusBoundary(scene: Scene, shadows: ShadowGenerator): void {
  function finish(name: string, hex: string, roughness = 0.89) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    material.metallic = 0;
    material.roughness = roughness;
    return material;
  }

  const wall = finish("campus-boundary-plaster", "#c9b794");
  const coping = finish("campus-boundary-coping", "#e0d2b6");
  const base = finish("campus-boundary-base", "#9c8b6d");
  const steel = finish("old-gate-black-steel", "#252726", 0.63);
  const batches = new Map<PBRMaterial, Mesh[]>();

  function box(
    name: string, material: PBRMaterial, x: number, y: number, z: number,
    width: number, height: number, depth: number, yaw = 0, collides = false,
  ) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    if (collides) {
      mesh.material = material;
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.isPickable = false;
      shadows.addShadowCaster(mesh);
    } else {
      const batch = batches.get(material);
      if (batch) batch.push(mesh);
      else batches.set(material, [mesh]);
    }
    return mesh;
  }

  for (const run of campusBoundary.wallRuns) {
    const points = run.points.map(annotationToWorld);
    for (const [index, [ax, az]] of points.slice(0, -1).entries()) {
      const [bx, bz] = points[index + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      const x = (ax + bx) / 2;
      const z = (az + bz) / 2;
      const yaw = -Math.atan2(dz, dx);

      box(run.id, wall, x, 0.91, z, length + 0.17, 1.82, 0.34, yaw, true);
      box("boundary-footing", base, x, 0.17, z, length + 0.18, 0.34, 0.43, yaw);
      box("boundary-cap", coping, x, 1.86, z, length + 0.2, 0.13, 0.5, yaw);

      const bays = Math.max(1, Math.ceil(length / 6.5));
      for (let bay = 1; bay < bays; bay++) {
        const px = ax + dx * bay / bays;
        const pz = az + dz * bay / bays;
        box("boundary-pier", coping, px, 0.99, pz, 0.48, 1.98, 0.57, yaw);
        box("boundary-pier-cap", coping, px, 2.01, pz, 0.58, 0.13, 0.65, yaw);
      }
    }
  }

  const [[leftX, gateZ], [rightX]] = campusBoundary.oldGate.span.map(annotationToWorld);
  const gateWidth = rightX - leftX;
  const postWidth = 0.42;
  for (const x of [leftX, rightX]) {
    box("old-gate-post", steel, x, 1.11, gateZ, postWidth, 2.22, postWidth, 0, true);
    box("old-gate-post-cap", steel, x, 2.23, gateZ, 0.49, 0.14, 0.49);
  }

  // One leaf, swung inward beside the west edge. The clear middle stays open.
  const leafX = leftX + postWidth / 2;
  const leafLength = gateWidth - postWidth - 0.12;
  const hingeZ = gateZ - 0.13;
  const leafZ = hingeZ - leafLength / 2;
  for (const y of [0.22, 0.87, 2]) {
    box("old-gate-horizontal-frame", steel, leafX, y, leafZ, 0.08, 0.1, leafLength);
  }
  const bars = Math.ceil(leafLength / 0.22);
  for (let bar = 0; bar <= bars; bar++) {
    const frame = bar === 0 || bar === bars;
    const width = frame ? 0.08 : 0.035;
    box("old-gate-vertical-bar", steel, leafX, 1.11, hingeZ - leafLength * bar / bars,
      width, 1.82, width);
  }
  const braceRise = 1.73;
  const brace = box("old-gate-brace", steel, leafX, 1.11, leafZ, 0.055,
    Math.hypot(leafLength, braceRise), 0.055);
  brace.rotation.x = -Math.atan2(leafLength, braceRise);

  const leafCollider = CreateBox("old-gate-leaf-collider", {
    width: 0.12, height: 1.88, depth: leafLength,
  }, scene);
  leafCollider.position.set(leafX, 1.09, leafZ);
  leafCollider.material = steel;
  leafCollider.isVisible = false;
  leafCollider.isPickable = false;
  leafCollider.checkCollisions = true;

  for (const [material, meshes] of batches) {
    const mesh = Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    shadows.addShadowCaster(mesh);
  }
}
