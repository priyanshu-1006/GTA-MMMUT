import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, southernEntrance, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusAccess } from "@gta-mmmut/world-data/campus-access";
import { campusBoundary } from "@gta-mmmut/world-data/campus-boundary";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import { campusGardens } from "@gta-mmmut/world-data/campus-gardens";
import { campusRoads } from "@gta-mmmut/world-data/campus-roads";

type Point = WorldGroundPoint;
type Polygon = readonly Point[];
const asphaltUrl = new URL("./assets/materials/worn-asphalt.webp", import.meta.url).href;
const normalUrl = new URL("./assets/materials/worn-asphalt-normal.webp", import.meta.url).href;

function finish(scene: Scene, name: string, color: string) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = Color3.FromHexString(color).toLinearSpace();
  material.metallic = 0;
  material.roughness = 0.94;
  return material;
}

export function createCampusRoadAsphalt(scene: Scene) {
  const asphalt = finish(scene, "campus-worn-asphalt", "#f1f1f1");
  const albedo = new Texture(asphaltUrl, scene);
  albedo.anisotropicFilteringLevel = 8;
  const normal = new Texture(normalUrl, scene);
  normal.gammaSpace = false;
  normal.anisotropicFilteringLevel = 8;
  normal.level = 0.45;
  asphalt.albedoTexture = albedo;
  asphalt.bumpTexture = normal;
  return asphalt;
}

function contains(outline: Polygon, [x, z]: Point) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [ax, az] = outline[previous];
    const [bx, bz] = outline[index];
    if ((az > z) !== (bz > z) && x < ax + ((bx - ax) * (z - az)) / (bz - az)) inside = !inside;
  }
  return inside;
}

function atOffset([x, z]: Point, [nx, nz]: Point, offset: number): Point {
  return [x + nx * offset, z + nz * offset];
}

function segments(points: Polygon) {
  return points.slice(1).flatMap((end, index) => {
    const start = points[index];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return [];
    return [{ start, end, length, tangent: [dx / length, dz / length] as Point, normal: [-dz / length, dx / length] as Point }];
  });
}

const networkCenterlines = [...southernEntrance.centerlines, ...campusRoads.centerlines];
const roadPaths = [
  ...networkCenterlines,
  ...campusAccess.roads.map(({ id, centerline }) => ({ id, points: centerline })),
  { id: "old-gate-approach", points: [campusBoundary.oldGate.position, [529, 905]] as const },
];

export function createCampusRoadFinishing(scene: Scene, shadows: ShadowGenerator, roadOutlines: readonly Polygon[]) {
  const island = southernEntrance.splitterIsland.outline.map(annotationToWorld);
  const { driveway, lot: [left, top, right, bottom] } = campusGardens.placementParking;
  const lotOutline = ([[left, top], [right, top], [right, bottom], [left, bottom]] as const).map(annotationToWorld);
  const edges = [...roadOutlines, driveway.map(annotationToWorld)];
  const paved = [...edges, lotOutline];
  const onRoad = (point: Point) => !contains(island, point) && paved.some((polygon) => contains(polygon, point));
  const exits = ([[529, 6], [1538, 38], [898, 895], [529, 905]] as const).map(annotationToWorld);

  const paint = finish(scene, "campus-white-road-paint", "#efefeb");
  paint.backFaceCulling = false;
  paint.zOffset = -1;
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  function stripe(start: Point, end: Point, normal: Point, width: number) {
    const index = positions.length / 3;
    for (const [x, z] of [atOffset(start, normal, -width / 2), atOffset(start, normal, width / 2),
      atOffset(end, normal, width / 2), atOffset(end, normal, -width / 2)]) {
      positions.push(x, 0.04, z);
      normals.push(0, 1, 0);
    }
    indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
  }

  // Sample across the boundary to keep paint continuous on the verges and off
  // the shared seams where another road or driveway meets the same polygon.
  function edgeLines(outline: Polygon, hole = false) {
    const ring = [...outline, outline[0]];
    const edges = segments(ring);
    const signedArea = edges.reduce((area, { start: [x, z], end: [ex, ez] }) => area + x * ez - ex * z, 0);
    const sign = (signedArea > 0 ? 1 : -1) * (hole ? -1 : 1);
    const inward = edges.map(({ normal: [nx, nz] }): Point => [sign * nx, sign * nz]);
    function atCorner(point: Point, index: number) {
      const [ax, az] = inward[(index + edges.length - 1) % edges.length];
      const [bx, bz] = inward[index % edges.length];
      return atOffset(point, [ax + bx, az + bz], 0.34 / Math.max(0.55, 1 + ax * bx + az * bz));
    }
    for (const [index, { start, end, tangent, length }] of edges.entries()) {
      const normal = inward[index];
      const steps = Math.ceil(length / 1.15);
      for (let step = 0; step < steps; step++) {
        const sample = atOffset(start, tangent, length * (step + 0.5) / steps);
        if (onRoad(atOffset(sample, normal, -0.24)) || !onRoad(atOffset(sample, normal, 0.34))) continue;
        if (exits.some(([x, z]) => Math.hypot(sample[0] - x, sample[1] - z) < 2.6)) continue;
        const from = step === 0 ? atCorner(start, index) : atOffset(atOffset(start, tangent, length * step / steps), normal, 0.34);
        const to = step + 1 === steps ? atCorner(end, index + 1) : atOffset(atOffset(start, tangent, length * (step + 1) / steps), normal, 0.34);
        stripe(from, to, normal, 0.125);
      }
    }
  }

  for (const outline of edges) edgeLines(outline);
  edgeLines(island, true);

  for (const { id, points } of roadPaths) {
    if (id.startsWith("splitter-")) continue; // Each branch carries a single lane.
    const path = segments(points.map(annotationToWorld));
    const total = path.reduce((sum, segment) => sum + segment.length, 0);
    let travelled = 0;
    let next = 3.8;
    for (const { start, tangent, normal, length } of path) {
      for (; next <= Math.min(total - 3.8, travelled + length); next += 7.2) {
        const center = atOffset(start, tangent, next - travelled);
        // Narrow single-car branches keep the edge lines and clear driving width.
        if (!onRoad(center) || ![-1.93, 1.93].every((side) => onRoad(atOffset(center, normal, side)))) continue;
        const from = atOffset(center, tangent, -1.52);
        const to = atOffset(center, tangent, 1.52);
        if (onRoad(from) && onRoad(to)) stripe(from, to, normal, 0.15);
      }
      travelled += length;
    }
  }

  for (const { span } of southernEntrance.crosswalks) {
    const [{ start, length, tangent, normal }] = segments(span.map(annotationToWorld));
    const count = Math.max(1, Math.round(length / 1.15));
    for (let index = 0; index < count; index++) {
      const point = atOffset(start, tangent, length * (index + 0.5) / count);
      stripe(atOffset(point, normal, -2.05), atOffset(point, normal, 2.05), tangent, length / count * 0.54);
    }
  }

  const markings = new Mesh("campus-lane-and-edge-markings", scene);
  const geometry = new VertexData();
  geometry.positions = positions;
  geometry.indices = indices;
  geometry.normals = normals;
  geometry.applyToMesh(markings);
  markings.material = paint;
  markings.isPickable = false;
  markings.receiveShadows = true;
  markings.freezeWorldMatrix();

  plantVcHouseRoad(scene, shadows, onRoad);
}

