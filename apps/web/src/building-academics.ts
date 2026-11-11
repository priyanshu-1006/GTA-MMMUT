import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { campusAccess } from "@gta-mmmut/world-data/campus-access";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";
import type { BuildingDoorway } from "./building-interiors";

type Point = readonly [x: number, z: number];
type Front = { axis: "x" | "z"; edge: number; outward: 1 | -1 };
type AcademicId = "B16" | "B17" | "B22" | "B23" | "B75";

function building(id: AcademicId) {
  const entry = campusBuildings.find((candidate) => candidate.id === id)!;
  const outline = entry.footprint.map(annotationToWorld);
  const xs = outline.map(([x]) => x);
  const zs = outline.map(([, z]) => z);
  return { ...entry, outline, west: Math.min(...xs), east: Math.max(...xs), north: Math.min(...zs), south: Math.max(...zs) };
}

function position({ axis, edge, outward }: Front, along: number, projection: number): Point {
  const normal = edge + outward * projection;
  return axis === "x" ? [normal, along] : [along, normal];
}

function clipEast(outline: readonly Point[], x: number) {
  const clipped: Point[] = [];
  for (const [i, point] of outline.entries()) {
    const next = outline[(i + 1) % outline.length];
    if (point[0] >= x) clipped.push(point);
    if ((point[0] < x) === (next[0] < x)) continue;
    const t = (x - point[0]) / (next[0] - point[0]);
    clipped.push([x, point[1] + t * (next[1] - point[1])]);
  }
  return clipped;
}

