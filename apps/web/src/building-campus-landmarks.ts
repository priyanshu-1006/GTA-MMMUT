import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { itCampusSplitRow } from "@gta-mmmut/world-data/campus-access";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";
import { academicFrontages, lectureEntranceWidth } from "./academic-frontages";
import { applyMasonryUvs, createMasonryMaterial } from "./masonry-finishes";
import { courtGalleries, insetCourt, nalandaCampusDeckY, nalandaCampusFloor, nalandaCampusGarden,
  nalandaCampusGardenY, nalandaCampusGalleries, nalandaCampusStairs, nalandaEntranceRamp,
  nalandaGalleryHeadroom, nalandaGalleryRise, takshashilaGalleryWidth } from "./lecture-courtyards";

type Point = readonly [x: number, z: number];
type Rect = readonly [west: number, north: number, east: number, south: number];

function bounds(outline: readonly Point[]): Rect {
  const xs = outline.map(([x]) => x);
  const zs = outline.map(([, z]) => z);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

function clip(outline: readonly Point[], [west, north, east, south]: Rect): Point[] {
  let result = [...outline];
  const limits = [[0, west, 1], [0, east, -1], [1, north, 1], [1, south, -1]] as const;
  for (const [axis, edge, sign] of limits) {
    result = result.flatMap((end, index) => {
      const start = result[(index + result.length - 1) % result.length];
      const startInside = (start[axis] - edge) * sign >= 0;
      const endInside = (end[axis] - edge) * sign >= 0;
      if (startInside === endInside) return endInside ? [end] : [];
      const t = (edge - start[axis]) / (end[axis] - start[axis]);
      const intersection: Point = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
      return endInside ? [intersection, end] : [intersection];
    });
  }
  return result.filter(([x, z], index) => {
    const previous = result[(index + result.length - 1) % result.length];
    return Math.hypot(previous[0] - x, previous[1] - z) > 0.001;
  });
}

export function createCampusLandmarks(scene: Scene, shadows: ShadowGenerator): void {
  const batches = new Map<PBRMaterial, Mesh[]>();
  function material(name: string, color: string, roughness = 0.92, masonry?: "plaster" | "concrete" | "stone") {
    const finish = masonry ? createMasonryMaterial(scene, name, color, masonry) : new PBRMaterial(name, scene);
    finish.albedoColor = Color3.FromHexString(color).toLinearSpace();
    finish.roughness = roughness;
    finish.metallic = 0;
    batches.set(finish, []);
    return finish;
  }

  const cream = material("landmark-pale-plaster", "#e3ded2", 0.92, "plaster");
  const glass = material("landmark-glazing", "#3b4a4e", 0.41);
  const frame = material("landmark-window-frame", "#b0aa9a");
  const steps = material("landmark-dark-steps", "#3b3834");
  const paving = material("landmark-entry-paving", "#b5aa91", 0.93, "stone");
  const orange = material("cafeteria-orange-trim", "#c47743");
  const tile = material("cafeteria-terracotta-hip-roofs", "#a26556");
  const ridge = material("cafeteria-roof-crest", "#74493d");
  const benchRed = material("cafeteria-painted-seat-base", "#a34743");
  const benchGold = material("cafeteria-painted-seat-top", "#d3ac56");
  const resourceCream = material("itrc-cream-plaster", "#e4d8cf", 0.92, "plaster");
  const resourceRed = material("itrc-maroon-bands", "#81463f", 0.92, "plaster");
  const resourceGlazing = material("itrc-window-glazing", "#59696b", 0.5);
  const blueRoof = material("lecture-hall-blue-roof", "#597891", 0.91, "plaster");
  const lectureBand = material("lecture-hall-stone-bands", "#b8b09e", 0.92, "stone");
  const galleryRoof = material("lecture-gallery-flat-roof", "#d5c9ae", 0.91, "plaster");
  const galleryPaving = material("lecture-gallery-pavement", "#a49e90", 0.93, "stone");
  const courtGrass = material("nalanda-courtyard-lawn", "#7e985d");
  const shrub = [material("nalanda-garden-hedge", "#4f7042"), material("nalanda-garden-foliage", "#5c804c")];
  const flowers = [material("nalanda-garden-marigolds", "#ca9a41"), material("nalanda-garden-roses", "#a9504c")];
  const iron = material("lecture-gallery-ironwork", "#384445");
  const galleryPaint = [material("gallery-ochre-post", "#ad8550"), material("gallery-green-post", "#598276"),
    material("gallery-red-post", "#a45649")];
  tile.backFaceCulling = false;
  const roofTexture = new DynamicTexture("cafeteria-procedural-ribbed-roof", { width: 256, height: 64 }, scene, true);
  const roofContext = roofTexture.getContext();
  roofContext.fillStyle = "#a66a59";
  roofContext.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 5) {
    roofContext.fillStyle = "#87584d";
    roofContext.fillRect(x, 0, 1, 64);
    roofContext.fillStyle = "#b27968";
    roofContext.fillRect(x + 1, 0, 1, 64);
  }
  roofTexture.update();
  tile.albedoColor = Color3.White();
  tile.albedoTexture = roofTexture;

  function solid(mesh: Mesh, surface: PBRMaterial) {
    mesh.material = surface;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
  }

  function box(surface: PBRMaterial, x: number, y: number, z: number,
    width: number, height: number, depth: number, name?: string) {
    const mesh = CreateBox(name ?? surface.name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    applyMasonryUvs(mesh, surface);
    if (name) solid(mesh, surface);
    else batches.get(surface)!.push(mesh);
  }

  function rectangle(surface: PBRMaterial, [west, north, east, south]: Rect,
    bottom: number, top: number, name?: string) {
    box(surface, (west + east) / 2, (bottom + top) / 2, (north + south) / 2,
      east - west, top - bottom, south - north, name);
  }

  function volume(name: string, outline: readonly Point[], bottom: number, top: number,
    surface: PBRMaterial, collides = true) {
    const polygon = outline.map(([x, z]) => new Vector2(x, z));
    const mesh = new PolygonMeshBuilder(name, polygon, scene, earcut).build(false, top - bottom);
    mesh.position.y = top;
    applyMasonryUvs(mesh, surface);
    if (collides) solid(mesh, surface);
    else batches.get(surface)!.push(mesh);
  }

  function sign(name: string, text: string, x: number, y: number, z: number,
    width: number, height: number, ink = "#223e59") {
    const texture = new DynamicTexture(name, { width: 1024, height: 104 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = "#e8e6db";
    context.fillRect(0, 0, 1024, 104);
    context.fillStyle = ink;
    context.font = 'bold 59px "Segoe UI", sans-serif';
    const textWidth = Math.min(context.measureText(text).width, 971);
    context.fillText(text, (1024 - textWidth) / 2, 72, 971);
    texture.update();
    const lettering = new PBRMaterial(name, scene);
    lettering.unlit = true;
    lettering.albedoTexture = texture;
    const plate = CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    plate.position.set(x, y, z);
    plate.material = lettering;
    plate.isPickable = false;
    return plate;
  }

  function southWindow(x: number, y: number, z: number, width: number, height: number) {
    box(frame, x, y, z + 0.047, width + 0.12, height + 0.12, 0.10);
    box(glass, x, y, z + 0.103, width, height, 0.048);
    box(frame, x, y, z + 0.132, 0.045, height, 0.038);
  }

  function hipRoof([west, north, east, south]: Rect, eave: number, rise: number) {
    const x = (west + east) / 2;
    const z = (north + south) / 2;
    const ridgeHalf = (east - west) * 0.17;
    const corners = [
      [west, eave, north], [east, eave, north], [east, eave, south], [west, eave, south],
      [x - ridgeHalf, eave + rise, z], [x + ridgeHalf, eave + rise, z],
    ];
    const faces = [
      { ring: [0, 1, 5, 4], normal: [0, (south - north) / 2, -rise] },
      { ring: [1, 2, 5], normal: [rise, east - x - ridgeHalf, 0] },
      { ring: [2, 3, 4, 5], normal: [0, (south - north) / 2, rise] },
      { ring: [3, 0, 4], normal: [-rise, x - west - ridgeHalf, 0] },
    ];
    const geometry = new VertexData();
    geometry.positions = [];
    geometry.normals = [];
    geometry.uvs = [];
    geometry.indices = [];
    for (const { ring, normal } of faces) {
      const first = geometry.positions.length / 3;
      const length = Math.hypot(...normal);
      for (const index of ring) {
        geometry.positions.push(...corners[index]);
        geometry.normals.push(...normal.map((component) => component / length));
      }
      geometry.uvs.push(...(ring.length === 4 ? [0, 0, 1, 0, 0.67, 1, 0.33, 1] : [0, 0, 1, 0, 0.5, 1]));
      for (let i = 1; i < ring.length - 1; i++) geometry.indices.push(first, first + i, first + i + 1);
    }
    const roof = new Mesh("cafeteria-hipped-roof", scene);
    geometry.applyToMesh(roof);
    batches.get(tile)!.push(roof);
    box(ridge, x, eave + rise + 0.035, z, ridgeHalf * 2 + 0.15, 0.10, 0.13);
    const finial = CreateCylinder("cafeteria-roof-finial", {
      height: 0.49, diameterBottom: 0.24, diameterTop: 0.058, tessellation: 9,
    }, scene);
    finial.position.set(x, eave + rise + 0.25, z);
    batches.get(ridge)!.push(finial);
  }

  const cafeteria = campusBuildings.find(({ id }) => id === "B21")!;
  const [cafeWest, cafeNorth, cafeEast, cafeSouth] = bounds(cafeteria.footprint.map(annotationToWorld));
  const wingWidth = (cafeEast - cafeWest - 1.2) / 4;
  const cafeMid = (cafeEast + cafeWest) / 2;
  const cafeFront = cafeSouth - 0.65;
  const cafeHeight = 3.85;
  for (let wing = 0; wing < 4; wing++) {
    const west = cafeWest + 0.6 + wing * wingWidth;
    const east = west + wingWidth;
    const center = (west + east) / 2;
    const north = cafeNorth + 1.45;
    const south = cafeFront - (wing === 0 || wing === 3 ? 0.61 : 0);
    rectangle(cream, [west, north, east, south], 0, cafeHeight, `B21-wing-${wing + 1}`);
    hipRoof([west - 0.28, north - 0.38, east + 0.28, south + 0.36], cafeHeight + 0.14, 1.48);
    box(orange, center, cafeHeight + 0.03, south + 0.11, wingWidth + 0.18, 0.26, 0.27);
    box(orange, west + 0.17, cafeHeight / 2, south + 0.035, 0.29, cafeHeight, 0.16);
    box(orange, east - 0.17, cafeHeight / 2, south + 0.035, 0.29, cafeHeight, 0.16);
    const doorX = center + (wing % 2 === 0 ? 1.46 : -1.46);
    southWindow(doorX, 1.52, south, 2.46, 2.39);
    southWindow(center - (doorX - center), 2.07, south, 2.03, 1.22);
    for (let step = 0; step < 3; step++) {
      const depth = 1.41 - step * 0.36;
      rectangle(steps, [doorX - 1.58, south, doorX + 1.58, south + depth],
        0, 0.11 * (step + 1), "B21-entry-step");
    }
  }
  sign("B21-cafeteria-sign", "UNIVERSITY CAFETERIA", cafeMid, cafeHeight + 0.025, cafeFront + 0.28, 13.7, 0.59);
  rectangle(paving, [cafeMid - 4.6, cafeFront + 1.39, cafeMid + 4.6, cafeFront + 5.65], 0, 0.04);
  for (const [x, z] of [[cafeMid - 9.4, cafeFront + 4.4], [cafeMid - 6.4, cafeFront + 6.55],
    [cafeMid + 8.15, cafeFront + 5.3]]) {
    box(benchRed, x, 0.22, z, 0.92, 0.44, 0.53);
    box(cream, x, 0.22, z + 0.259, 0.37, 0.44, 0.032);
    box(benchGold, x, 0.48, z, 1.04, 0.12, 0.63);
  }

  const resourceSite = campusBuildings.find(({ id }) => id === "B24")!;
  const resourceOutline = resourceSite.footprint.map(annotationToWorld);
  const [resourceWest, , resourceEast, resourceSouth] = bounds(resourceOutline);
  const [, resourceNorth] = annotationToWorld([904, itCampusSplitRow]);
  const resource = clip(resourceOutline, [resourceWest, resourceNorth, resourceEast, resourceSouth]);
  const resourceHeight = 3.52;
  const resourceEntryZ = resourceNorth + (resourceSouth - resourceNorth) * 0.56;
  volume("B24-ITRC", resource, 0, resourceHeight, resourceCream);
  volume("B24-ITRC-flat-roof", resource, resourceHeight, resourceHeight + 0.12, resourceCream, false);

  function westPanel(surface: PBRMaterial, x: number, z: number, y: number,
    width: number, height: number, projection: number, name?: string) {
    box(surface, x - projection / 2, y, z, projection + 0.034, height, width, name);
  }

  // Preserve the slight step in the mapped west side while matching the low
  // resource center frontage and its dark red horizontal trims.
  for (const [index, [x, z]] of resource.entries()) {
    const [nextX, nextZ] = resource[(index + 1) % resource.length];
    if (x !== nextX || x > resourceWest + 1.6) continue;
    const low = Math.min(z, nextZ);
    const high = Math.max(z, nextZ);
    const length = high - low;
    const middle = (low + high) / 2;
    westPanel(resourceRed, x, middle, 3.34, length, 0.14, 0.11);
    westPanel(resourceCream, x, middle, 3.62, length, 0.36, 0.20);
    westPanel(resourceRed, x, middle, 3.80, length, 0.085, 0.22);
    const count = Math.max(1, Math.floor(length / 2.65));
    const spacing = length / count;
    for (let bay = 0; bay < count; bay++) {
      const center = low + spacing * (bay + 0.5);
      if (x === resourceWest && Math.abs(center - resourceEntryZ) < 3.15) continue;
      const width = spacing * 0.83;
      westPanel(frame, x - 0.028, center, 2.05, width + 0.14, 1.31, 0.10);
      westPanel(resourceGlazing, x - 0.11, center, 2.05, width, 1.19, 0.065);
      for (const divider of [-0.26, 0, 0.26]) {
        westPanel(frame, x - 0.19, center + divider * width, 2.05, 0.042, 1.19, 0.034);
      }
      westPanel(frame, x - 0.19, center, 2.42, width, 0.045, 0.034);
    }
  }

  const raisedRoof = clip(resource, [resourceWest, resourceNorth + 3.6,
    resourceWest + 9.4, resourceSouth - 3.6]);
  volume("B24-ITRC-raised-parapet", raisedRoof, resourceHeight, 4.37, resourceCream, false);
  for (const [index, [x, z]] of raisedRoof.entries()) {
    const [nextX, nextZ] = raisedRoof[(index + 1) % raisedRoof.length];
    if (x !== nextX || x > resourceWest + 1.6) continue;
    westPanel(resourceRed, x, (z + nextZ) / 2, 4.37, Math.abs(z - nextZ), 0.09, 0.22);
  }
  westPanel(glass, resourceWest - 0.04, resourceEntryZ, 1.28, 2.73, 2.36, 0.08);
  for (const offset of [-0.91, -0.3, 0.3, 0.91]) {
    westPanel(frame, resourceWest - 0.13, resourceEntryZ + offset, 1.28, 0.047, 2.36, 0.033);
  }
  for (const side of [-1, 1]) {
    box(resourceCream, resourceWest - 1.02, 1.61, resourceEntryZ + side * 2.1,
      0.31, 3.22, 0.31, "B24-ITRC-porch-column");
  }
  box(resourceCream, resourceWest - 0.53, 3.23, resourceEntryZ, 1.24, 0.31, 4.74);
  box(resourceRed, resourceWest - 1.18, 3.38, resourceEntryZ, 0.12, 0.11, 4.83);
  sign("B24-ITRC-sign", "I.T. RESOURCE CENTER", resourceWest - 1.225, 3.20,
    resourceEntryZ, 3.99, 0.43).rotation.y = -Math.PI / 2;
  for (let step = 0; step < 3; step++) {
    const depth = 1.43 - 0.29 * step;
    rectangle(lectureBand, [resourceWest - depth, resourceEntryZ - 2.28, resourceWest, resourceEntryZ + 2.28],
      0, 0.105 * (step + 1), "B24-ITRC-entry-step");
  }
  rectangle(paving, [resourceWest - 3.05, resourceEntryZ - 1.65, resourceWest - 1.43, resourceEntryZ + 1.65],
    0, 0.038);

  const pushpagiri = campusBuildings.find(({ id }) => id === "B45")!;
  const pushpagiriRoof = pushpagiri.footprint.map(annotationToWorld);
  const pushpagiriRoofY = pushpagiri.height + 0.15;
  volume("B45-full-roof-slab", pushpagiriRoof, pushpagiriRoofY, pushpagiriRoofY + 0.22, blueRoof, false);
  for (const [index, [x, z]] of pushpagiriRoof.entries()) {
    const [endX, endZ] = pushpagiriRoof[(index + 1) % pushpagiriRoof.length];
    const length = Math.hypot(endX - x, endZ - z);
    const parapet = CreateBox("B45-roof-parapet", { width: length + 0.18, height: 0.64, depth: 0.2 }, scene);
    parapet.position.set((x + endX) / 2, pushpagiriRoofY + 0.54, (z + endZ) / 2);
    parapet.rotation.y = -Math.atan2(endZ - z, endX - x);
    applyMasonryUvs(parapet, cream);
    batches.get(cream)!.push(parapet);
  }

  rectangle(courtGrass, nalandaCampusGarden, -0.03, nalandaCampusGardenY);
  const nalandaSoffit = nalandaCampusDeckY + nalandaGalleryHeadroom;
  for (const [index, gallery] of nalandaCampusGalleries.entries()) {
    rectangle(galleryPaving, gallery, nalandaCampusGardenY, nalandaCampusDeckY);
    rectangle(galleryRoof, gallery, nalandaSoffit, nalandaSoffit + 0.18, `B33-Nalanda-gallery-shed-${index}`);
  }
  const [gardenLeft, gardenRear, gardenRight, gardenFront] = nalandaCampusGarden;
  function nalandaPost(x: number, z: number, index: number) {
    box(cream, x, nalandaCampusDeckY + nalandaGalleryHeadroom / 2, z,
      0.28, nalandaGalleryHeadroom, 0.28, "B33-Nalanda-gallery-post");
    box(galleryPaint[index % galleryPaint.length], x, nalandaCampusDeckY + 1.27, z, 0.291, 1.34, 0.291);
  }
  for (const [side, z] of [gardenRear - 0.16, gardenFront + 0.16].entries()) {
    for (let x = gardenLeft, bay = 0; x <= gardenRight + 0.1; x += 3.8, bay++) nalandaPost(x, z, side + bay);
  }
  for (const [side, x] of [gardenLeft - 0.16, gardenRight + 0.16].entries()) {
    for (let z = gardenRear + 1.62, bay = 0; z < gardenFront; z += 3.8, bay++) {
      if (Math.abs(z - (gardenRear + gardenFront) / 2) > 1.55) nalandaPost(x, z, side + bay);
    }
  }
  for (const [side, [left, rear, right, front]] of nalandaCampusStairs.entries()) {
    for (let step = 0; step < 3; step++) {
      const x = side ? right - (step + 0.5) * 0.45 : left + (step + 0.5) * 0.45;
      const height = nalandaGalleryRise * (3 - step) / 3;
      box(galleryPaving, x, nalandaCampusGardenY + height / 2, (rear + front) / 2, 0.45, height, front - rear);
    }
  }
  for (const [row, z] of [gardenRear + 1.25, gardenFront - 1.25].entries()) {
    for (let x = gardenLeft + 1.3, index = 0; x < gardenRight - 0.9; x += 1.15, index++) {
      box(shrub[index % 2], x, nalandaCampusGardenY + 0.20, z, 1.19, 0.4, 0.66);
      if (index % 2 === 0) box(flowers[(row + index / 2) % 2], x, nalandaCampusGardenY + 0.42, z, 0.23, 0.10, 0.23);
    }
  }
  const [rampLeft, rampRear, rampRight, rampFront] = nalandaEntranceRamp;
  const rampZ = (rampRear + rampFront) / 2;
  const landingX = rampRight - 0.9;
  const rampRun = landingX - rampLeft;
  const ramp = CreateBox("B33-Nalanda-entrance-ramp", {
    width: Math.hypot(rampRun, nalandaGalleryRise), height: 0.12, depth: rampFront - rampRear,
  }, scene);
  ramp.position.set((rampLeft + landingX) / 2, nalandaCampusFloor((rampLeft + landingX) / 2, rampZ)! - 0.06, rampZ);
  ramp.rotation.z = Math.atan2(nalandaGalleryRise, rampRun);
  applyMasonryUvs(ramp, galleryPaving);
  batches.get(galleryPaving)!.push(ramp);
  rectangle(galleryPaving, [landingX, rampRear, rampRight, rampFront], nalandaCampusGardenY, nalandaCampusDeckY);

  const hall = campusBuildings.find(({ id }) => id === "B47")!;
  const hallOutline = hall.footprint.map(annotationToWorld);
  const [hallWest, hallNorth, hallEast, hallSouth] = bounds(hallOutline);
  const [courtWest, courtNorth, courtEast, courtSouth] = bounds(hall.holes[0].map(annotationToWorld));
  const openCourt: Rect = [courtWest, courtNorth, courtEast, courtSouth];
  const galleryWidth = takshashilaGalleryWidth * 0.7;
  const galleryBounds = insetCourt(openCourt, -galleryWidth);
  const [galleryWest, galleryNorth, galleryEast, gallerySouth] = galleryBounds;
  const hallX = (courtWest + courtEast) / 2;
  const hallHeight = hall.height;
  const portalHalfWidth = 2.75;
  const [northEntryX] = academicFrontages.takshashila.door;
  const northLeft = northEntryX - lectureEntranceWidth / 2;
  const northRight = northEntryX + lectureEntranceWidth / 2;
  const northWing = clip(hallOutline, [hallWest, hallNorth, hallEast, galleryNorth]);
  const westWing = clip(hallOutline, [hallWest, galleryNorth, galleryWest, gallerySouth]);
  const eastWing = clip(hallOutline, [galleryEast, galleryNorth, hallEast, gallerySouth]);
  const southWing = clip(hallOutline, [hallWest, gallerySouth, hallEast, hallSouth]);
  for (const [name, wing] of [["west", westWing], ["east", eastWing]] as const) {
    volume(`B47-${name}-wing`, wing, 0, hallHeight, cream);
    volume(`B47-${name}-roof`, wing, hallHeight, hallHeight + 0.16, blueRoof, false);
  }
  volume("B47-north-wing-west", clip(northWing, [hallWest, hallNorth, northLeft, galleryNorth]), 0, hallHeight, cream);
  volume("B47-north-wing-east", clip(northWing, [northRight, hallNorth, hallEast, galleryNorth]), 0, hallHeight, cream);
  volume("B47-north-wing-portal", clip(northWing, [northLeft, hallNorth, northRight, galleryNorth]),
    3.02, hallHeight, cream);
  volume("B47-north-roof", northWing, hallHeight, hallHeight + 0.16, blueRoof, false);
  rectangle(paving, [northLeft, hallNorth, northRight, courtNorth + 1.35], 0, 0.043);

  // Illustrative walk-through in the otherwise continuous southern wing.
  volume("B47-south-wing-west", clip(southWing, [hallWest, gallerySouth, hallX - portalHalfWidth, hallSouth]),
    0, hallHeight, cream);
  volume("B47-south-wing-east", clip(southWing, [hallX + portalHalfWidth, gallerySouth, hallEast, hallSouth]),
    0, hallHeight, cream);
  volume("B47-south-wing-portal", clip(southWing, [hallX - portalHalfWidth, gallerySouth, hallX + portalHalfWidth, hallSouth]),
    3.1, hallHeight, cream);
  volume("B47-south-roof", southWing, hallHeight, hallHeight + 0.16, blueRoof, false);
  const upperWalk = 3.72;
  rectangle(paving, galleryBounds, 0, 0.037);
  rectangle(paving, [hallX - 1.9, gallerySouth, hallX + 1.9, hallSouth + 2.1], 0, 0.048);
  for (const gallery of courtGalleries(galleryBounds, openCourt)) {
    rectangle(galleryPaving, gallery, 0.037, 0.049);
    rectangle(cream, gallery, upperWalk - 0.20, upperWalk);
    rectangle(galleryRoof, gallery, hallHeight - 0.04, hallHeight + 0.16);
  }
  for (const z of [openCourt[1], openCourt[3]]) {
    box(iron, hallX, upperWalk + 0.99, z, openCourt[2] - openCourt[0], 0.078, 0.082);
    for (let x = openCourt[0]; x <= openCourt[2] + 0.1; x += 0.26) {
      box(iron, x, upperWalk + 0.50, z, 0.031, 0.96, 0.031);
    }
    for (let x = openCourt[0] + 0.28; x < openCourt[2]; x += 4.4) {
      box(cream, x, upperWalk / 2, z, 0.24, upperWalk, 0.24, "B47-court-post");
      box(cream, x, (hallHeight + upperWalk) / 2, z, 0.24, hallHeight - upperWalk, 0.24);
    }
  }
  for (const x of [openCourt[0], openCourt[2]]) {
    box(iron, x, upperWalk + 0.99, (courtNorth + courtSouth) / 2, 0.082, 0.078, openCourt[3] - openCourt[1]);
    for (let z = openCourt[1] + 0.25; z < openCourt[3]; z += 0.26) {
      box(iron, x, upperWalk + 0.50, z, 0.031, 0.96, 0.031);
    }
  }
  for (const x of [hallX - portalHalfWidth, hallX + portalHalfWidth]) {
    box(lectureBand, x, 1.65, hallSouth + 0.066, 0.28, 3.3, 0.19);
  }
  box(lectureBand, hallX, 3.35, hallSouth + 0.072, portalHalfWidth * 2 + 0.32, 0.37, 0.21);
  for (const y of [1.82, 5.26]) {
    for (let bay = 0; bay < 9; bay++) {
      const x = courtWest + (courtEast - courtWest) * (bay + 0.5) / 9;
      if (y > 3 || Math.abs(x - northEntryX) > lectureEntranceWidth / 2 + 1.1) {
        southWindow(x, y, galleryNorth, 2.04, 1.31);
      }
      if (y > 3 || Math.abs(x - hallX) > portalHalfWidth + 1.12) {
        box(frame, x, y, gallerySouth - 0.045, 2.16, 1.43, 0.10);
        box(glass, x, y, gallerySouth - 0.104, 2.04, 1.31, 0.05);
      }
    }
    for (const [x, side] of [[galleryWest, 1], [galleryEast, -1]] as const) {
      for (let bay = 0; bay < 4; bay++) {
        const z = courtNorth + (courtSouth - courtNorth) * (bay + 0.5) / 4;
        box(frame, x + side * 0.043, y, z, 0.10, 1.43, 2.15);
        box(glass, x + side * 0.102, y, z, 0.048, 1.31, 2.03);
      }
    }
  }
  for (const x of [hallX - 13.4, hallX - 9.1, hallX - 4.8, hallX + 4.8, hallX + 9.1, hallX + 13.4]) {
    for (const y of [1.82, 5.26]) southWindow(x, y, hallSouth, 2.32, 1.28);
  }

  for (const [surface, meshes] of batches) {
    const mesh = Mesh.MergeMeshes(meshes, true, true);
    if (!mesh) continue;
    mesh.name = surface.name;
    mesh.material = surface;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    if (surface === tile || surface === blueRoof || surface === galleryRoof) shadows.addShadowCaster(mesh);
  }
}
