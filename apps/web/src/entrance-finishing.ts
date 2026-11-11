import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, southernEntrance, type AnnotationPoint, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { atalDrivewayOpening } from "@gta-mmmut/world-data/campus-access";
import earcut from "earcut";

type Point = WorldGroundPoint;
type Opening = readonly [north: number, south: number];

// The two outer edges follow the existing traced entrance asphalt.
const westEdge: readonly AnnotationPoint[] = [
  [882, 870], [886, 849], [887, 810], [887, 751], [883, 736], [875, 717],
  [864, 700], [849, 683], [828, 670], [801, 659], [773, 653],
];
const eastEdge: readonly AnnotationPoint[] = [
  [912, 866], [909, 845], [909, 805], [909, 741], [914, 725], [926, 704],
  [939, 685], [956, 670], [980, 657], [1006, 653],
];
const lawnEdge: readonly AnnotationPoint[] = [
  [853, 650], [852, 663], [860, 672], [874, 677], [919, 677], [929, 672], [937, 660], [940, 645],
];
export const entranceSidewalkHeight = 0.21;

function offsetPath(path: readonly Point[], distance: number): Point[] {
  const normals = path.slice(1).map(([x, z], index): Point => {
    const [startX, startZ] = path[index];
    const dx = x - startX;
    const dz = z - startZ;
    const length = Math.hypot(dx, dz);
    return [-dz / length, dx / length];
  });
  return path.map(([x, z], index) => {
    const [ax, az] = normals[Math.max(0, index - 1)];
    const [bx, bz] = normals[Math.min(normals.length - 1, index)];
    const scale = distance / (1 + ax * bx + az * bz);
    return [x + (ax + bx) * scale, z + (az + bz) * scale];
  });
}

function withoutOpenings(path: readonly Point[], openings: readonly Opening[]): Point[][] {
  function pointAt(z: number): Point {
    const index = path.findIndex(([, pz]) => pz <= z);
    const end = path[index];
    if (index === 0 || end[1] === z) return end;
    const start = path[index - 1];
    const t = (z - start[1]) / (end[1] - start[1]);
    return [start[0] + (end[0] - start[0]) * t, z];
  }
  const sections: Point[][] = [];
  let start = path[0];
  for (const [north, south] of openings) {
    const between = path.filter(([, z]) => z < start[1] && z > south);
    sections.push([start, ...between, pointAt(south)]);
    start = pointAt(north);
  }
  sections.push([start, ...path.filter(([, z]) => z < start[1])]);
  return sections;
}

function pavingTexture(scene: Scene) {
  const texture = new DynamicTexture("entrance-interlocking-pavers", 256, scene, true);
  const context = texture.getContext();
  context.fillStyle = "#857b6a";
  context.fillRect(0, 0, 256, 256);
  const stone = ["#bfae99", "#cebaa3", "#b69b85", "#a98d79", "#c4a893"];
  for (let row = 0; row < 12; row++) {
    for (let column = -1; column < 8; column++) {
      const x = column * 32 + (row % 2) * 16;
      const y = Math.round(row * 256 / 12);
      context.fillStyle = stone[(column + 1 + row * (column + 7)) % stone.length];
      context.fillRect(x + 1, y + 1, 30, 19);
      context.fillStyle = "#ffffff20";
      context.fillRect(x + 1, y + 1, 30, 1);
    }
  }
  texture.update();
  return texture;
}

