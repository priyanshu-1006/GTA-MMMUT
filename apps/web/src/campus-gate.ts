import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, southernEntrance } from "@gta-mmmut/world-data";

type Point = readonly [x: number, y: number, z: number];

export function createCampusGate(scene: Scene, shadows: ShadowGenerator): void {
  const [[ax, az], [bx, bz]] = southernEntrance.gate.span.map(annotationToWorld);
  const span = Math.hypot(bx - ax, bz - az);
  const half = span / 2;
  const dx = (bx - ax) / span;
  const dz = (bz - az) / span;
  const yaw = -Math.atan2(dz, dx);
  const point = ([x, y, z]: Point) =>
    new Vector3((ax + bx) / 2 + x * dx - z * dz, y, (az + bz) / 2 + x * dz + z * dx);

  const pieces = new Map<PBRMaterial, Mesh[]>();
  function finish(name: string, color: string, roughness: number) {
    const material = new PBRMaterial(`gate-${name}`, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.metallic = 0;
    material.roughness = roughness;
    pieces.set(material, []);
    return material;
  }

  const stone = finish("cream-stone", "#e2d0ad", 0.91);
  const gold = finish("gold-tower", "#d8a036", 0.6);
  const seam = finish("bronze-seam", "#8b5b26", 0.67);
  const lanternGlass = finish("lantern-glass", "#f3dcab", 0.37);
  const blue = finish("blue-steel", "#22516b", 0.63);
  const roof = finish("blue-canopy", "#416f83", 0.76);
  const iron = finish("dark-iron", "#322f2b", 0.7);

  function box(material: PBRMaterial, at: Point, width: number, height: number, depth: number, angle = yaw) {
    const mesh = CreateBox(material.name, { width, height, depth }, scene);
    mesh.position.copyFrom(point(at));
    mesh.rotation.y = angle;
    pieces.get(material)!.push(mesh);
  }

  function cylinder(
    material: PBRMaterial, at: Point, height: number,
    diameterBottom: number, diameterTop = diameterBottom, tessellation = 24,
  ) {
    const mesh = CreateCylinder(material.name, { height, diameterBottom, diameterTop, tessellation }, scene);
    mesh.position.copyFrom(point(at));
    mesh.rotation.y = yaw;
    pieces.get(material)!.push(mesh);
  }

  function rail(material: PBRMaterial, from: Point, to: Point, thickness: number) {
    const start = point(from);
    const end = point(to);
    const vector = end.subtract(start);
    const mesh = CreateBox(material.name, { width: thickness, height: vector.length(), depth: thickness }, scene);
    mesh.position.copyFrom(start.add(end).scale(0.5));
    mesh.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), vector.normalize(), mesh.rotationQuaternion);
    pieces.get(material)!.push(mesh);
  }

  function collider(name: string, at: Point, width: number, height: number, depth: number) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.copyFrom(point(at));
    mesh.rotation.y = yaw;
    mesh.material = stone;
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.checkCollisions = true;
  }

  function tower(x: number) {
    box(stone, [x, 0.26, 0], 1.35, 0.52, 1.35);
    box(stone, [x, 0.55, 0], 1.48, 0.14, 1.48);
    box(seam, [x, 0.27, 0.679], 0.77, 0.35, 0.025);
    box(iron, [x, 0.27, 0.697], 0.7, 0.29, 0.026);

    // Keep the original post and plinth collision positions and extents.
    collider("gate-pillar-collider", [x, 2.625, 0], 0.96, 5.25, 0.96);
    collider("gate-plinth-collider", [x, 0.26, 0], 1.35, 0.52, 1.35);

    const bandCount = 8;
    const base = 0.62;
    const bandHeight = 0.815;
    const diameter = (fraction: number) => 1.05 + 0.4 * fraction + 0.59 * fraction * fraction;
    for (let index = 0; index < bandCount; index++) {
      const y = base + index * bandHeight;
      const lower = diameter(index / bandCount);
      const upper = diameter((index + 1) / bandCount);
      cylinder(gold, [x, y + bandHeight / 2, 0], bandHeight, lower, upper);
      cylinder(seam, [x, y + 0.015, 0], 0.037, lower + 0.03);
    }

    const lanternBase = base + bandCount * bandHeight;
    cylinder(stone, [x, lanternBase + 0.15, 0], 0.3, 1.23, 1.04);
    cylinder(gold, [x, lanternBase + 0.73, 0], 0.86, 1.04, 1.04, 8);
    for (let index = 0; index < 8; index++) {
      const angle = (index + 0.5) * Math.PI / 4;
      box(lanternGlass, [x + 0.49 * Math.sin(angle), lanternBase + 0.74, 0.49 * Math.cos(angle)],
        0.23, 0.59, 0.035, yaw + angle);
    }
    cylinder(seam, [x, lanternBase + 1.27, 0], 0.29, 1.39, 0.65, 16);
    cylinder(gold, [x, lanternBase + 1.46, 0], 0.14, 0.54, 0.54, 16);
  }

  function gateLeaf(side: -1 | 1) {
    // Hinges stay near the posts. The open leaves recede into campus.
    const hinge = side * (half - 0.62);
    const length = span * 0.42;
    const top = (t: number) => 2.12 + 1.41 * t * t;
    const at = (t: number, level: number): Point => [
      hinge - side * length * 0.22 * t,
      0.16 + (top(t) - 0.16) * level,
      -0.34 - length * 0.975 * t,
    ];
    const bays = 6;
    const rows = 3;
    for (let bay = 0; bay <= bays; bay++) {
      const t = bay / bays;
      rail(iron, at(t, 0), at(t, 1), bay === 0 || bay === bays ? 0.1 : 0.055);
      if (bay === bays) break;

      const next = (bay + 1) / bays;
      rail(iron, at(t, 1), at(next, 1), 0.09);
      for (let row = 0; row < rows; row++) {
        const low = row / rows;
        const high = (row + 1) / rows;
        rail(iron, at(t, low), at(next, low), row === 0 ? 0.09 : 0.053);
        rail(iron, at(t, low), at(next, high), 0.035);
        rail(iron, at(t, high), at(next, low), 0.035);
        box(gold, at((t + next) / 2, (low + high) / 2), 0.09, 0.09, 0.09);
      }
    }
  }

  for (const side of [-1, 1] as const) {
    tower(side * half);
    gateLeaf(side);
  }

  const trussDepth = 3.05;
  const lowerRail = 6.36;
  const upperRail = 7.02;
  const bays = 10;
  box(roof, [0, 7.14, 0], span + 0.48, 0.17, trussDepth + 0.22);
  for (const z of [-trussDepth / 2, 0, trussDepth / 2]) {
    box(blue, [0, lowerRail, z], span + 0.4, 0.14, 0.13);
    box(blue, [0, upperRail, z], span + 0.4, 0.14, 0.13);
    for (let bay = 0; bay < bays; bay++) {
      const x = -half + bay * span / bays;
      const next = x + span / bays;
      const peak = (x + next) / 2;
      rail(blue, [x, lowerRail, z], [peak, upperRail, z], 0.095);
      rail(blue, [peak, upperRail, z], [next, lowerRail, z], 0.095);
    }
  }
  for (let bay = 0; bay <= bays; bay++) {
    box(blue, [-half + bay * span / bays, lowerRail, 0], 0.09, 0.11, trussDepth);
  }

  const plaqueY = 5.74;
  const plaqueZ = 1.48;
  const plaqueWidth = span - 0.75;
  const plaqueHeight = 1.17;
  box(iron, [0, plaqueY, plaqueZ], plaqueWidth, plaqueHeight, 0.2);

  for (const [material, meshes] of pieces) {
    const mesh = Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    shadows.addShadowCaster(mesh);
  }

  const texture = new DynamicTexture("gate-bilingual-plaque", { width: 2048, height: 168 }, scene, true);
  const context = texture.getContext();
  context.fillStyle = "#4c4539";
  context.fillRect(0, 0, 2048, 168);
  context.fillStyle = "#f1e2c5";
  const names = [
    { text: "मदन मोहन मालवीय प्रौद्योगिकी विश्वविद्यालय, गोरखपुर", font: 'bold 60px "Nirmala UI", sans-serif', y: 67 },
    { text: "Madan Mohan Malaviya University of Technology, Gorakhpur", font: 'bold 61px "Segoe UI", sans-serif', y: 140 },
  ];
  for (const { text, font, y } of names) {
    context.font = font;
    const width = Math.min(context.measureText(text).width, 1940);
    context.fillText(text, (2048 - width) / 2, y, 1940);
  }
  texture.update();

  const lettering = new PBRMaterial("gate-bilingual-lettering", scene);
  lettering.albedoTexture = texture;
  lettering.unlit = true;
  const plaque = CreatePlane("gate-bilingual-plaque", {
    width: plaqueWidth - 0.06, height: plaqueHeight - 0.05, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  plaque.position.copyFrom(point([0, plaqueY, plaqueZ + 0.106]));
  plaque.rotation.y = yaw;
  plaque.material = lettering;
  plaque.isPickable = false;
}
