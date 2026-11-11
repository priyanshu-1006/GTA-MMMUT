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
import { annotationToWorld, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";
import { academicFrontages, lectureEntranceWidth } from "./academic-frontages";

export { academicFrontages } from "./academic-frontages";

type Frontage = (typeof academicFrontages)[keyof typeof academicFrontages];

export function createReferencedAcademicFacades(scene: Scene, shadows: ShadowGenerator) {
  const batches = new Map<PBRMaterial, Mesh[]>();

  function finish(name: string, hex: string, roughness = 0.88) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    material.roughness = roughness;
    material.metallic = 0;
    batches.set(material, []);
    return material;
  }

  const stone = finish("academic-entry-stone", "#c8bba2");
  const pavement = finish("academic-entry-paving", "#a79e8e");
  const plaster = finish("academic-front-cream-plaster", "#d8c9a5");
  const pale = finish("academic-lecture-plaster", "#ded4bd");
  const peach = finish("pushpagiri-peach-plaster", "#ddbea9");
  const electricalRed = finish("electrical-oxide-wall", "#a15648");
  const charcoal = finish("academic-entry-charcoal-metal", "#30393b");
  const reveal = finish("academic-entry-dark-reveal", "#515654");
  const windowGlass = finish("academic-grille-glass", "#7b8580", 0.43);
  const tubeLight = finish("academic-entry-tube-light", "#eee2c3");
  tubeLight.emissiveColor = Color3.FromHexString("#b3a78f").toLinearSpace();
  const roofBlue = finish("academic-entry-blue-roof", "#607c93");
  const roofNeutral = finish("academic-entry-concrete-roof", "#a09a89");
  const brick = finish("ece-red-brick", "#ffffff");

  const brickTexture = new DynamicTexture("ece-brick-course", { width: 512, height: 512 }, scene, true);
  const brickCanvas = brickTexture.getContext();
  brickCanvas.fillStyle = "#643b32";
  brickCanvas.fillRect(0, 0, 512, 512);
  const brickPalette = ["#a04b3c", "#a75546", "#9f5044", "#90483d", "#ad5544"];
  for (let row = 0; row < 22; row++) {
    for (let column = -1; column < 8; column++) {
      const x = column * 64 + (row % 2) * 32;
      const y = row * 24;
      brickCanvas.fillStyle = brickPalette[(row * 7 + column + 1) % brickPalette.length];
      brickCanvas.fillRect(x + 1.5, y + 1.5, 61, 21);
      brickCanvas.fillStyle = "#bb6855";
      brickCanvas.fillRect(x + 1.5, y + 1.5, 61, 1.4);
    }
  }
  brickTexture.update();
  brick.albedoTexture = brickTexture;

  function addSolid(mesh: Mesh, material: PBRMaterial, castsShadow = true) {
    mesh.material = material;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    if (castsShadow) shadows.addShadowCaster(mesh);
    return mesh;
  }

  function box(material: PBRMaterial, name: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, collidable = false) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    if (collidable) return addSolid(mesh, material);
    batches.get(material)!.push(mesh);
    return mesh;
  }

  function panel(frontage: Frontage, material: PBRMaterial, offset: number, y: number, projection: number,
    width: number, height: number, depth: number, collidable = false) {
    const [x, z] = frontage.door;
    return box(material, `${frontage.buildingId}-${material.name}`, x + offset, y,
      z + frontage.outward * projection, width, height, depth, collidable);
  }

  function volume(name: string, outline: readonly WorldGroundPoint[], bottom: number, top: number,
    material: PBRMaterial, collidable: boolean) {
    const polygon = outline.map(([x, z]) => new Vector2(x, z));
    const area = polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point.x * next.y - point.y * next.x;
    }, 0);
    if (area < 0) polygon.reverse();
    const mesh = new PolygonMeshBuilder(name, polygon, scene, earcut).build(false, top - bottom);
    mesh.position.y = top;
    if (collidable) addSolid(mesh, material);
    else batches.get(material)!.push(mesh);
  }

  function recessedBuilding(frontage: Frontage, width: number, depth: number, opening: number,
    height: number, material: PBRMaterial, roof: PBRMaterial) {
    const building = campusBuildings.find(({ id }) => id === frontage.buildingId)!;
    const outline = building.footprint.map(annotationToWorld);
    const [x, z] = frontage.door;
    const left = x - width / 2;
    const right = x + width / 2;
    const back = z - frontage.outward * depth;
    const recess = outline.flatMap((start, index): WorldGroundPoint[] => {
      const end = outline[(index + 1) % outline.length];
      if (start[1] !== z || end[1] !== z || Math.min(start[0], end[0]) > left ||
        Math.max(start[0], end[0]) < right) return [start];
      const [first, second] = start[0] < end[0] ? [left, right] : [right, left];
      return [start, [first, z], [first, back], [second, back], [second, z]];
    });
    volume(building.id, recess, 0, height, material, true);
    volume(`${building.id}-entry-overhead`, [[left, z], [left, back], [right, back], [right, z]],
      opening, height, material, true);
    volume(`${building.id}-roof`, outline, height, height + 0.15, roof, false);
  }

  function sign(frontage: Frontage, offset: number, y: number, projection: number, width: number, height: number,
    background: string, lines: readonly string[], crests = false) {
    const texture = new DynamicTexture(`${frontage.buildingId}-entrance-sign-${y}`,
      { width: 1024, height: 256 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = background;
    context.fillRect(0, 0, 1024, 256);
    context.strokeStyle = "#c0b9a5";
    context.lineWidth = 4;
    context.strokeRect(5, 5, 1014, 246);
    context.fillStyle = "#f3f1df";
    const lineHeight = 214 / lines.length;
    const fontSize = Math.min(76, lineHeight * 0.79);
    const maxWidth = crests ? 824 : 970;
    for (const [index, line] of lines.entries()) {
      context.font = `bold ${fontSize}px "Nirmala UI", "Segoe UI", sans-serif`;
      const lineWidth = Math.min(maxWidth, context.measureText(line).width);
      context.fillText(line, (1024 - lineWidth) / 2, 21 + (index + 0.5) * lineHeight + fontSize * 0.32, maxWidth);
    }
    if (crests) {
      for (const cx of [61, 963]) {
        context.beginPath();
        context.arc(cx, 60, 37, 0, Math.PI * 2);
        context.fillStyle = "#e1edeb";
        context.fill();
        context.lineWidth = 6;
        context.strokeStyle = "#6c9fae";
        context.stroke();
        context.font = 'bold 16px "Segoe UI", sans-serif';
        context.fillStyle = "#294856";
        context.fillText("MMMUT", cx - context.measureText("MMMUT").width / 2, 66);
      }
    }
    texture.update();
    const material = new PBRMaterial(`${frontage.buildingId}-entrance-lettering-${y}`, scene);
    material.albedoTexture = texture;
    material.unlit = true;
    const plate = CreatePlane(`${frontage.buildingId}-entrance-sign`, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const [x, z] = frontage.door;
    plate.position.set(x + offset, y, z + frontage.outward * projection);
    plate.rotation.y = frontage.outward === 1 ? 0 : Math.PI;
    plate.material = material;
  }

  function griddedWindow(frontage: Frontage, offset: number, width: number, height: number, y: number) {
    panel(frontage, charcoal, offset, y, 0.071, width + 0.13, height + 0.12, 0.142);
    panel(frontage, windowGlass, offset, y, 0.15, width, height, 0.05);
    const columns = Math.round(width / 0.27);
    const rows = Math.round(height / 0.27);
    for (let column = 1; column < columns; column++) {
      const x = offset - width / 2 + width * column / columns;
      panel(frontage, charcoal, x, y, 0.189, column % 4 ? 0.022 : 0.06, height, 0.029);
    }
    for (let row = 1; row < rows; row++) {
      const level = y - height / 2 + height * row / rows;
      panel(frontage, charcoal, offset, level, 0.19, width, row % 4 ? 0.023 : 0.063, 0.03);
    }
  }

  function doorFrame(frontage: Frontage, width: number, height: number, jamb: PBRMaterial) {
    for (const side of [-1, 1]) {
      panel(frontage, jamb, side * (width / 2 + 0.085), height / 2, 0.1, 0.17, height, 0.205);
    }
    panel(frontage, jamb, 0, height + 0.09, 0.1, width + 0.34, 0.18, 0.205);
  }

  function apron(frontage: Frontage, width: number, reach: number) {
    panel(frontage, pavement, 0, 0.022, reach / 2, width, 0.046, reach);
  }

  const takshashila = academicFrontages.takshashila;
  const pushpagiri = academicFrontages.pushpagiri;
  const pushpagiriHeight = campusBuildings.find(({ id }) => id === pushpagiri.buildingId)!.height;
  recessedBuilding(pushpagiri, lectureEntranceWidth, 3.05, 3.02, pushpagiriHeight, peach, roofBlue);
  for (const { front, name, hindi, wall, signColor, reach } of [
    { front: takshashila, name: "Takshashila Lecture Hall Complex", hindi: "तक्षशिला व्याख्यान भवन",
      wall: pale, signColor: "#293d52", reach: 5.45 },
    { front: pushpagiri, name: "Pushpagiri Lecture Hall Complex", hindi: "पुष्पागिरि व्याख्यान भवन",
      wall: peach, signColor: "#3c3050", reach: 7.45 },
  ]) {
    for (const side of [-1, 1]) {
      panel(front, wall, side * 3.16, 1.64, 0.032, 3.28, 3.28, 0.11);
      griddedWindow(front, side * 3.04, 2.58, 2.30, 1.69);
    }
    panel(front, wall, 0, 3.46, 0.043, 9.56, 0.48, 0.15);
    doorFrame(front, lectureEntranceWidth, 2.76, charcoal);
    panel(front, charcoal, 0, 3.11, 0.16, 3.52, 0.68, 0.08);
    sign(front, 0, 3.11, 0.206, 3.52, 0.68, signColor, [name, hindi]);
    apron(front, 3.30, reach);
  }
  // The Pushpagiri entry opens onto a shallow plaster lobby with its inner door.
  panel(pushpagiri, reveal, -0.68, 1.16, -3.026, 0.83, 2.32, 0.04);
  panel(pushpagiri, windowGlass, -0.68, 2.48, -3.006, 0.83, 0.28, 0.043);
  panel(pushpagiri, stone, 0.75, 1.72, -3.02, 0.72, 0.46, 0.054);
  panel(pushpagiri, pavement, 0, 0.018, -1.525, 2.98, 0.04, 3.05);
  panel(pushpagiri, tubeLight, 0, 2.96, -1.45, 1.11, 0.04, 0.095);
  for (const projection of [-1.6, -5.4, -9.2, -12]) {
    panel(takshashila, charcoal, 0, 2.985, projection, 1.38, 0.045, 0.14);
    panel(takshashila, tubeLight, 0, 2.949, projection, 1.26, 0.03, 0.095);
  }

  const ece = academicFrontages.ece;
  recessedBuilding(ece, 2.46, 1.95, 2.93, 6.3, plaster, roofNeutral);
  doorFrame(ece, 2.46, 2.66, reveal);
  panel(ece, plaster, 0, 2.91, 0.20, 3.04, 0.28, 0.44);
  panel(ece, reveal, 0, 1.14, -1.922, 2.30, 2.28, 0.05);
  panel(ece, brick, 4.58, 3.02, 0.16, 6.18, 6.04, 0.34);
  panel(ece, charcoal, 4.58, 4.27, 0.366, 6.07, 1.42, 0.09);
  sign(ece, 4.58, 4.27, 0.416, 6.07, 1.42, "#222a2c", [
    "विद्युतकण एवं संचार अभियन्त्रण विभाग",
    "ELECTRONICS & COMMUNICATION",
    "ENGINEERING DEPARTMENT",
  ], true);
  for (const offset of [-3.50, 9.65]) griddedWindow(ece, offset, 1.3, 1.5, 4.46);
  panel(ece, stone, 4.58, 0.19, 0.36, 6.18, 0.37, 0.29);
  apron(ece, 2.95, 4.75);

  const electrical = academicFrontages.electrical;
  recessedBuilding(electrical, 2.36, 1.4, 2.73, 3.86, electricalRed, roofNeutral);
  const electricalLeft = annotationToWorld([1035, 320])[0] - electrical.door[0];
  const electricalRight = annotationToWorld([1121, 320])[0] - electrical.door[0];
  for (const [left, right] of [[electricalLeft, -1.58], [1.58, electricalRight]]) {
    panel(electrical, plaster, (left + right) / 2, 2.39, 0.06, right - left, 0.81, 0.13);
  }
  for (const side of [-1, 1]) {
    panel(electrical, plaster, side * 1.36, 1.99, 0.12, 0.38, 3.98, 0.24);
  }
  panel(electrical, plaster, 0, 3.86, 0.105, 3.13, 0.36, 0.22);
  panel(electrical, reveal, 0, 1.17, -1.36, 2.34, 2.34, 0.08);
  doorFrame(electrical, 2.36, 2.40, charcoal);
  for (let slat = -7; slat <= 7; slat++) {
    panel(electrical, charcoal, slat * 0.156, 1.18, 0.065, 0.041, 2.34, 0.105);
  }
  for (const y of [0.27, 1.26, 2.22]) panel(electrical, charcoal, 0, y, 0.13, 2.36, 0.068, 0.09);
  panel(electrical, charcoal, 0, 1.19, 0.092, 0.084, 2.38, 0.12);
  const gateCollider = CreateBox("B32-closed-grille-collider", { width: 2.36, height: 2.4, depth: 0.105 }, scene);
  gateCollider.position.set(electrical.door[0], 1.2, electrical.door[1] + 0.065);
  gateCollider.material = charcoal;
  gateCollider.checkCollisions = true;
  gateCollider.isVisible = false;
  gateCollider.isPickable = false;
  panel(electrical, charcoal, 0, 2.86, 0.18, 2.93, 0.9, 0.10);
  sign(electrical, 0, 2.86, 0.236, 2.93, 0.9, "#283e3b", [
    "विद्युत अभियन्त्रण विभाग",
    "ELECTRICAL ENGINEERING",
    "DEPARTMENT",
  ]);
  panel(electrical, stone, 4.30, 0.63, 4.55, 3.0, 1.25, 0.42, true);
  sign(electrical, 4.30, 0.82, 4.765, 2.69, 0.76, "#39352a", [
    "विद्युत अभियन्त्रण विभाग", "ELECTRICAL ENGINEERING", "ESTABLISHED 1962",
  ]);
  apron(electrical, 3.55, 3.2);

  for (const [material, parts] of batches) {
    if (!parts.length) continue;
    const mesh = Mesh.MergeMeshes(parts, true, true);
    if (!mesh) continue;
    mesh.name = material.name;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
  }
}
