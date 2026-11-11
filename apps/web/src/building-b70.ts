import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { adminCoreBuildings } from "@gta-mmmut/world-data/admin-core";
import earcut from "earcut";

type Point = readonly [x: number, z: number];

export function createB70Facade(scene: Scene, shadows: ShadowGenerator): void {
  const building = adminCoreBuildings.find(({ id }) => id === "B70");
  if (!building) return;

  const footprint = building.footprint.map(annotationToWorld);
  const northZ = Math.min(...footprint.map(([, z]) => z));
  const southZ = Math.max(...footprint.map(([, z]) => z));
  const frontX = Math.max(...footprint.filter(([, z]) => z === northZ).map(([x]) => x));
  const curveStart = footprint.findIndex(([x]) => x > frontX);
  const curveEnd = footprint.findIndex(([x], i) => i > curveStart && x === frontX);
  const curve = footprint.slice(curveStart - 1, curveEnd + 1);
  const [northJoin, southJoin] = [curve[0][1], curve[curve.length - 1][1]];
  const entryZ = (northJoin + southJoin) / 2;
  const arcSpan = southJoin - northJoin;
  const arcDepth = Math.max(...curve.map(([x]) => x)) - frontX;

  // Photo-proportioned elevations over the provisional footprint. No measured heights or floors.
  const wingHeight = building.height * 1.62;
  const drumTop = wingHeight * 1.18;
  const soffit = wingHeight * 0.71;
  const glassBottom = soffit + 0.60;
  const glassTop = drumTop - 0.79;

  function material(name: string, hex: string, roughness = 0.91) {
    const surface = new PBRMaterial(`B70-${name}`, scene);
    surface.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    surface.roughness = roughness;
    surface.metallic = 0;
    return surface;
  }

  const plaster = material("cream-wall", "#dfd3ba");
  const stone = material("warm-stone", "#c99d74");
  const brick = material("brick", "#996c50");
  const band = material("clay-bands", "#89634f");
  const roof = material("roof", "#b1a79b");
  const domes = material("pale-domes", "#f2ead9");
  const frames = material("glazing-frames", "#293d4d");
  const glass = material("blue-glazing", "#284d74", 0.35);
  const lighterGlass = material("blue-glazing-light", "#355d83", 0.32);
  const screen = material("jali-screen", "#ffffff");

  const brickTexture = new DynamicTexture("B70-procedural-masonry", 256, scene, true);
  const brickContext = brickTexture.getContext();
  brickContext.fillStyle = "#9b7860";
  brickContext.fillRect(0, 0, 256, 256);
  const brickPalette = ["#a27657", "#9a6f52", "#a57d60", "#987157", "#ab7d5d"];
  for (let row = 0; row < 48; row++) {
    for (let col = -1; col < 16; col++) {
      brickContext.fillStyle = brickPalette[(row * 7 + (col + 1) * 3) % brickPalette.length];
      brickContext.fillRect(col * 16 + (row % 2) * 8 + 0.5, row * 256 / 48 + 0.5, 15, 4.45);
    }
  }
  brickTexture.update();
  brick.albedoColor = Color3.White();
  brick.albedoTexture = brickTexture;

  const screenTexture = new DynamicTexture("B70-procedural-jali", { width: 128, height: 256 }, scene, true);
  const screenContext = screenTexture.getContext();
  screenContext.fillStyle = "#e3d9c2";
  screenContext.fillRect(0, 0, 128, 256);
  screenContext.fillStyle = "#9c978a";
  for (let y = 4; y < 256; y += 8) {
    for (let x = 4; x < 128; x += 8) {
      screenContext.beginPath();
      screenContext.moveTo(x - 2.5, y);
      screenContext.lineTo(x, y - 2.5);
      screenContext.lineTo(x + 2.5, y);
      screenContext.lineTo(x, y + 2.5);
      screenContext.fill();
    }
  }
  screenTexture.update();
  screen.albedoTexture = screenTexture;

  const details = new Map<PBRMaterial, Mesh[]>();
  function detail(mesh: Mesh, surface: PBRMaterial) {
    const group = details.get(surface) ?? [];
    group.push(mesh);
    details.set(surface, group);
    return mesh;
  }

  function extrude(name: string, shape: readonly Point[], bottom: number, top: number, surface: PBRMaterial) {
    const builder = new PolygonMeshBuilder(name, shape.map(([x, z]) => new Vector2(x, z)), scene, earcut);
    const volume = builder.build(false, top - bottom);
    volume.position.y = top;
    volume.material = surface;
    volume.receiveShadows = true;
    return volume;
  }

  function frontBox(surface: PBRMaterial, z: number, y: number, width: number, height: number, projection: number) {
    const mesh = CreateBox(surface.name, { width: projection + 0.04, height, depth: width }, scene);
    mesh.position.set(frontX + (projection - 0.04) / 2, y, z);
    return detail(mesh, surface);
  }

  function arch(surface: PBRMaterial, z: number, bottom: number, width: number, height: number, projection: number) {
    const radius = width / 2;
    const spring = height - radius;
    const outline = [[-radius, 0], [radius, 0], [radius, spring]];
    for (let i = 1; i <= 14; i++) {
      const angle = Math.PI * i / 14;
      outline.push([radius * Math.cos(angle), spring + radius * Math.sin(angle)]);
    }
    const data = new VertexData();
    data.positions = outline.flatMap(([u, v]) => [frontX + projection, bottom + v, z + u]);
    data.normals = outline.flatMap(() => [1, 0, 0]);
    data.uvs = outline.flatMap(([u, v]) => [u / width + 0.5, v / height]);
    data.indices = earcut(outline.flat(), undefined, 2);
    const mesh = new Mesh(surface.name, scene);
    data.applyToMesh(mesh);
    detail(mesh, surface);
  }

  function glazedArch(z: number, bottom: number, width: number, height: number) {
    arch(frames, z, bottom, width, height, 0.17);
    arch(glass, z, bottom + 0.10, width - 0.18, height - 0.20, 0.19);
    const mullionHeight = height - width / 2 - 0.15;
    frontBox(frames, z, bottom + 0.1 + mullionHeight / 2, 0.045, mullionHeight, 0.22);
    for (const ratio of [0.26, 0.51, 0.72]) {
      const y = height * ratio;
      const chord = y > height - width / 2
        ? 2 * Math.sqrt((width / 2) ** 2 - (y - height + width / 2) ** 2)
        : width;
      frontBox(frames, z, bottom + y, chord - 0.2, 0.045, 0.22);
    }
  }

  const bodyFootprint = footprint.filter(([x]) => x <= frontX);
  const body = extrude("B70", bodyFootprint, 0, wingHeight, plaster);
  body.checkCollisions = true;
  body.metadata = { name: building.name, footprintStatus: building.footprintStatus };
  shadows.addShadowCaster(body);
  extrude("B70-main-roof", bodyFootprint, wingHeight, wingHeight + 0.15, roof);

  const bayWidths = [0.17, 0.18, 0.43, 0.22];
  for (const [join, end, direction] of [[northJoin, northZ, -1], [southJoin, southZ, 1]]) {
    const length = Math.abs(end - join);
    let start = join;
    for (const [index, ratio] of bayWidths.entries()) {
      const width = length * ratio;
      const middle = start + direction * width / 2;
      const panel = index === 0 || index === 2 ? brick : plaster;
      frontBox(panel, middle, wingHeight / 2, width - 0.028, wingHeight, panel === brick ? 0.13 : 0.065);
      frontBox(panel === brick ? band : stone, middle, wingHeight - 0.12, width, 0.24, 0.15);
      if (index === 0) {
        arch(plaster, middle, wingHeight * 0.15, width * 0.73, wingHeight * 0.70, 0.17);
        arch(screen, middle, wingHeight * 0.16, width * 0.66, wingHeight * 0.68, 0.19);
      } else {
        const openings = index === 2 ? 2 : 1;
        const openingWidth = width / openings;
        for (let i = 0; i < openings; i++) {
          const z = start + direction * openingWidth * (i + 0.5);
          glazedArch(z, wingHeight * 0.16, openingWidth * 0.67, wingHeight * 0.66);
        }
      }
      start += direction * width;
    }
  }

  const underside = extrude("B70-portico-soffit", curve, soffit, glassBottom, band);
  shadows.addShadowCaster(underside);
  extrude("B70-rounded-drum", curve, glassBottom, glassTop, glass);
  extrude("B70-drum-cornice", curve, glassTop, drumTop, band);
  extrude("B70-drum-roof", curve, drumTop, drumTop + 0.12, roof);

  function drumStrip(surface: PBRMaterial, x: number, z: number, y: number, width: number, height: number, angle: number) {
    const strip = CreateBox(surface.name, { width, height, depth: 0.025 }, scene);
    strip.position.set(x, y, z);
    strip.rotation.y = -angle;
    detail(strip, surface);
  }

  const drumHeight = glassTop - glassBottom;
  for (let i = 1; i < curve.length; i++) {
    const [x, z] = curve[i - 1];
    const dx = curve[i][0] - x;
    const dz = curve[i][1] - z;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const skinX = x + dz / length * 0.047;
    const skinZ = z - dx / length * 0.047;
    const panes = Math.round(length / 1.05);
    for (let pane = 0; pane < panes; pane++) {
      const edge = pane / panes;
      const middle = (pane + 0.5) / panes;
      drumStrip(frames, skinX + dx * edge, skinZ + dz * edge, glassBottom + drumHeight / 2, 0.05, drumHeight, angle);
      if ((i + pane) % 3 === 0) {
        drumStrip(lighterGlass, skinX + dx * middle, skinZ + dz * middle, glassBottom + drumHeight / 2,
          length / panes - 0.065, drumHeight - 0.03, angle);
      }
    }
    for (const ratio of [0.36, 0.72]) {
      drumStrip(frames, skinX + dx / 2, skinZ + dz / 2, glassBottom + drumHeight * ratio, length, 0.033, angle);
    }
  }

  const columnParts: Mesh[] = [];
  for (const ratio of [-0.46, -0.23, -0.17, 0.17, 0.23, 0.46]) {
    const z = entryZ + arcSpan * ratio;
    const index = curve.findIndex(([, curveZ]) => curveZ >= z);
    const [[ax, az], [bx, bz]] = [curve[index - 1], curve[index]];
    const x = ax + (bx - ax) * (z - az) / (bz - az) - 0.48;
    const column = CreateCylinder("B70-portico-column", {
      height: soffit, diameterBottom: 0.66, diameterTop: 0.58, tessellation: 14,
    }, scene);
    column.position.set(x, soffit / 2, z);
    columnParts.push(column);
  }
  const columns = Mesh.MergeMeshes(columnParts, true, true);
  if (columns) {
    columns.name = "B70-portico-columns";
    columns.material = stone;
    columns.checkCollisions = true;
    shadows.addShadowCaster(columns);
  }

  for (const side of [-1, 1]) glazedArch(entryZ + side * arcSpan * 0.33, 0.73, 3.4, soffit * 0.73);
  frontBox(frames, entryZ, soffit * 0.43, 5.25, soffit * 0.72, 0.13);
  for (const offset of [-1.7, 0, 1.7]) {
    frontBox(glass, entryZ + offset, soffit * 0.43, 1.61, soffit * 0.70, 0.16);
  }

  const steps: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const stepDepth = 2.20 - i * 0.32;
    const stepHeight = (i + 1) * 0.14;
    const step = CreateBox("B70-entry-step", { width: stepDepth, height: stepHeight, depth: 8.6 }, scene);
    step.position.set(frontX + stepDepth / 2, stepHeight / 2, entryZ);
    steps.push(step);
  }
  const staircase = Mesh.MergeMeshes(steps, true, true);
  if (staircase) {
    staircase.name = "B70-entry-steps";
    staircase.material = band;
    staircase.checkCollisions = true;
    staircase.receiveShadows = true;
  }

  function dome(x: number, z: number, base: number, radius: number, height: number) {
    const cap = CreateSphere("B70-dome", { diameter: 2, slice: 0.5, segments: 22 }, scene);
    cap.position.set(x, base, z);
    cap.scaling.set(radius, height, radius);
    detail(cap, domes);
  }

  dome(frontX + arcDepth * 0.43, entryZ, drumTop + 0.11, arcSpan * 0.19, 2.45);
  for (const z of [northZ + 2.1, northJoin - 1.75, southJoin + 1.75, southZ - 2.1]) {
    const base = CreateCylinder("B70-cupola-base", { height: 0.65, diameter: 1.52, tessellation: 16 }, scene);
    base.position.set(frontX - 1.16, wingHeight + 0.46, z);
    detail(base, band);
    dome(frontX - 1.16, z, wingHeight + 0.78, 0.81, 0.84);
  }

  for (const [surface, pieces] of details) {
    const mesh = Mesh.MergeMeshes(pieces, true, true);
    if (!mesh) continue;
    mesh.name = surface.name;
    mesh.material = surface;
    if (surface === domes) shadows.addShadowCaster(mesh);
  }
}
