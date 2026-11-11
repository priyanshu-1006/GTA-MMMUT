import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, type AnnotationPoint } from "@gta-mmmut/world-data";
import { campusGardens, type AnnotationRect } from "@gta-mmmut/world-data/campus-gardens";
import earcut from "earcut";

export function createCampusGardens(scene: Scene, shadows: ShadowGenerator): void {
  const batches = new Map<PBRMaterial, Mesh[]>();
  function finish(name: string, color: string) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.metallic = 0;
    material.roughness = 0.93;
    batches.set(material, []);
    return material;
  }

  const turf = finish("garden-lawn", "#637f42");
  const paths = finish("garden-paving", "#c2b298");
  const edging = finish("garden-edging", "#b8a386");
  const mulch = finish("garden-bed-soil", "#6b4c37");
  const leaves = finish("garden-leaves", "#52733d");
  const crown = finish("garden-tree-canopy", "#4e6936");
  const bark = finish("garden-tree-bark", "#735b42");
  const flowers = [
    finish("garden-gold-flowers", "#eab141"),
    finish("garden-coral-flowers", "#bf6551"),
    finish("garden-rose-flowers", "#a44d69"),
  ];
  const pavement = finish("B72-parking-pavement", "#585a58");
  const paint = finish("B72-parking-markings", "#e7e3d1");
  paint.zOffset = -1;

  function add(surface: PBRMaterial, mesh: Mesh) {
    batches.get(surface)!.push(mesh);
  }

  function rect(surface: PBRMaterial, [left, top, right, bottom]: AnnotationRect, y: number, height = 0) {
    const [x0, z0] = annotationToWorld([left, top]);
    const [x1, z1] = annotationToWorld([right, bottom]);
    const width = x1 - x0;
    const depth = z1 - z0;
    const mesh = height
      ? CreateBox(surface.name, { width, height, depth }, scene)
      : CreateGround(surface.name, { width, height: depth }, scene);
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    add(surface, mesh);
  }

  function border([left, top, right, bottom]: AnnotationRect, y: number, height: number, width: number) {
    rect(edging, [left, top, right, top + width], y, height);
    rect(edging, [left, bottom - width, right, bottom], y, height);
    rect(edging, [left, top + width, left + width, bottom - width], y, height);
    rect(edging, [right - width, top + width, right, bottom - width], y, height);
  }

  function globe(surface: PBRMaterial, at: AnnotationPoint, y: number, width: number, height: number) {
    const [x, z] = annotationToWorld(at);
    const mesh = CreateSphere(surface.name, { diameter: 1, segments: 6 }, scene);
    mesh.position.set(x, y, z);
    mesh.scaling.set(width, height, width);
    add(surface, mesh);
  }

  function flowerbed(bounds: AnnotationRect) {
    const [left, top, right, bottom] = bounds;
    rect(mulch, bounds, 0.075, 0.13);
    border(bounds, 0.08, 0.16, 0.33);
    const count = Math.ceil((right - left) / 4.3);
    for (let column = 0; column < count; column++) {
      const x = left + (right - left) * (column + 0.5) / count;
      for (const [row, ratio] of [0.28, 0.72].entries()) {
        const z = top + (bottom - top) * ratio;
        globe(leaves, [x, z], 0.24, 0.62, 0.3);
        globe(flowers[(column + row) % flowers.length], [x, z], 0.39, 0.35, 0.17);
      }
    }
  }

  function tree(at: AnnotationPoint, height: number) {
    const [x, z] = annotationToWorld(at);
    const trunk = CreateCylinder(bark.name, {
      height: height * 0.63, diameterBottom: 0.18, diameterTop: 0.13, tessellation: 8,
    }, scene);
    trunk.position.set(x, height * 0.315, z);
    add(bark, trunk);
    globe(crown, at, height * 0.74, height * 0.77, height * 0.58);
    globe(leaves, [at[0] + 1.1, at[1] - 0.55], height * 0.77, height * 0.55, height * 0.49);
  }

  const { atal, east, placementParking } = campusGardens;
  for (const path of atal.paths) rect(paths, path, 0.034);
  for (const quarter of atal.quarters) {
    const [left, top, right, bottom] = quarter;
    const north = bottom < atal.center[1];
    const bedTop = north ? bottom - 8 : top + 2;
    const treeZ = north ? top + 9 : bottom - 9;
    rect(turf, quarter, 0.028);
    border(quarter, 0.047, 0.07, 0.36);
    flowerbed([left + 4, bedTop, right - 4, bedTop + 6]);
    tree([left + 9, treeZ], 2.55);
    tree([right - 9, treeZ], 2.55);
  }

  rect(paths, east.path, 0.034);
  for (const lawn of east.lawns) {
    const [left, top, right, bottom] = lawn;
    const north = bottom < east.path[3];
    const bedTop = north ? bottom - 8 : top + 2;
    rect(turf, lawn, 0.028);
    border(lawn, 0.047, 0.07, 0.36);
    flowerbed([left + 8, bedTop, left + 43, bedTop + 6]);
    flowerbed([right - 43, bedTop, right - 8, bedTop + 6]);
    const treeZ = north ? top + 9 : bottom - 8;
    for (const x of [left + 10, (left + right) / 2, right - 10]) {
      tree([x, treeZ], 2.9);
    }
  }

  const { lot, driveway, entranceWalk, stalls } = placementParking;
  rect(pavement, lot, 0.026);
  const drivewayPolygon = driveway.map(annotationToWorld).map(([x, z]) => new Vector2(x, z));
  const drivewayMesh = new PolygonMeshBuilder("B72-parking-driveway", drivewayPolygon, scene, earcut).build(false);
  drivewayMesh.position.y = 0.026;
  add(pavement, drivewayMesh);
  rect(paths, entranceWalk, 0.034);
  const line = 0.22;
  const lastX = stalls.left + stalls.width * stalls.count;
  rect(paint, [stalls.left - line / 2, stalls.top, lastX + line / 2, stalls.top + line], 0.043);
  for (let boundary = 0; boundary <= stalls.count; boundary++) {
    const x = stalls.left + boundary * stalls.width;
    rect(paint, [x - line / 2, stalls.top, x + line / 2, stalls.top + stalls.depth], 0.043);
  }

  const [signX, signZ] = annotationToWorld([1066, 637]);
  const signPost = CreateCylinder("parking-sign-post", { height: 1.9, diameter: 0.072, tessellation: 8 }, scene);
  signPost.position.set(signX, 0.95, signZ);
  add(pavement, signPost);
  const signTexture = new DynamicTexture("parking-sign-face", { width: 128, height: 128 }, scene, true);
  signTexture.drawText("P", null, 83, "bold 83px sans-serif", "#f8f5eb", "#315d80");
  signTexture.drawText("PARKING", null, 112, "bold 18px sans-serif", "#f8f5eb", null);
  const signMaterial = new PBRMaterial("parking-sign-face", scene);
  signMaterial.albedoTexture = signTexture;
  signMaterial.unlit = true;
  const sign = CreatePlane("parking-sign", { size: 0.69, sideOrientation: Mesh.DOUBLESIDE }, scene);
  sign.position.set(signX, 1.71, signZ + 0.04);
  sign.material = signMaterial;
  sign.isPickable = false;

  for (const [material, meshes] of batches) {
    const mesh = Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    if (material === bark || material === crown || material === leaves) shadows.addShadowCaster(mesh);
  }
}