export function createEntranceFinishing(scene: Scene, shadows: ShadowGenerator) {
  function finish(name: string, color: string) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.metallic = 0;
    material.roughness = 0.88;
    return material;
  }
  const pavement = finish("forecourt-sidewalk", "#ffffff");
  pavement.albedoTexture = pavingTexture(scene);
  const yellow = finish("kerb-yellow", "#cfad52");
  const black = finish("kerb-charcoal", "#333536");
  const steel = finish("forecourt-railing", "#b8bebd");
  const roadsideSteel = finish("avenue-green-railings", "#5d7145");
  const paint = finish("entrance-edge-paint", "#e9e5d6");
  const pavilion = finish("forecourt-pavilion", "#e2dbc5");
  const pot = finish("entrance-planter-rose", "#a14358");
  const soil = finish("entrance-planter-soil", "#493d2b");
  const foliage = finish("entrance-planter-leaves", "#627e40");
  const flower = finish("entrance-planter-flowers", "#e6a847");
  const flagPole = finish("entrance-flag-pole", "#908a73");
  const flags = ["#f18c37", "#f1eee0", "#73a447"].map((hex, index) => {
    const material = finish(`avenue-flag-${index}`, hex);
    material.backFaceCulling = false;
    return material;
  });
  const curbParts = new Map<PBRMaterial, Mesh[]>([[yellow, []], [black, []]]);
  const decor = new Map<PBRMaterial, Mesh[]>();
  const sidewalks: Point[][] = [];

  function collect(material: PBRMaterial, mesh: Mesh) {
    const parts = decor.get(material) ?? [];
    parts.push(mesh);
    decor.set(material, parts);
  }

  function slab(name: string, outline: readonly Point[], material: PBRMaterial, top: number, depth = 0) {
    const area = outline.reduce((sum, [x, z], index) => {
      const [nextX, nextZ] = outline[(index + 1) % outline.length];
      return sum + x * nextZ - nextX * z;
    }, 0);
    const points = (area >= 0 ? outline : [...outline].reverse()).map(([x, z]) => new Vector2(x, z));
    const mesh = new PolygonMeshBuilder(name, points, scene, earcut).build(false, depth);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (material.albedoTexture && positions) {
      const uv: number[] = [];
      for (let index = 0; index < positions.length; index += 3) {
        uv.push(positions[index] / 1.65, positions[index + 2] / 1.38);
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uv);
    }
    mesh.position.y = top;
    mesh.material = material;
    mesh.receiveShadows = true;
  }

  function bar(name: string, from: Vector3, to: Vector3, thickness: number) {
    const delta = to.subtract(from);
    const mesh = CreateBox(name, { width: thickness, height: delta.length(), depth: thickness }, scene);
    mesh.position.copyFrom(from.add(to).scale(0.5));
    mesh.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), mesh.rotationQuaternion);
    return mesh;
  }

  function stripedKerb(path: readonly Point[], ground: number, height = 0.135) {
    let stripe = 0;
    for (let index = 1; index < path.length; index++) {
      const [x, z] = path[index - 1];
      const [endX, endZ] = path[index];
      const dx = endX - x;
      const dz = endZ - z;
      const length = Math.hypot(dx, dz);
      const stripes = Math.max(1, Math.round(length / 0.7));
      for (let i = 0; i < stripes; i++) {
        const material = stripe++ % 2 ? black : yellow;
        const kerb = CreateBox(material.name, { width: length / stripes + 0.012, height, depth: 0.22 }, scene);
        const t = (i + 0.5) / stripes;
        kerb.position.set(x + t * dx, ground + height / 2, z + t * dz);
        kerb.rotation.y = -Math.atan2(dz, dx);
        curbParts.get(material)!.push(kerb);
      }
    }
  }

  function railings(path: readonly Point[], ground: number, name: string, material = steel) {
    const parts: Mesh[] = [];
    for (let index = 1; index < path.length; index++) {
      const [x, z] = path[index - 1];
      const [endX, endZ] = path[index];
      const length = Math.hypot(endX - x, endZ - z);
      const bays = Math.max(1, Math.ceil(length / 1.12));
      const at = (t: number, y: number) => new Vector3(x + (endX - x) * t, ground + y, z + (endZ - z) * t);
      for (const height of [0.14, 0.92]) parts.push(bar(name, at(0, height), at(1, height), 0.052));
      for (let bay = 0; bay < bays; bay++) {
        const left = bay / bays;
        const right = (bay + 1) / bays;
        const middle = (left + right) / 2;
        parts.push(bar(name, at(left, 0), at(left, 0.95), 0.065));
        for (const t of [left + (right - left) * 0.25, left + (right - left) * 0.75]) {
          parts.push(bar(name, at(t, 0.15), at(t, 0.91), 0.031));
        }
        if (material === steel) {
          const diamond = [at(left + 0.04 / length, 0.52), at(middle, 0.82),
            at(right - 0.04 / length, 0.52), at(middle, 0.23)];
          for (let edge = 0; edge < diamond.length; edge++) {
            parts.push(bar(name, diamond[edge], diamond[(edge + 1) % diamond.length], 0.034));
          }
        }
      }
      if (index === path.length - 1) parts.push(bar(name, at(1, 0), at(1, 0.95), 0.065));
    }
    const fence = Mesh.MergeMeshes(parts, true, true);
    if (fence) {
      fence.name = name;
      fence.material = material;
      fence.checkCollisions = true;
      fence.receiveShadows = true;
      shadows.addShadowCaster(fence);
    }
  }

  function avenueDetails(path: readonly Point[], side: number, openings: readonly Opening[]) {
    let travelled = 0;
    let next = 4;
    let index = 0;
    for (const [[x, z], [endX, endZ]] of path.slice(1).map((point, i) => [path[i], point] as const)) {
      const dx = endX - x;
      const dz = endZ - z;
      const length = Math.hypot(dx, dz);
      for (; next < travelled + length; next += 5.8) {
        const t = (next - travelled) / length;
        const px = x + dx * t;
        const pz = z + dz * t;
        if (openings.some(([north, south]) => pz >= north - 0.45 && pz <= south + 0.45)) continue;
        const planter = CreateCylinder("avenue-flower-pot", {
          diameterTop: 0.63, diameterBottom: 0.43, height: 0.47, tessellation: 12,
        }, scene);
        planter.position.set(px, entranceSidewalkHeight + 0.235, pz);
        collect(pot, planter);
        const rim = CreateCylinder("planter-soil", { diameter: 0.57, height: 0.025, tessellation: 12 }, scene);
        rim.position.set(px, entranceSidewalkHeight + 0.477, pz);
        collect(soil, rim);
        for (let bloom = 0; bloom < 4; bloom++) {
          const angle = 1.57 * bloom + index;
          const xOffset = 0.19 * Math.cos(angle);
          const zOffset = 0.19 * Math.sin(angle);
          const leaf = CreateSphere("planter-foliage", { diameter: 0.3, segments: 5 }, scene);
          leaf.position.set(px + xOffset, entranceSidewalkHeight + 0.55, pz + zOffset);
          collect(foliage, leaf);
          const petal = CreateSphere("planter-bloom", { diameter: 0.105, segments: 4 }, scene);
          petal.position.set(px + xOffset, entranceSidewalkHeight + 0.68, pz + zOffset);
          petal.scaling.y = 0.63;
          collect(flower, petal);
        }

        if (index % 2 === 0) {
          const xPole = px - side * dz / length * 0.61;
          const zPole = pz + side * dx / length * 0.61;
          const pole = CreateCylinder("avenue-flag-pole", { diameter: 0.042, height: 2.38, tessellation: 6 }, scene);
          pole.position.set(xPole, entranceSidewalkHeight + 1.19, zPole);
          collect(flagPole, pole);
          const pennant = new PolygonMeshBuilder("avenue-flag", [
            new Vector2(0, 0), new Vector2(0.83, -0.03), new Vector2(0.69, 0.26), new Vector2(0, 0.42),
          ], scene, earcut).build(false);
          pennant.rotation.x = -Math.PI / 2;
          pennant.rotation.y = index * 0.16 + side * 0.26;
          pennant.position.set(xPole, entranceSidewalkHeight + 1.96, zPole);
          collect(flags[(index / 2 + Number(side > 0)) % flags.length], pennant);
        }
        index++;
      }
      travelled += length;
    }
  }

  for (const [source, side, name] of [[westEdge, -1, "west"], [eastEdge, 1, "east"]] as const) {
    const edge = source.map(annotationToWorld);
    const driveway: readonly Opening[] = side < 0
      ? [[annotationToWorld(atalDrivewayOpening[0])[1], annotationToWorld(atalDrivewayOpening[1])[1]]]
      : [];
    for (const [index, section] of withoutOpenings(edge, driveway).entries()) {
      const sidewalkOutside = offsetPath(section, side * 2.35);
      const outline = [...section, ...sidewalkOutside.reverse()];
      sidewalks.push(outline);
      slab(`entrance-sidewalk-${name}-${index}`, outline, pavement, entranceSidewalkHeight, 0.22);
      stripedKerb(offsetPath(section, side * 0.105), 0.025, 0.205);
      const lineInner = offsetPath(section, -side * 0.2);
      const lineOuter = offsetPath(section, -side * 0.31);
      slab(`entrance-edge-line-${name}-${index}`, [...lineInner, ...lineOuter.reverse()], paint, 0.043);
    }
    const opening = annotationToWorld([900, side < 0 ? 746 : 770])[1];
    // Widen the outside railing gap to follow the splayed driveway mouth.
    const gaps: Opening[] = [...driveway.map(([north, south]): Opening => [north - 0.6, south + 0.6]),
      [opening - 1.7, opening + 1.7]];
    for (const [index, section] of withoutOpenings(offsetPath(edge, side * 2.41), gaps).entries()) {
      railings(section, 0.035, `avenue-rail-${name}-${index}`, roadsideSteel);
    }
    avenueDetails(offsetPath(edge, side * 1.66), side, gaps);
  }

  const island = southernEntrance.splitterIsland.outline.map(annotationToWorld);
  const centreX = island.reduce((sum, [x]) => sum + x, 0) / island.length;
  const centreZ = island.reduce((sum, [, z]) => sum + z, 0) / island.length;
  const railRing = island.map(([x, z]): Point => [centreX + (x - centreX) * 0.91, centreZ + (z - centreZ) * 0.91]);
  stripedKerb([...island, island[0]], 0.13);
  railings([...railRing, railRing[0]], 0.235, "splitter-island-railings");

  const garden = lawnEdge.map(annotationToWorld);
  stripedKerb(offsetPath(garden, -0.11), 0.032);
  railings(offsetPath(garden, -0.62), 0.06, "administration-garden-railings");

  for (const [material, parts] of curbParts) {
    const mesh = Mesh.MergeMeshes(parts, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
  }
  for (const [material, parts] of decor) {
    const mesh = Mesh.MergeMeshes(parts, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
  }

  // The aerial's round forecourt feature and the supplied photos support a
  // freestanding pavilion, separate from the Administration Building.
  const [x, z] = annotationToWorld([899, 647]);
  const [, pathStart] = annotationToWorld([899, 611]);
  slab("administration-forecourt-path", [[x - 1.08, pathStart], [x + 1.08, pathStart],
    [x + 1.08, z], [x - 1.08, z]], pavement, 0.048, 0.055);
  function pillar(name: string, xPos: number, y: number, zPos: number, height: number, diameter: number) {
    const mesh = CreateCylinder(name, { height, diameter, tessellation: 24 }, scene);
    mesh.position.set(xPos, y, zPos);
    mesh.material = pavilion;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
    return mesh;
  }
  pillar("pavilion-plinth", x, 0.13, z, 0.26, 5.05);
  pillar("pavilion-eave", x, 3.22, z, 0.24, 4.6);
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * 2 * Math.PI;
    const column = pillar("pavilion-column", x + Math.cos(angle) * 1.77, 1.66, z + Math.sin(angle) * 1.77, 2.8, 0.23);
    column.checkCollisions = true;
  }
  const dome = CreateSphere("forecourt-pavilion-dome", { diameter: 4.4, slice: 0.5, segments: 24 }, scene);
  dome.position.set(x, 3.34, z);
  dome.scaling.y = 0.68;
  dome.material = pavilion;
  shadows.addShadowCaster(dome);
  return sidewalks;
}
