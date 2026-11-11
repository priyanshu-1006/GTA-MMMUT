import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, southernEntranceTransform, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { coveredWalkways } from "@gta-mmmut/world-data/covered-walkways";

const clearWidth = coveredWalkways.widthPixels * southernEntranceTransform.metersPerPixel;
const postWidth = 0.28;
const slabWidth = clearWidth + 2 * postWidth;
const roofWidth = slabWidth + 0.18;
const postOffset = (clearWidth + postWidth) / 2;
const roofUnderside = 2.92;

function columnAtlas(scene: Scene) {
  const texture = new DynamicTexture("covered-walkway-column-colors", { width: 512, height: 256 }, scene, true);
  const context = texture.getContext();
  const palettes = [
    ["#d7ae53", "#487981", "#9e5745"],
    ["#467968", "#d0a14d", "#a95148"],
    ["#a25449", "#d6a957", "#5d8390"],
    ["#567f95", "#a9b977", "#be7654"],
  ];

  for (const [index, [base, accent, lower]] of palettes.entries()) {
    const x = index * 128;
    context.fillStyle = "#c8b392";
    context.fillRect(x, 0, 128, 256);
    context.fillStyle = base;
    context.fillRect(x, 57, 128, 145);
    context.fillStyle = lower;
    context.fillRect(x, 151, 128, 51);
    context.fillStyle = accent;
    for (let step = 0; step < 5; step++) {
      context.fillRect(x + step * 22, 67 + step * 12, 40, 32);
    }
    context.fillStyle = "#e7d7ac";
    context.fillRect(x + 30, 137, 66, 7);
  }
  texture.update();
  return texture;
}

export function createCoveredWalkways(scene: Scene, shadows: ShadowGenerator) {
  function finish(name: string, hex: string) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    material.metallic = 0;
    material.roughness = 0.93;
    return material;
  }

  const slab = finish("walkway-concrete", "#8f8c7f");
  const roof = finish("walkway-canopy", "#d4c8ab");
  const column = finish("walkway-painted-columns", "#ffffff");
  column.albedoTexture = columnAtlas(scene);
  const floorParts: Mesh[] = [];
  const roofParts: Mesh[] = [];
  const joints = new Map<string, { point: WorldGroundPoint; degree: number }>();
  let columnIndex = 0;

  function registerJoint(point: WorldGroundPoint) {
    const key = point.join(",");
    const joint = joints.get(key);
    if (joint) joint.degree++;
    else joints.set(key, { point, degree: 1 });
  }

  const routes = coveredWalkways.segments.map(({ id, kind, points }) => ({
    id, kind, path: points.map(annotationToWorld),
  }));
  for (const { path } of routes) {
    for (const [index, point] of path.slice(0, -1).entries()) {
      registerJoint(point);
      registerJoint(path[index + 1]);
    }
  }

  for (const { id, kind, path } of routes) {
    const columns: Mesh[] = [];
    for (const [index, [x, z]] of path.slice(0, -1).entries()) {
      const [endX, endZ] = path[index + 1];
      const dx = endX - x;
      const dz = endZ - z;
      const length = Math.hypot(dx, dz);
      if (length === 0) continue;

      const angle = -Math.atan2(dz, dx);
      const span = (name: string, width: number, thickness: number, height: number) => {
        const mesh = CreateBox(name, { width: length, height: thickness, depth: width }, scene);
        mesh.position.set((x + endX) / 2, height, (z + endZ) / 2);
        mesh.rotation.y = angle;
        return mesh;
      };
      floorParts.push(span("walkway-deck", slabWidth, 0.055, 0.013));
      roofParts.push(span("walkway-roof", roofWidth, 0.18, roofUnderside + 0.09));

      if (kind === "crossing") continue;
      const bays = Math.max(1, Math.ceil(length / 3.8));
      const startFork = (joints.get(path[index].join(","))?.degree ?? 0) > 2;
      const endFork = (joints.get(path[index + 1].join(","))?.degree ?? 0) > 2;
      const forkClearance = clearWidth / 2 + postWidth;
      for (let bay = 0; bay < bays; bay++) {
        const t = (bay + 0.5) / bays;
        if (startFork && t * length < forkClearance) continue;
        if (endFork && (1 - t) * length < forkClearance) continue;
        for (const side of [-1, 1]) {
          const tile = columnIndex++ % 4;
          const uv = new Vector4((tile + 0.015) / 4, 0.01, (tile + 0.985) / 4, 0.99);
          const post = CreateBox("walkway-post", {
            width: postWidth, height: roofUnderside, depth: postWidth, faceUV: Array.from({ length: 6 }, () => uv),
          }, scene);
          post.position.set(
            x + t * dx - side * postOffset * dz / length,
            roofUnderside / 2,
            z + t * dz + side * postOffset * dx / length,
          );
          post.rotation.y = angle;
          columns.push(post);
        }
      }
    }

    const batch = columns.length ? Mesh.MergeMeshes(columns, true, true) : null;
    if (batch) {
      batch.name = `walkway-columns-${id}`;
      batch.material = column;
      batch.checkCollisions = true;
      batch.receiveShadows = true;
      shadows.addShadowCaster(batch);
    }
  }

  // Joint covers bridge bends and forks while leaving the roof continuous.
  for (const { point: [x, z], degree } of joints.values()) {
    if (degree < 2) continue;
    const roofJoint = CreateCylinder("walkway-roof-joint", { diameter: roofWidth + 0.06, height: 0.18, tessellation: 20 }, scene);
    roofJoint.position.set(x, roofUnderside + 0.115, z);
    roofParts.push(roofJoint);
    const floorJoint = CreateCylinder("walkway-floor-joint", { diameter: slabWidth + 0.05, height: 0.055, tessellation: 20 }, scene);
    floorJoint.position.set(x, 0.024, z);
    floorParts.push(floorJoint);
  }

  const pavement = Mesh.MergeMeshes(floorParts, true, true);
  if (pavement) {
    pavement.name = "covered-walkway-pavement";
    pavement.material = slab;
    pavement.receiveShadows = true;
  }
  const canopy = Mesh.MergeMeshes(roofParts, true, true);
  if (canopy) {
    canopy.name = "continuous-walkway-canopy";
    canopy.material = roof;
    shadows.addShadowCaster(canopy);
  }
}