function plantVcHouseRoad(scene: Scene, shadows: ShadowGenerator, onRoad: (point: Point) => boolean) {
  const westRoute = networkCenterlines.filter(({ id }) => id.startsWith("west-spine") && id !== "west-spine-north-end")
    .flatMap(({ points }) => points)
    .sort(([, a], [, b]) => a - b)
    .filter((point, index, points) => index === 0 || point[1] !== points[index - 1][1]);
  const buildings = campusBuildings.map(({ footprint }) => footprint.map(annotationToWorld));
  const gaps = ([[529, 891], [529, 315], [530, 650]] as const).map(annotationToWorld);
  const matrices: number[][] = [[], [], []];
  const rotation = Quaternion.Identity();
  const scale = new Vector3();
  const position = new Vector3();
  const transform = Matrix.Identity();
  let travelled = 0;
  let next = 7;
  let index = 0;

  for (const { start, tangent, normal, length } of segments(westRoute.map(annotationToWorld))) {
    Quaternion.RotationYawPitchRollToRef(Math.atan2(tangent[0], tangent[1]), 0, 0, rotation);
    for (; next < travelled + length; next += 2.6, index++) {
      const center = atOffset(start, tangent, next - travelled);
      if (gaps.some(([x, z]) => Math.hypot(x - center[0], z - center[1]) < 4.4)) continue;
      for (const side of [-1, 1]) {
        const verge = atOffset(center, normal, side * 7.3);
        if ([0, -1.48].some((inset) => onRoad(atOffset(verge, normal, side * inset)))) continue;
        if (buildings.some((outline) => contains(outline, verge))) continue;
        const size = 0.88 + (index % 5) * 0.055;
        for (const [lobe, along, height, width, tall, deep] of [
          [0, 0, 0.48, 1.62, 0.98, 2.7], [1, -0.55, 0.74, 1.42, 0.83, 1.51], [2, 0.59, 0.65, 1.49, 0.75, 1.48],
        ]) {
          const [x, z] = atOffset(verge, tangent, along);
          scale.set(width * size, tall * size, deep * size);
          position.set(x, height * size, z);
          Matrix.ComposeToRef(scale, rotation, position, transform);
          matrices[(index + lobe) % matrices.length].push(...transform.asArray());
        }
      }
    }
    travelled += length;
  }

  const leaves = typeof document === "undefined" ? undefined : shrubLeaves(scene);
  for (const [index, color] of ["#527337", "#6b8a48", "#78964f"].entries()) {
    if (!matrices[index].length) continue;
    const mesh = CreateSphere(`vc-house-road-bushes-${index + 1}`, { diameter: 1, segments: 6 }, scene);
    const foliage = finish(scene, `vc-house-road-leaves-${index + 1}`, color);
    if (leaves) foliage.albedoTexture = leaves;
    mesh.material = foliage;
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(matrices[index]), 16, true);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
  }
}

function shrubLeaves(scene: Scene) {
  const size = 128;
  const texture = new DynamicTexture("vc-house-road-foliage", size, scene, true);
  const context = texture.getContext();
  context.fillStyle = "#a1a991";
  context.fillRect(0, 0, size, size);
  let seed = 43;
  function sample() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }
  for (let index = 0; index < 235; index++) {
    const x = sample() * size;
    const y = sample() * size;
    const angle = sample() * Math.PI;
    const radius = 2.2 + sample() * 3;
    const value = Math.round(157 + sample() * 97);
    context.fillStyle = `rgb(${value}, ${Math.min(255, value + 4)}, ${value - 11})`;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (x + dx < -radius || x + dx > size + radius || y + dy < -radius || y + dy > size + radius) continue;
        context.save();
        context.translate(x + dx, y + dy);
        context.rotate(angle);
        context.scale(1, 0.48);
        context.beginPath();
        context.arc(0, 0, radius, 0, 2 * Math.PI);
        context.fill();
        context.restore();
      }
    }
  }
  texture.update();
  return texture;
}
