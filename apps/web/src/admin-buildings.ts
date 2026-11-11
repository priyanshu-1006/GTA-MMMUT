import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, type AnnotationPoint } from "@gta-mmmut/world-data";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";

type Building = (typeof campusBuildings)[number];

const adminWallColors: Readonly<Record<string, string>> = {
  B70: "#d5c6a7", B71: "#cabcaa", B72: "#d0c6b5", B75: "#b7b4a9",
};

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
  function material(name: string, color: string) {
    const result = new PBRMaterial(name, scene);
    result.albedoColor = Color3.FromHexString(color).toLinearSpace();
    result.metallic = 0;
    result.roughness = 0.9;
    return result;
  }

  const walls = {
    low: material("campus-low-wall", "#c9bea5"),
    standard: material("campus-academic-wall", "#c3baaa"),
    hall: material("campus-hall-wall", "#b6b7ae"),
  };
  const roofMaterials = {
    neutral: material("campus-neutral-roof", "#aaa596"),
    blue: material("campus-blue-roof", "#597691"),
    terracotta: material("campus-terracotta-roof", "#a76d55"),
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
    solid.material = adminColor ? material(`${id}-wall`, adminColor) : walls[style];
    solid.checkCollisions = true;
    solid.receiveShadows = true;
    solid.metadata = { name, footprintStatus };
    shadows.addShadowCaster(solid);

    const cap = extrude(`${id}-roof`, 0.18);
    cap.position.y = height + 0.18;
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
  const customExteriors = new Set(["B16", "B17", "B21", "B22", "B23", "B24", "B28", "B29", "B47", "B48", "B70", "B73", "B74", "B75"]);
  createBuildings(scene, shadows, campusBuildings.filter(({ id }) => !customExteriors.has(id)));
}
