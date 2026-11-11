import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
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
import { campusAccess, itCampusSplitRow } from "@gta-mmmut/world-data/campus-access";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";

type Point = readonly [x: number, z: number];
type Face = { axis: "x" | "z"; edge: number; direction: -1 | 1 };
type EngineeringId = "B24" | "B28" | "B29" | "B48" | "B73" | "B74";

function footprint(id: EngineeringId) {
  const source = campusBuildings.find((entry) => entry.id === id)!;
  const outline = source.footprint.map(annotationToWorld);
  const north = Math.min(...outline.map(([, z]) => z));
  const south = Math.max(...outline.map(([, z]) => z));
  return { source, outline, north, south };
}

function facadePosition({ axis, edge, direction }: Face, along: number, projection: number): Point {
  const normal = edge + direction * projection;
  return axis === "x" ? [normal, along] : [along, normal];
}

function rectangle(west: number, north: number, east: number, south: number): readonly Point[] {
  return [[west, north], [east, north], [east, south], [west, south]];
}

export function createEngineeringFacades(scene: Scene, shadows: ShadowGenerator): void {
  function material(name: string, hex: string, roughness = 0.92) {
    const surface = new PBRMaterial(name, scene);
    surface.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    surface.metallic = 0;
    surface.roughness = roughness;
    return surface;
  }

  const cream = material("engineering-cream-plaster", "#e4d6b8");
  const sandstone = material("civil-sandstone-concrete", "#d0b996");
  const white = material("IT-white-concrete", "#eeebe3");
  const maroon = material("mechanical-maroon-trim", "#78453f");
  const roof = material("engineering-roof", "#aea99b");
  const brick = material("civil-flemish-brick", "#ffffff");
  const peach = material("IT-peach-plaster", "#ebb195");
  const entryConcrete = material("engineering-entry-concrete", "#c3bba9");
  const civilPavers = material("civil-entry-pavers", "#ffffff");
  const terracotta = material("IT-terracotta-trim", "#9d5138");
  const frames = material("engineering-window-frame", "#625c52");
  const glazing = material("engineering-window-glazing", "#6e7775", 0.5);
  const blue = material("mechanical-blue-glazing", "#1e3e67", 0.34);
  const blueLight = material("mechanical-blue-glazing-light", "#2a4b73", 0.36);
  const entrance = material("engineering-shadowed-door", "#363b3a", 0.54);

  // Seeded individual brick colors and mortar. UVs repeat at world scale rather than per wall.
  const brickTexture = new DynamicTexture("civil-procedural-brick", 512, scene, true);
  const paint = brickTexture.getContext();
  paint.fillStyle = "#705347";
  paint.fillRect(0, 0, 512, 512);
  const brickColors = ["#943f34", "#a14a3a", "#98463a", "#863b31", "#9a4334", "#a55242", "#8d4035"];
  let seed = 518;
  for (let row = 0; row < 32; row++) {
    for (let col = -1; col < 10; col++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = col * 51.2 + (row % 2) * 25.6;
      const y = row * 16;
      paint.fillStyle = brickColors[seed % brickColors.length];
      paint.fillRect(x + 0.85, y + 0.75, 49.5, 14.35);
      paint.fillStyle = "rgba(236, 176, 136, 0.15)";
      paint.fillRect(x + 1.25, y + 1, 48.7, 1.2);
      paint.fillStyle = "rgba(67, 31, 25, 0.14)";
      paint.fillRect(x + 6 + (seed % 17), y + 8, 14 + (seed % 10), 0.9);
    }
  }
  brickTexture.update();
  brickTexture.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  brickTexture.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
  brick.albedoTexture = brickTexture;

  const pavers = new DynamicTexture("civil-paver-joints", 256, scene, true);
  const pavingPaint = pavers.getContext();
  pavingPaint.fillStyle = "#817968";
  pavingPaint.fillRect(0, 0, 256, 256);
  const paverColors = ["#b6a684", "#c0ac86", "#b0a17e", "#af9871", "#c4b595"];
  for (let row = 0; row < 12; row++) {
    for (let column = -1; column < 8; column++) {
      pavingPaint.fillStyle = paverColors[(column + 1 + row * (column + 3)) % paverColors.length];
      pavingPaint.fillRect(column * 32 + (row % 2) * 16 + 1, row * 256 / 12 + 1, 30, 19.3);
    }
  }
  pavers.update();
  civilPavers.albedoTexture = pavers;

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
    mesh.checkCollisions = collidable;
    if (surface === brick || surface === civilPavers) {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
      const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
      const uv: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        if (surface === civilPavers) {
          uv.push(positions[i] / 1.85, positions[i + 2] / 1.55);
        } else {
          const along = Math.abs(normals[i]) > Math.abs(normals[i + 2]) ? positions[i + 2] : positions[i];
          uv.push(along / 2.8, (positions[i + 1] + top) / 2.4);
        }
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uv);
    }
    shadows.addShadowCaster(mesh);
    return mesh;
  }

  const trim = new Map<PBRMaterial, Mesh[]>();
  function box(face: Face, surface: PBRMaterial, u: number, y: number, d: number,
    width: number, height: number, depth: number, collidable = false) {
    const [x, z] = facadePosition(face, u, d);
    const mesh = CreateBox(surface.name, {
      width: face.axis === "x" ? depth : width,
      height,
      depth: face.axis === "x" ? width : depth,
    }, scene);
    mesh.position.set(x, y, z);
    if (collidable) {
      mesh.material = surface;
      mesh.checkCollisions = true;
      shadows.addShadowCaster(mesh);
    } else {
      const group = trim.get(surface) ?? [];
      group.push(mesh);
      trim.set(surface, group);
    }
  }

  function window(face: Face, u: number, y: number, w: number, h: number, surround = cream) {
    box(face, surround, u, y, 0.036, w + 0.18, h + 0.15, 0.10);
    box(face, frames, u, y, 0.085, w, h, 0.061);
    box(face, glazing, u, y, 0.121, w - 0.10, h - 0.10, 0.044);
    box(face, frames, u, y, 0.151, 0.043, h - 0.10, 0.032);
  }

  function sign(id: string, face: Face, u: number, y: number, d: number, w: number, h: number,
    lines: readonly string[], background: string, foreground = "#f3f3ee") {
    const texture = new DynamicTexture(`${id}-procedural-lettering`, { width: 1024, height: 256 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = background;
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = foreground;
    const spacing = 242 / lines.length;
    for (const [index, line] of lines.entries()) {
      const font = "'Nirmala UI', 'Segoe UI', sans-serif";
      const baseSize = spacing * 0.76;
      context.font = `700 ${baseSize}px ${font}`;
      const size = Math.floor(baseSize * Math.min(1, 970 / context.measureText(line).width));
      context.font = `700 ${size}px ${font}`;
      context.fillText(line, (1024 - context.measureText(line).width) / 2, 15 + spacing * (index + 0.70));
    }
    texture.update();
    const surface = material(`${id}-nameplate`, "#ffffff");
    surface.albedoTexture = texture;
    const mesh = CreatePlane(`${id}-nameplate`, { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const [x, z] = facadePosition(face, u, d);
    mesh.position.set(x, y, z);
    mesh.rotation.y = face.axis === "x" ? face.direction * Math.PI / 2 : face.direction === 1 ? 0 : Math.PI;
    mesh.material = surface;
  }

  // Mechanical: the north face of the B48 wing is a provisional photo assignment.
  const mechanical = footprint("B48");
  const mechFront: Face = { axis: "z", edge: mechanical.north, direction: -1 };
  const mechEdge = mechanical.outline.findIndex(([, z], i) => z === mechanical.north
    && mechanical.outline[(i + 1) % mechanical.outline.length][1] === z);
  const mechWest = mechanical.outline[mechEdge][0];
  const mechEast = mechanical.outline[mechEdge + 1][0];
  const mechEntry = mechWest + 8.12;
  const mechRecess = 2.07;
  const mechPortalWidth = 5.45;
  const [mechLeft, mechRight] = [mechEntry - mechPortalWidth / 2, mechEntry + mechPortalWidth / 2];
  const mechBody = mechanical.outline.flatMap((point, i): readonly Point[] => i === mechEdge ? [
    point, [mechLeft, mechanical.north], [mechLeft, mechanical.north + mechRecess],
    [mechRight, mechanical.north + mechRecess], [mechRight, mechanical.north],
  ] : [point]);
  const mechHeight = 7.62;
  const mechTall = 9.39;
  const mechApron = rectangle(mechEntry - 3.15, mechanical.north - 8.9, mechEntry + 3.15, mechanical.north + mechRecess);
  volume("B48-entrance-approach", mechApron, -0.03, 0.028, entryConcrete, false);
  for (let step = 0; step < 3; step++) {
    volume("B48-entrance-step", rectangle(mechLeft, mechanical.north + 0.28 * step, mechRight,
      mechanical.north + mechRecess), 0, 0.08 + 0.07 * step, maroon, false);
  }
  volume("B48", mechBody, 0, mechHeight, cream);
  volume("B48-roof", mechanical.outline, mechHeight, mechHeight + 0.13, roof, false);
  volume("B48-tall-window-block", rectangle(mechRight, mechanical.north, mechEast, mechanical.north + 5.65),
    mechHeight, mechTall, cream);
  const tallWidth = mechEast - mechRight;
  box(mechFront, maroon, (mechRight + mechEast) / 2, mechTall, 0, tallWidth, 0.16, 0.25);
  box(mechFront, maroon, (mechWest + mechLeft) / 2, mechHeight, 0, mechLeft - mechWest, 0.16, 0.24);
  for (const x of [mechRight + tallWidth * 0.27, mechRight + tallWidth * 0.72]) {
    box(mechFront, frames, x, 4.25, 0.034, 1.91, 5.68, 0.074);
    for (let pane = 0; pane < 6; pane++) {
      box(mechFront, pane % 4 === 0 ? blueLight : blue, x, 1.49 + (pane + 0.5) * 0.923,
        0.081, 1.79, 0.897, 0.045);
    }
  }
  const mechInner: Face = { ...mechFront, edge: mechanical.north + mechRecess };
  window(mechInner, mechEntry, 5.3, 2.35, 1.62, white);
  box(mechInner, entrance, mechEntry, 1.4, 0.07, 2.63, 2.75, 0.12);
  box(mechFront, cream, mechEntry, 6.79, -mechRecess / 2, mechPortalWidth, 0.81, mechRecess, true);
  box(mechFront, maroon, mechEntry, 7.21, 0.024, mechPortalWidth + 0.11, 0.14, 0.20);
  box(mechFront, cream, mechEntry, 3.56, -mechRecess / 2, mechPortalWidth, 0.59, mechRecess, true);
  box(mechFront, maroon, mechEntry, 3.88, 0.029, mechPortalWidth + 0.09, 0.13, 0.21);
  sign("B48", mechFront, mechEntry, 3.56, 0.082, mechPortalWidth - 0.27, 0.78,
    ["यांत्रिक अभियांत्रिकी विभाग", "MECHANICAL ENGINEERING DEPARTMENT"], "#303942");
  for (const y of [1.71, 5.32]) {
    const x = (mechWest + mechLeft) / 2;
    window(mechFront, x, y, 1.76, 1.43);
    box(mechFront, maroon, x, y + 0.89, 0.15, 2.57, 0.115, 0.29);
  }

  // The TNP-facing approach identifies the south wing of the Mechanical complex.
  const southWing = campusAccess.mechanicalEntrance.outline.map(annotationToWorld);
  const [southEntry, southFaceZ] = annotationToWorld(campusAccess.mechanicalEntrance.position);
  const southFront: Face = { axis: "z", edge: southFaceZ, direction: 1 };
  const southHeight = 6.45;
  const southWidth = 10.5;
  volume("mechanical-south-wing", southWing, 0, southHeight, cream);
  volume("mechanical-south-roof", southWing, southHeight, southHeight + 0.15, roof, false);
  volume("mechanical-south-connector", campusAccess.mechanicalEntrance.link.map(annotationToWorld), 2.96, 3.33, cream);
  volume("mechanical-south-threshold", rectangle(southEntry - 4.7, southFaceZ, southEntry + 4.7, southFaceZ + 3.52),
    -0.02, 0.052, entryConcrete, false);
  const towerCenter = southEntry - 9.8;
  volume("mechanical-south-tower", rectangle(towerCenter - 3.55, southFaceZ - 4.2, towerCenter + 3.55, southFaceZ),
    southHeight, 8.45, cream);
  box(southFront, maroon, towerCenter, 8.42, 0.049, 7.12, 0.18, 0.22);
  for (const x of [towerCenter - 1.64, towerCenter + 1.64]) {
    box(southFront, frames, x, 4.2, 0.036, 1.7, 5.45, 0.08);
    for (let pane = 0; pane < 6; pane++) {
      box(southFront, pane % 3 ? blue : blueLight, x, 1.53 + 0.894 * pane,
        0.095, 1.58, 0.86, 0.05);
    }
  }
  box(southFront, entrance, southEntry, 1.39, 0.09, 3.1, 2.77, 0.12);
  box(southFront, cream, southEntry, 3.53, 1.1, southWidth, 0.32, 2.54, true);
  box(southFront, maroon, southEntry, 3.79, 1.18, southWidth + 0.12, 0.15, 2.61);
  for (const sign of [-1, 1]) {
    box(southFront, cream, southEntry + sign * 4.62, 1.69, 2.13, 0.41, 3.38, 0.46, true);
  }
  sign("mechanical-south", southFront, southEntry, 3.46, 2.51, 9.8, 0.77,
    ["यांत्रिक अभियांत्रिकी विभाग", "MECHANICAL ENGINEERING DEPARTMENT"], "#303942");
  for (const [step, depth] of [1.32, 0.96, 0.6].entries()) {
    const height = 0.105 * (step + 1);
    box(southFront, maroon, southEntry, height / 2, depth / 2, 5.9, height, depth);
  }
  for (const y of [1.74, 4.92]) window(southFront, southEntry + 10.3, y, 2.28, 1.48);

  // Civil Block 1: the B74 southern roof projection defines the open tower.
  const civil = footprint("B74");
  const civilWing = footprint("B73");
  const civilFront: Face = { axis: "z", edge: civil.south, direction: 1 };
  const towerStart = civil.outline.findIndex(([, z]) => z === civil.south);
  const tower = civil.outline.slice(towerStart - 1, towerStart + 3);
  const civilWest = Math.min(...tower.map(([x]) => x));
  const civilEast = Math.max(...tower.map(([x]) => x));
  const bladeEdge = civilWest + (civilEast - civilWest) * 0.47;
  const portalWidth = civilEast - bladeEdge;
  const portalCenter = (bladeEdge + civilEast) / 2;
  const [towerEastBack, towerWestBack] = [tower[0][1], tower[tower.length - 1][1]];
  const towerBack = Math.max(towerEastBack, towerWestBack);
  const civilHeight = 7.35;
  const towerHeight = 11.42;
  const civilBody = civil.outline.filter(([, z]) => z !== civil.south);
  volume("B74-paved-approach", rectangle(portalCenter - 2.08, towerBack, portalCenter + 2.08, civil.south + 10.5),
    -0.03, 0.047, civilPavers, false);
  volume("B74", civilBody, 0, civilHeight, brick);
  volume("B74-wing-roof", civilBody, civilHeight, civilHeight + 0.13, roof, false);
  volume("B73", civilWing.outline, 0, civilHeight - 0.32, brick);
  volume("B73-wing-roof", civilWing.outline, civilHeight - 0.32, civilHeight - 0.18, roof, false);
  volume("B74-brick-blade", [[civilWest, towerWestBack],
    [bladeEdge, towerWestBack + (towerEastBack - towerWestBack) * 0.47],
    [bladeEdge, civil.south], [civilWest, civil.south]], 0, towerHeight, brick);
  volume("B74-entrance-tower-roof", tower, towerHeight - 0.16, towerHeight + 0.16, sandstone, false);
  for (const x of [bladeEdge + 0.28, civilEast - 0.26]) {
    for (const d of [-0.27, towerBack - civil.south + 0.34]) {
      box(civilFront, sandstone, x, towerHeight / 2, d, 0.48, towerHeight, 0.49, true);
    }
  }
  for (const [y, height, depth] of [[3.93, 1.31, 2.35], [7.55, 0.94, 2.15], [10.66, 0.64, 1.48]]) {
    box(civilFront, sandstone, portalCenter, y, -depth / 2, portalWidth, height, depth, true);
  }
  const civilInner: Face = { ...civilFront, edge: towerBack };
  box(civilInner, entrance, portalCenter, 1.53, 0.086, portalWidth - 0.28, 3.03, 0.15);
  box(civilFront, sandstone, civilWest + 1.18, 0.48, 0.68, 1.72, 0.86, 0.42);
  sign("B74-plaque", civilFront, civilWest + 1.18, 0.53, 0.901, 1.43, 0.51,
    ["CIVIL ENGINEERING", "BLOCK I"], "#454537", "#e0c696");
  sign("B74", civilFront, portalCenter, 3.98, 0.037, portalWidth - 0.28, 0.85,
    ["सिविल इंजी. विभाग  •  ब्लॉक १", "CIVIL ENGINEERING BLOCK 1"], "#e3e3dc", "#254e76");
  const civilSide: Face = { axis: "z", edge: Math.max(...civilBody.map(([, z]) => z)), direction: 1 };
  for (const x of [-103.5, -97.6, -91.7, -85.8]) {
    box(civilSide, sandstone, x, civilHeight / 2, 0.07, 0.32, civilHeight, 0.21);
    window(civilSide, x + 1.98, 4.95, 2.65, 1.48, sandstone);
  }

  // Block II uses the same brick and cream vocabulary. Its entrance treatment is illustrative.
  const civilTwoWest = footprint("B28");
  const civilTwoEast = footprint("B29");
  const civilTwoFront: Face = { axis: "z", edge: civilTwoWest.south, direction: 1 };
  const join = Math.max(...civilTwoWest.outline.filter(([, z]) => z === civilTwoFront.edge).map(([x]) => x));
  const leftEnd = Math.min(...civilTwoWest.outline.map(([x]) => x));
  const rightEnd = Math.max(...civilTwoEast.outline.map(([x]) => x));
  const entryHalfWidth = 2.65;
  const entryBack = civilTwoFront.edge - 2.3;
  const lintelBottom = 3.52;
  const westernBase = civilTwoWest.outline.flatMap((point): readonly Point[] =>
    point[0] === join && point[1] === civilTwoFront.edge
      ? [[join, entryBack], [join - entryHalfWidth, entryBack], [join - entryHalfWidth, civilTwoFront.edge]]
      : [point]);
  const easternBase = civilTwoEast.outline.flatMap((point): readonly Point[] =>
    point[0] === join && point[1] === civilTwoFront.edge
      ? [[join + entryHalfWidth, civilTwoFront.edge], [join + entryHalfWidth, entryBack], [join, entryBack]]
      : [point]);

  for (const [wing, base, height] of [[civilTwoWest, westernBase, 7.18], [civilTwoEast, easternBase, 7.71]] as const) {
    const id = wing.source.id;
    volume(id, base, 0, lintelBottom, brick);
    volume(`${id}-upper-wing`, wing.outline, lintelBottom, height, brick);
    volume(`${id}-roof`, wing.outline, height, height + 0.14, roof, false);
  }

  // The aerial shows a straight path through the lawn south of the shared building edge.
  volume("B28-B29-paved-approach", rectangle(join - 1.84, entryBack, join + 1.84, civilTwoFront.edge + 16.5),
    -0.03, 0.043, civilPavers, false);
  const civilTwoInner: Face = { ...civilTwoFront, edge: entryBack };
  box(civilTwoInner, entrance, join, 1.46, 0.075, 3.12, 2.92, 0.14);
  box(civilTwoFront, sandstone, join, 4.13, 0.04, entryHalfWidth * 2 + 0.57, 1.26, 0.21);
  for (const side of [-1, 1]) {
    box(civilTwoFront, sandstone, join + side * (entryHalfWidth + 0.17), 3.45, 0.04, 0.49, 6.9, 0.20);
    window(civilTwoFront, join + side * 1.1, 5.75, 1.43, 1.46, sandstone);
  }
  sign("B28-B29", civilTwoFront, join, 4.15, 0.158, 4.46, 0.87,
    ["सिविल इंजी. विभाग  •  ब्लॉक २", "CIVIL ENGINEERING BLOCK II"], "#e3e3dc", "#254e76");

  for (const [start, end] of [[leftEnd + 1.55, join - entryHalfWidth - 1.22],
    [join + entryHalfWidth + 1.22, rightEnd - 1.55]]) {
    const bays = Math.max(1, Math.floor((end - start) / 5.15));
    const pitch = (end - start) / bays;
    box(civilTwoFront, sandstone, (start + end) / 2, 3.34, 0.071, end - start, 0.22, 0.22);
    for (let i = 0; i < bays; i++) {
      const x = start + pitch * (i + 0.5);
      window(civilTwoFront, x, 1.83, 2.41, 1.42, sandstone);
      window(civilTwoFront, x, 5.05, 2.41, 1.42, sandstone);
    }
  }

  // ITCA uses the photographed north porch. ITRC occupies the southern portion of the traced site.
  const it = footprint("B24");
  const porch = it.outline.filter(([, z]) => z === it.north);
  const [, itSplitZ] = annotationToWorld([0, itCampusSplitRow]);
  const itWalls = it.outline.filter(([, z]) => z !== it.north);
  const itBody: Point[] = [];
  for (const [index, [x, z]] of itWalls.entries()) {
    const [nextX, nextZ] = itWalls[(index + 1) % itWalls.length];
    if (z <= itSplitZ) itBody.push([x, z]);
    if ((z <= itSplitZ) !== (nextZ <= itSplitZ)) {
      const t = (itSplitZ - z) / (nextZ - z);
      itBody.push([x + t * (nextX - x), itSplitZ]);
    }
  }
  const itWall: Face = { axis: "z", edge: Math.min(...itBody.map(([, z]) => z)), direction: -1 };
  const itPorchDepth = itWall.edge - it.north;
  const itPorchWidth = porch[1][0] - porch[0][0];
  const itCenter = (porch[0][0] + porch[1][0]) / 2;
  const itHeight = 6.65;
  volume("B24", itBody, 0, itHeight, peach);
  volume("B24-roof", itBody, itHeight, itHeight + 0.14, roof, false);
  volume("B24-entrance-bay-roof", rectangle(itCenter - 6.65, itWall.edge, itCenter + 6.65, itWall.edge + 6.15),
    itHeight, itHeight + 1.54, peach);
  for (const side of [-1, 1]) {
    box(itWall, white, itCenter + side * 6.69, (itHeight + 1.54) / 2, 0.047, 0.39, itHeight + 1.54, 0.18);
    for (const y of [1.65, 5.42]) {
      const x = itCenter + side * 4.75;
      window(itWall, x, y, 1.34, 1.38, white);
      box(itWall, terracotta, x, y + 0.89, 0.13, 1.77, 0.10, 0.26);
    }
  }
  for (const x of [itCenter - 14.15, itCenter - 10.75, itCenter + 10.4, itCenter + 15.0]) {
    window(itWall, x, 1.78, 1.34, 1.38, white);
    window(itWall, x, 5.1, 1.34, 1.38, white);
  }
  window(itWall, itCenter, 5.17, 2.63, 1.51, white);
  box(itWall, entrance, itCenter, 1.43, 0.075, 2.93, 2.86, 0.17);
  box(itWall, white, itCenter, 3.45, itPorchDepth / 2, itPorchWidth, 0.36, itPorchDepth, true);
  for (const offset of [-0.44, -0.36, 0.36, 0.44]) {
    box(itWall, white, itCenter + itPorchWidth * offset, 1.68, itPorchDepth - 0.30, 0.38, 3.36, 0.38, true);
  }
  for (const [i, depth] of [1.39, 1.01, 0.64].entries()) {
    const h = (i + 1) * 0.11;
    box(itWall, terracotta, itCenter, h / 2, itPorchDepth - 1.39 + depth / 2,
      itPorchWidth - 0.06, h, depth, true);
  }
  box(itWall, white, itCenter, 3.88, itPorchDepth - 0.09, itPorchWidth - 0.16, 0.96, 0.18);
  sign("B24", itWall, itCenter, 3.88, itPorchDepth + 0.027, itPorchWidth - 0.25, 0.92,
    ["सूचना प्रौद्योगिकी एवं संगणक अनुप्रयोग विभाग", "DEPARTMENT OF INFORMATION TECHNOLOGY", "COMPUTER APPLICATION"], "#2e6d90");

  for (const [surface, pieces] of trim) {
    const mesh = Mesh.MergeMeshes(pieces, true, true);
    if (!mesh) continue;
    mesh.name = `${surface.name}-trim`;
    mesh.material = surface;
  }
}