export function createAcademicFacades(scene: Scene, shadows: ShadowGenerator): readonly BuildingDoorway[] {
  function material(name: string, color: string, roughness = 0.9) {
    const surface = new PBRMaterial(name, scene);
    surface.albedoColor = Color3.FromHexString(color).toLinearSpace();
    surface.metallic = 0;
    surface.roughness = roughness;
    return surface;
  }

  const cream = material("academic-cream", "#ddd4be");
  const light = material("academic-pale-concrete", "#dededa");
  const libraryWall = material("library-off-white", "#d6d6c7");
  const oxide = material("academic-oxide-trim", "#8b4e43");
  const roof = material("academic-roof", "#9f9c91");
  const dark = material("academic-frames", "#404443");
  const glass = material("academic-warm-glass", "#626d6b", 0.48);
  const blue = material("cse-blue-glass", "#2e4e77", 0.35);
  const door = material("academic-entrance", "#353b3c", 0.53);
  const batches = new Map<PBRMaterial, { detail: Mesh[]; solid: Mesh[] }>();

  function box(front: Front, surface: PBRMaterial, along: number, y: number, projection: number,
    width: number, height: number, depth: number, collidable = false) {
    const [x, z] = position(front, along, projection);
    const mesh = CreateBox(surface.name, {
      width: front.axis === "x" ? depth : width,
      height,
      depth: front.axis === "x" ? width : depth,
    }, scene);
    mesh.position.set(x, y, z);
    const batch = batches.get(surface) ?? { detail: [], solid: [] };
    batch[collidable ? "solid" : "detail"].push(mesh);
    batches.set(surface, batch);
  }

  function volume(name: string, outline: readonly Point[], bottom: number, top: number, surface: PBRMaterial, collidable = true) {
    const polygon = outline.map(([x, z]) => new Vector2(x, z));
    const area = polygon.reduce((sum, point, i) => {
      const next = polygon[(i + 1) % polygon.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    if (area < 0) polygon.reverse();
    const mesh = new PolygonMeshBuilder(name, polygon, scene, earcut).build(false, top - bottom);
    mesh.position.y = top;
    mesh.material = surface;
    mesh.receiveShadows = true;
    mesh.checkCollisions = collidable;
    shadows.addShadowCaster(mesh);
    return mesh;
  }

  function entranceVolume(
    name: string, outline: readonly Point[], front: Front, center: number,
    width: number, openingHeight: number, top: number, surface: PBRMaterial,
  ) {
    const along = front.axis === "x" ? 1 : 0;
    const across = 1 - along;
    const left = center - width / 2;
    const right = center + width / 2;
    const edge = outline.findIndex((start, index) => {
      const end = outline[(index + 1) % outline.length];
      return Math.abs(start[across] - front.edge) < 0.001 && Math.abs(end[across] - front.edge) < 0.001
        && Math.min(start[along], end[along]) < left && Math.max(start[along], end[along]) > right;
    });
    if (edge < 0) return volume(name, outline, 0, top, surface);
    const start = outline[edge];
    const end = outline[(edge + 1) % outline.length];
    const [a, b] = start[along] < end[along] ? [left, right] : [right, left];
    const depth = width / 2 + 0.38;
    const recess = [
      position(front, a, 0), position(front, a, -depth),
      position(front, b, -depth), position(front, b, 0),
    ];
    const lower = outline.flatMap((point, index) => index === edge ? [point, ...recess] : [point]);
    volume(`${name}-above-doors`, outline, openingHeight, top, surface);
    return volume(name, lower, 0, openingHeight, surface);
  }

  function window(front: Front, along: number, y: number, width: number, height: number, glazing = glass, projection = 0) {
    box(front, light, along, y, projection + 0.025, width + 0.18, height + 0.18, 0.09);
    box(front, dark, along, y, projection + 0.064, width, height, 0.05);
    box(front, glazing, along, y, projection + 0.091, width - 0.11, height - 0.11, 0.044);
    box(front, dark, along, y, projection + 0.12, 0.045, height - 0.08, 0.04);
  }

  function sign(name: string, front: Front, along: number, y: number, projection: number,
    width: number, height: number, title: string, subtitle: string, background: string, fontSize = 48) {
    const texture = new DynamicTexture(`${name}-lettering`, { width: 1024, height: 160 }, scene, true);
    texture.drawText(subtitle, null, 67, "700 53px 'Nirmala UI', sans-serif", "#f2f3ef", background, true, false);
    texture.drawText(title, null, 128, `700 ${fontSize}px sans-serif`, "#f2f3ef", null);
    const surface = material(`${name}-sign-material`, "#ffffff");
    surface.albedoTexture = texture;
    const panel = CreatePlane(`${name}-nameplate`, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const [x, z] = position(front, along, projection);
    panel.position.set(x, y, z);
    panel.rotation.y = front.axis === "x" ? front.outward * Math.PI / 2 : front.outward === 1 ? 0 : Math.PI;
    panel.material = surface;
  }

  // The CSE image matches the rectangular new-block mass most closely. The north porch is traced.
  const cse = building("B22");
  const csePorch = cse.outline.filter(([, z]) => z === cse.north);
  const cseWalls = cse.outline.filter(([, z]) => z !== cse.north);
  const cseFront: Front = { axis: "z", edge: Math.min(...cseWalls.map(([, z]) => z)), outward: -1 };
  const cseSide: Front = { axis: "x", edge: cse.east, outward: 1 };
  const porchDepth = cseFront.edge - cse.north;
  const porchWidth = csePorch[1][0] - csePorch[0][0];
  const porchX = (csePorch[0][0] + csePorch[1][0]) / 2;
  const towerX = cse.east - 3.95;
  const cseHeight = cse.height * 1.29;
  const towerHeight = cseHeight + 2.25;
  // Join the porch to the north access lane.
  const csePaving = material("cse-entry-concrete", "#ada99d");
  const cseApron = [[694, 187.4], [748, 191.04], [748, 204], [694, 204]] as const;
  volume("B22-entry-apron", cseApron.map(annotationToWorld), -0.02, 0.049, csePaving, false);
  entranceVolume(cse.id, cseWalls, cseFront, porchX, 2.48, 2.62, cseHeight, cream);
  volume("B22-roof-cap", cseWalls, cseHeight, cseHeight + 0.15, roof, false);
  box(cseFront, cream, towerX, cseHeight + (towerHeight - cseHeight) / 2, -4.25,
    7.6, towerHeight - cseHeight, 8.5, true);
  for (const [front, center, width] of [[cseFront, towerX, 6.75], [cseSide, cseFront.edge + 4.25, 6.1]] as const) {
    for (const direction of [-1, 1]) {
      box(front, light, center + direction * width / 2, towerHeight / 2, 0.07, 0.43, towerHeight, 0.23);
    }
    box(front, light, center, towerHeight - 0.16, 0.08, width + 0.43, 0.32, 0.24);
    box(front, dark, center, towerHeight * 0.50, 0.044, 1.62, towerHeight * 0.77, 0.07);
    box(front, blue, center, towerHeight * 0.46, 0.094, 1.49, towerHeight * 0.66, 0.054);
    box(front, oxide, center, towerHeight * 0.852, 0.095, 1.49, towerHeight * 0.119, 0.054);
    for (const ratio of [0.24, 0.42, 0.61, 0.79]) {
      box(front, dark, center, towerHeight * ratio, 0.13, 1.48, 0.055, 0.045);
    }
  }
  box(cseFront, oxide, porchX, 5.85, 0.052, porchWidth + 1.6, 3.44, 0.13);
  box(cseFront, cream, porchX, 5.48, 0.13, porchWidth - 0.37, 2.42, 0.12);
  const insertFace = 0.19;
  window(cseFront, porchX, 5.13, 3.4, 1.63, blue, insertFace);
  for (const offset of [-2.9, 2.9]) {
    window(cseFront, porchX + offset, 5.13, 1.36, 1.43, glass, insertFace);
  }
  for (const x of [cse.west + 2.7, cse.west + 6.35]) {
    window(cseFront, x, 1.6, 1.16, 1.24);
    window(cseFront, x, 5.08, 1.16, 1.22);
  }
  for (let i = 0; i < 5; i++) {
    const z = cseFront.edge + 11.0 + i * 3.44;
    window(cseSide, z, 4.65, 1.31, 1.56);
    box(cseSide, light, z + 1.42, 5.85, 0.063, 0.26, 4.22, 0.15);
  }
  box(cseFront, light, porchX, 3.24, porchDepth / 2, porchWidth, 0.41, porchDepth, true);
  for (const x of [porchX - porchWidth / 2 + 0.32, porchX - 0.52, porchX + 0.52, porchX + porchWidth / 2 - 0.32]) {
    box(cseFront, light, x, 1.55, porchDepth - 0.31, 0.32, 3.1, 0.32, true);
  }
  sign("B22", cseFront, porchX, 3.51, porchDepth + 0.022, porchWidth - 0.3, 0.81,
    "DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING", "कंप्यूटर विज्ञान एवं अभियांत्रिकी विभाग", "#345776", 35);

  const oldCse = building("B23");
  const oldFront: Front = { axis: "z", edge: oldCse.north, outward: -1 };
  const oldEntry = annotationToWorld([786, 206])[0];
  const oldHeight = 7.6;
  volume("B23", oldCse.outline, 0, oldHeight, cream);
  volume("B23-roof", oldCse.outline, oldHeight, oldHeight + 0.13, roof, false);
  for (const [from, to] of [[766, 805], [825, 849]]) {
    const left = annotationToWorld([from, 0])[0];
    const right = annotationToWorld([to, 0])[0];
    const width = right - left;
    const midpoint = (left + right) / 2;
    box(oldFront, oxide, midpoint, oldHeight - 0.18, 0.042, width, 0.32, 0.16);
    for (const x of [left + 0.22, right - 0.22]) {
      box(oldFront, light, x, oldHeight / 2, 0.07, 0.46, oldHeight, 0.18);
    }
    for (const x of [midpoint - width * 0.29, midpoint, midpoint + width * 0.29]) {
      window(oldFront, x, 5.0, 1.65, 1.68, blue);
      if (Math.abs(x - oldEntry) > 1.6) window(oldFront, x, 1.75, 1.61, 1.55);
    }
  }
  box(oldFront, door, oldEntry, 1.37, 0.17, 2.82, 2.73, 0.17);
  box(oldFront, light, oldEntry, 3.24, 0.93, 5.9, 0.27, 2.18);
  sign("B23", oldFront, oldEntry, 3.46, 2.04, 5.72, 0.58,
    "COMPUTER SCIENCE & ENGINEERING · OLD BLOCK", "कंप्यूटर विज्ञान एवं अभियांत्रिकी विभाग", "#345776", 34);

  // The short link is visible between the two CSE footprints in the aerial.
  const linkOutline = campusAccess.cseLink.map(annotationToWorld);
  const [linkLeft, linkNorth] = linkOutline[0];
  const [linkRight, linkSouth] = linkOutline[2];
  volume("CSE-link-paving", linkOutline, -0.02, 0.048, csePaving, false);
  volume("CSE-link-roof", linkOutline, 3.12, 3.65, light);
  const linkFront: Front = { axis: "z", edge: linkNorth, outward: -1 };
  box(linkFront, oxide, (linkLeft + linkRight) / 2, 3.55, 0.05, linkRight - linkLeft, 0.16, 0.16);
  for (const x of [linkLeft + 0.62, linkRight - 0.62]) {
    box(linkFront, light, x, 1.56, -0.2, 0.28, 3.12, 0.28, true);
    box(linkFront, light, x, 1.56, linkNorth - linkSouth + 0.2, 0.28, 3.12, 0.28, true);
  }

  // The clipped B16 wing continues behind the B17 south entry face.
  const hallRear = building("B16");
  const hall = building("B17");
  const hallFront: Front = { axis: "z", edge: hall.south, outward: 1 };
  const hallWall: Front = { ...hallFront, edge: hall.south - 1.08 };
  const hallWidth = hall.east - hall.west - 0.5;
  const hallCenter = hall.west + hallWidth / 2;
  const canopyCenter = hall.west + hallWidth * 0.37;
  const canopyWidth = hallWidth * 0.52;
  const canopyDepth = 2.75;
  const hallBackOfPorch: Front = { ...hallFront, edge: hallFront.edge - canopyDepth };
  const hallTop = hall.height * 1.36;
  // The eaves and canopy keep the traced outline while the entrance wall sits behind them.
  const hallUpper = hall.outline.map(([x, z]): Point => [x, Math.min(z, hallWall.edge)]);
  const hallEdge = hallUpper.findIndex(([, z], i) => z === hallWall.edge && hallUpper[(i + 1) % hallUpper.length][1] === z);
  const hallBase = hallUpper.flatMap((point, i): readonly Point[] => i === hallEdge ? [
    point, [canopyCenter + canopyWidth / 2, hallWall.edge], [canopyCenter + canopyWidth / 2, hall.south - canopyDepth],
    [canopyCenter - canopyWidth / 2, hall.south - canopyDepth], [canopyCenter - canopyWidth / 2, hallWall.edge],
  ] : [point]);
  volume(hallRear.id, hallRear.outline, 0, hallTop - 0.35, cream);
  volume("B16-roof-cap", hallRear.outline, hallTop - 0.35, hallTop - 0.18, roof, false);
  // Avoid self-shadow bands on the broad, pale wall at campus shadow-map scale.
  entranceVolume(hall.id, hallBase, hallBackOfPorch, canopyCenter, 4.65, 2.74, 3.48, cream).receiveShadows = false;
  volume("B17-upper-hall", hallUpper, 3.48, hallTop, cream).receiveShadows = false;
  volume("B17-roof-cap", hall.outline, hallTop, hallTop + 0.14, roof, false);
  box(hallFront, csePaving, canopyCenter, 0.021, (0.5 - canopyDepth) / 2,
    canopyWidth + 0.28, 0.054, canopyDepth + 0.5);
  box(hallFront, oxide, canopyCenter, 3.42, -canopyDepth / 2, canopyWidth, 0.29, canopyDepth, true);
  box(hallFront, cream, canopyCenter, 3.22, -canopyDepth / 2, canopyWidth - 0.22, 0.17, canopyDepth - 0.12);
  for (const direction of [-1, 1]) {
    box(hallFront, cream, canopyCenter + direction * (canopyWidth / 2 - 0.62), 1.63, -0.27, 0.48, 3.26, 0.48, true);
  }
  const hallGlazing = material("hall-warm-glazing", "#776a59", 0.48);
  const bayPitch = 4.18;
  for (let i = -1; i <= 1; i++) {
    window(hallWall, hallCenter + i * bayPitch, 7.68, 3.72, 1.78, hallGlazing);
  }
  box(hallWall, oxide, hallCenter, 8.78, 0.09, 12.95, 0.24, 0.23);
  for (const x of [hall.west + 1.18, hallCenter - 6.52, hallCenter + 6.52, hall.west + hallWidth - 1.18]) {
    box(hallWall, light, x, (hallTop + 3.48) / 2, 0.066, 0.27, hallTop - 3.48, 0.21);
  }
  for (const offset of [-bayPitch / 2, bayPitch / 2]) {
    box(hallWall, light, hallCenter + offset, 6.05, 0.066, 0.22, 5.14, 0.21);
  }
  const [, [sideStartX, sideStartZ], [sideEndX, sideEndZ]] = hall.outline;
  for (const [fraction, height] of [[0.22, 8.25], [0.25, 3.12], [0.72, 2.87]]) {
    const z = sideStartZ + fraction * (sideEndZ - sideStartZ);
    const edge = sideStartX + fraction * (sideEndX - sideStartX);
    window({ axis: "x", edge, outward: 1 }, z, height, 1.15, 0.67, hallGlazing);
  }
  const hallWing: Front = { axis: "x", edge: hallRear.east, outward: 1 };
  const wingSpan = hallRear.south - hallRear.north;
  for (let bay = 0; bay < 4; bay++) {
    const z = hallRear.north + wingSpan * (bay + 0.5) / 4;
    window(hallWing, z, 2.12, 1.57, 1.87, hallGlazing);
    box(hallWing, light, z - 1.21, 4.9, 0.08, 0.24, 9.6, 0.25);
  }
  sign("B17", hallWall, hallCenter, 9.48, 0.16, 5.5, 0.93, "MULTIPURPOSE HALL", "बहुउद्देशीय भवन", "#493e36");

  // The west projection and courtyard walkway locate the library colonnade.
  const library = building("B75");
  const libraryFront: Front = { axis: "x", edge: library.west, outward: -1 };
  const porchEnds = library.outline.filter(([x]) => x === library.west).map(([, z]) => z);
  const librarySpan = Math.max(...porchEnds) - Math.min(...porchEnds);
  const libraryCenter = (Math.min(...porchEnds) + Math.max(...porchEnds)) / 2;
  const inset = library.west + 4.7;
  const colonnadeTop = 2.95;
  const libraryWings = clipEast(library.outline, inset);
  const libraryRoofHeight = library.height * 0.69;
  const libraryPortalTop = library.height * 1.18;
  const libraryDoorFront: Front = { ...libraryFront, edge: inset };
  entranceVolume(library.id, libraryWings, libraryDoorFront, libraryCenter, 3.23, 2.58, libraryRoofHeight, libraryWall);
  volume("B75-wing-roofs", libraryWings, libraryRoofHeight, libraryRoofHeight + 0.12, roof, false);
  box(libraryFront, libraryWall, libraryCenter, colonnadeTop, -(inset - library.west) / 2,
    librarySpan, 0.28, inset - library.west, true);
  box(libraryFront, libraryWall, libraryCenter, (libraryPortalTop + colonnadeTop) / 2, -4.6,
    librarySpan * 0.83, libraryPortalTop - colonnadeTop, 8.1, true);
  for (const ratio of [-0.46, -0.29, -0.12, 0.12, 0.29, 0.46]) {
    box(libraryFront, cream, libraryCenter + librarySpan * ratio, 1.43, -0.23, 0.30, 2.86, 0.32, true);
  }
  for (const offset of [-4.5, 4.5]) {
    window(libraryDoorFront, libraryCenter + offset, 1.45, 4.85, 1.95);
  }
  const pavers = material("library-red-pavers", "#ffffff");
  const tiles = new DynamicTexture("library-entry-tiles", { width: 512, height: 128 }, scene, true);
  const tileContext = tiles.getContext();
  tileContext.fillStyle = "#a49a8b";
  tileContext.fillRect(0, 0, 512, 128);
  const clay = ["#a66b65", "#985f59", "#aa7469", "#ab7872", "#9f6e66"];
  for (let row = 0; row < 8; row++) {
    for (let column = -1; column < 32; column++) {
      tileContext.fillStyle = clay[(column + 1 + row * (column + 4)) % clay.length];
      tileContext.fillRect(column * 16 + (row % 2) * 8, row * 16, 15, 15);
    }
  }
  tiles.update();
  pavers.albedoTexture = tiles;
  const approach = library.west - 5.2;
  const pathLength = inset - approach;
  const pathProjection = library.west - (approach + inset) / 2;
  box(libraryFront, light, libraryCenter, 0.018, pathProjection, 2.34, 0.066, pathLength);
  box(libraryFront, pavers, libraryCenter, 0.046, pathProjection, 2.04, 0.016, pathLength);
  sign("B75", { ...libraryFront, edge: library.west + 0.55 }, libraryCenter, 6.17, 0.05,
    5.9, 1.26, "CENTRAL LIBRARY", "केन्द्रीय पुस्तकालय", "#343c49");

  for (const [surface, { detail, solid }] of batches) {
    for (const [parts, collidable] of [[detail, false], [solid, true]] as const) {
      if (parts.length === 0) continue;
      const mesh = Mesh.MergeMeshes(parts, true, true);
      if (!mesh) continue;
      mesh.name = `${surface.name}-${collidable ? "structure" : "trim"}`;
      mesh.material = surface;
      mesh.checkCollisions = collidable;
      mesh.receiveShadows = collidable;
      if (collidable) shadows.addShadowCaster(mesh);
    }
  }
  return [
    { id: "cse", point: position(cseFront, porchX, 0.075), outward: [0, -1], width: 2.48, height: 2.55, finish: "#37494d" },
    { id: "hall", point: position(hallBackOfPorch, canopyCenter, 0.075), outward: [0, 1], width: 4.65, height: 2.67, finish: "#5f4836" },
    { id: "library", point: position(libraryDoorFront, libraryCenter, 0.075), outward: [-1, 0], width: 3.23, height: 2.51, finish: "#57463c" },
  ];
}
