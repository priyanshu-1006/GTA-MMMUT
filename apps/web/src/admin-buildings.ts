import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, type AnnotationPoint } from "@gta-mmmut/world-data";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";
import { applyMasonryUvs, createMasonryMaterial } from "./masonry-finishes";

type Building = (typeof campusBuildings)[number];

const adminWallColors: Readonly<Record<string, string>> = {
  B70: "#dfd3ba", B71: "#d9c8aa", B72: "#e4e1d6", B75: "#d6d6c7",
};

const wallColors = {
  low: ["#d3c3a9", "#ddd1b6", "#cdbca0"],
  standard: ["#d4c9b5", "#ddd4c2", "#cdbfa9"],
  hall: ["#d4cabb", "#dcd5c8", "#c6c1b5"],
} as const;

function toPolygon(outline: readonly AnnotationPoint[]) {
  const polygon = outline.map(annotationToWorld).map(([x, z]) => new Vector2(x, z));
  const signedArea = polygon.reduce((sum, point, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  // The extrusion builder uses consistent ring winding for wall normals.
  return signedArea < 0 ? polygon.reverse() : polygon;
}

function createBuildings(scene: Scene, shadows: ShadowGenerator, buildings: readonly Building[]) {
  const walls = {
    low: wallColors.low.map((color, index) => createMasonryMaterial(scene, `campus-low-wall-${index}`, color)),
    standard: wallColors.standard.map((color, index) => createMasonryMaterial(scene, `campus-academic-wall-${index}`, color)),
    hall: wallColors.hall.map((color, index) => createMasonryMaterial(scene, `campus-hall-wall-${index}`, color)),
  };
  const roofMaterials = {
    neutral: createMasonryMaterial(scene, "campus-neutral-roof", "#aaa596", "stone"),
    blue: createMasonryMaterial(scene, "campus-blue-roof", "#597691", "stone"),
    terracotta: createMasonryMaterial(scene, "campus-terracotta-roof", "#a76d55", "stone"),
  };
  const roofGroups: Record<Building["roofTint"], Mesh[]> = { neutral: [], blue: [], terracotta: [] };

  for (const { id, name, height, footprint, footprintStatus, holes, style, roofTint } of buildings) {
    const polygon = toPolygon(footprint);
    const courtyardPolygons = holes.map(toPolygon);
    const extrude = (name: string, depth: number) => {
      const builder = new PolygonMeshBuilder(name, polygon, scene, earcut);
      for (const courtyard of courtyardPolygons) builder.addHole(courtyard);
      return builder.build(false, depth);
    };

    const solid = extrude(id, height);
    solid.position.y = height;
    const adminColor = adminWallColors[id];
    const wall = adminColor ? createMasonryMaterial(scene, `${id}-wall`, adminColor)
      : walls[style][Number(id.slice(1)) % walls[style].length];
    solid.material = wall;
    applyMasonryUvs(solid, wall);
    solid.checkCollisions = true;
    solid.receiveShadows = true;
    solid.metadata = { name, footprintStatus };
    shadows.addShadowCaster(solid);

    const cap = extrude(`${id}-roof`, 0.18);
    cap.position.y = height + 0.18;
    applyMasonryUvs(cap, roofMaterials[roofTint]);
    roofGroups[roofTint].push(cap);

  }

  // Batch visual roof caps by tint. Walls remain separate collision volumes.
  for (const tint of ["neutral", "blue", "terracotta"] as const) {
    if (roofGroups[tint].length === 0) continue;
    const roof = Mesh.MergeMeshes(roofGroups[tint], true, true);
    if (!roof) continue;
    roof.name = `campus-${tint}-roofs`;
    roof.material = roofMaterials[tint];
    roof.receiveShadows = true;
  }
}

export function createAdminBuildings(scene: Scene, shadows: ShadowGenerator) {
  createBuildings(scene, shadows, campusBuildings.filter(({ id }) => id in adminWallColors));
}

export function createCampusBuildings(scene: Scene, shadows: ShadowGenerator) {
  const customExteriors = new Set([
    "B16", "B17", "B21", "B22", "B23", "B24", "B28", "B29", "B30", "B31", "B32", "B36", "B43",
    "B45", "B46", "B47", "B48", "B52", "B70", "B73", "B74", "B75",
  ]);
  createBuildings(scene, shadows, campusBuildings.filter(({ id }) => !customExteriors.has(id)));
}
