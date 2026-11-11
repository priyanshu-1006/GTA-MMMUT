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
import { annotationToWorld, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import earcut from "earcut";
import { academicFrontages, lectureEntranceWidth } from "./academic-frontages";
import { applyMasonryUvs, createMasonryMaterial, type MasonryFinish } from "./masonry-finishes";

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

  function masonry(name: string, hex: string, style: MasonryFinish = "plaster") {
    const material = createMasonryMaterial(scene, name, hex, style);
    batches.set(material, []);
    return material;
  }

  const stone = masonry("academic-entry-stone", "#c8bba2", "stone");
  const pavement = finish("academic-entry-paving", "#a79e8e");
  const plaster = masonry("academic-front-cream-plaster", "#d8c9a5");
  const pale = masonry("academic-lecture-plaster", "#ded4bd");
  const peach = masonry("pushpagiri-peach-plaster", "#ddbea9");
  const electricalRed = masonry("electrical-oxide-wall", "#a15648");
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
  brickTexture.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  brickTexture.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
  brick.albedoTexture = brickTexture;

  function surfaceUvs(mesh: Mesh, material: PBRMaterial) {
    applyMasonryUvs(mesh, material);
    if (material !== brick) return;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const uv: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const along = Math.abs(normals[i]) > Math.abs(normals[i + 2]) ? positions[i + 2] : positions[i];
      uv.push(along / 2.22, (positions[i + 1] + mesh.position.y) / 1.63);
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
  }

  function addSolid(mesh: Mesh, material: PBRMaterial, castsShadow = true) {
    mesh.material = material;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    if (castsShadow) shadows.addShadowCaster(mesh);
    return mesh;
  }

  function box(material: PBRMaterial, name: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, collidable = false, rotation = 0) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    surfaceUvs(mesh, material);
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
    surfaceUvs(mesh, material);
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
    background: string, lines: readonly string[], crests = false, suffix = "entrance-sign") {
    const name = `${frontage.buildingId}-${suffix}`;
    const texture = new DynamicTexture(`${name}-lettering-${y}`,
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
    const material = new PBRMaterial(`${name}-ink-${y}`, scene);
    material.albedoTexture = texture;
    material.unlit = true;
    const plate = CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
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
  const eceRoadside = academicFrontages.eceRoadside;
  const eceHeight = 6.3;
  const eceName = [
    "विद्युतकण एवं संचार अभियन्त्रण विभाग",
    "ELECTRONICS & COMMUNICATION",
    "ENGINEERING DEPARTMENT",
  ];
  recessedBuilding(ece, 2.46, 1.95, 2.93, eceHeight, plaster, roofNeutral);
  doorFrame(ece, 2.46, 2.66, reveal);
  panel(ece, plaster, 0, 2.91, 0.20, 3.04, 0.28, 0.44);
  panel(ece, reveal, 0, 1.21, -1.922, 2.30, 2.42, 0.05);
  panel(ece, charcoal, 0, 1.21, -1.887, 0.058, 2.42, 0.042);
  for (const side of [-1, 1]) panel(ece, stone, side * 0.15, 1.18, -1.85, 0.043, 0.35, 0.038);
  apron(ece, 3.30, 8.2);
  panel(ece, pavement, 0, 0.021, -0.97, 2.46, 0.045, 1.95);
  for (const front of [ece, eceRoadside]) {
    const signY = front === ece ? 4.27 : 3.51;
    panel(front, brick, 4.58, 3.02, 0.16, 6.18, 6.04, 0.34);
    panel(front, charcoal, 4.58, signY, 0.366, 6.07, 1.42, 0.09);
    sign(front, 4.58, signY, 0.416, 6.07, 1.42, "#222a2c", eceName, true,
      front === ece ? "entrance-sign" : "roadside-sign");
    for (const offset of [-3.50, 9.65]) {
      for (const y of [1.82, 4.46]) griddedWindow(front, offset, 1.3, 1.5, y);
    }
    panel(front, stone, 4.58, 0.19, 0.36, 6.18, 0.37, 0.29);
  }
  griddedWindow(eceRoadside, 0, 1.82, 1.46, 1.82);
  griddedWindow(eceRoadside, 0, 1.82, 1.46, 4.46);

  const electrical = academicFrontages.electrical;
  const electricalRoadside = academicFrontages.electricalRoadside;
  const electricalHeight = 3.86;
  const electricalName = ["विद्युत अभियन्त्रण विभाग", "ELECTRICAL ENGINEERING", "DEPARTMENT"];
  recessedBuilding(electrical, 2.36, 1.85, 2.70, electricalHeight, electricalRed, roofNeutral);
  for (const side of [-1, 1]) {
    panel(electrical, plaster, side * 1.36, 1.99, 0.12, 0.38, 3.98, 0.24);
  }
  panel(electrical, plaster, 0, 3.86, 0.105, 3.13, 0.36, 0.22);
  panel(electrical, reveal, 0, 1.17, -1.82, 2.34, 2.34, 0.08);
  doorFrame(electrical, 2.36, 2.40, charcoal);
  for (let slat = -7; slat <= 7; slat++) {
    panel(electrical, charcoal, slat * 0.156, 1.18, -1.58, 0.041, 2.34, 0.105);
  }
  for (const y of [0.27, 1.26, 2.22]) panel(electrical, charcoal, 0, y, -1.51, 2.36, 0.068, 0.09);
  panel(electrical, charcoal, 0, 1.19, -1.55, 0.084, 2.38, 0.12);
  panel(electrical, plaster, 0, 2.94, 0.12, 3.13, 0.98, 0.24);
  panel(electrical, charcoal, 0, 2.94, 0.25, 2.93, 0.9, 0.10);
  sign(electrical, 0, 2.94, 0.307, 2.93, 0.9, "#283e3b", electricalName);
  panel(electrical, stone, -3.50, 0.63, 2.90, 3.0, 1.25, 0.42, true);
  sign(electrical, -3.50, 0.82, 3.115, 2.69, 0.76, "#39352a", [
    "विद्युत अभियन्त्रण विभाग", "ELECTRICAL ENGINEERING", "ESTABLISHED 1962",
  ], false, "dedication-sign");
  apron(electrical, 3.55, 6.8);
  panel(electrical, pavement, 0, 0.021, -0.92, 2.36, 0.045, 1.85);
  panel(electricalRoadside, charcoal, 0, 2.36, 0.17, 3.12, 0.90, 0.10);
  sign(electricalRoadside, 0, 2.36, 0.227, 3.12, 0.90, "#283e3b", electricalName, false, "roadside-sign");

  function finishDepartment(id: string, kind: "ece" | "electrical", height: number, hasEntrances = false) {
    const outline = campusBuildings.find((building) => building.id === id)!.footprint.map(annotationToWorld);
    const electricalWalls = kind === "electrical";
    const wall = electricalWalls ? electricalRed : plaster;
    if (!hasEntrances) {
      volume(id, outline, 0, height, wall, true);
      volume(`${id}-roof`, outline, height, height + 0.15, roofNeutral, false);
    }
    for (const [index, [x, z]] of outline.entries()) {
      const [endX, endZ] = outline[(index + 1) % outline.length];
      const length = Math.hypot(endX - x, endZ - z);
      const dx = (endX - x) / length;
      const dz = (endZ - z) / length;
      const front = (hasEntrances ? (electricalWalls ? [electrical, electricalRoadside] : [ece, eceRoadside]) : [])
        .find(({ door: [px, pz] }) => pz === z && pz === endZ && px > Math.min(x, endX) && px < Math.max(x, endX));
      const portal = front ? (front.door[0] - x) * dx : Number.NEGATIVE_INFINITY;
      const draw = (material: PBRMaterial, u: number, y: number, projection: number,
        width: number, height: number, depth: number) => box(material, `${id}-${material.name}`,
        x + u * dx + projection * dz, y, z + u * dz - projection * dx, width, height, depth,
        false, Math.atan2(-dz, dx));
      const entranceGap = front === electrical ? 1.56 : 0;
      const bands = entranceGap ? [[0, portal - entranceGap], [portal + entranceGap, length]] : [[0, length]];
      for (const [from, to] of bands) {
        if (electricalWalls) {
          draw(plaster, (from + to) / 2, 2.39, 0.045, to - from, 0.80, 0.10);
          if (height > 5) draw(plaster, (from + to) / 2, height - 1.08, 0.045, to - from, 0.45, 0.10);
        }
      }
      draw(electricalWalls ? electricalRed : brick, length / 2, height - 0.015, 0.075, length, 0.20, 0.16);
      if (!front) draw(stone, length / 2, 0.18, 0.04, length, 0.35, 0.12);
      if (length < 3.6 || (front && !electricalWalls)) continue;
      const bays = Math.max(1, Math.round(length / 4.5));
      for (let bay = 0; bay < bays; bay++) {
        const along = (bay + 0.5) * length / bays;
        if (Math.abs(along - portal) < (front === electricalRoadside ? 7.6 : 3.4)) continue;
        for (const y of (height > 5 ? [1.52, 4.24] : [1.48])) {
          const width = electricalWalls ? 1.23 : 1.63;
          const windowHeight = electricalWalls ? 0.82 : 1.36;
          draw(stone, along, y, 0.05, width + 0.13, windowHeight + 0.13, 0.11);
          draw(charcoal, along, y, 0.115, width, windowHeight, 0.08);
          draw(windowGlass, along, y, 0.158, width - 0.11, windowHeight - 0.11, 0.035);
          for (const mullion of [-0.25, 0, 0.25]) {
            draw(charcoal, along + mullion * width, y, 0.18, 0.033, windowHeight, 0.032);
          }
          draw(charcoal, along, y, 0.18, width, 0.04, 0.032);
        }
        if (!electricalWalls && bay < bays - 1) {
          draw(brick, (bay + 1) * length / bays, height / 2, 0.072, 0.63, height, 0.15);
        }
      }
    }
  }

  for (const id of ["B30", "B31"]) finishDepartment(id, "electrical", 6.3);
  finishDepartment(electrical.buildingId, "electrical", electricalHeight, true);
  for (const id of ["B36", "B43"]) finishDepartment(id, "ece", 6.3);
  finishDepartment(ece.buildingId, "ece", eceHeight, true);

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
