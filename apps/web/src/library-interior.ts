import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type FurnishedInterior, type InteriorBounds } from "./interior-furnishing";

const extent = [-10, -27, 10, 2.2] as const;
const galleryY = 3.72;
const galleryEdge = 5.8;
const frontBridge = -1.85;
const stairEdge = 1.65;
const stairStart = -17.1;
const stairEnd = -22.15;
const landingEnd = -24.4;
const landingY = 1.86;

function stairHeightAt(x: number, z: number) {
  const across = Math.abs(x);
  if (across <= stairEdge && z >= stairEnd && z <= stairStart) {
    return landingY * (stairStart - z) / (stairStart - stairEnd);
  }
  if (across <= galleryEdge && z >= landingEnd && z <= stairEnd) {
    const progress = Math.max(0, (across - stairEdge) / (galleryEdge - stairEdge));
    return landingY + (galleryY - landingY) * progress;
  }
  return undefined;
}

export function buildLibraryInterior(scene: Scene): FurnishedInterior {
  const { material, patterned, box, floor, railing, sign, finish } = createInteriorFurnishing(scene, "library");
  const plaster = material("cream-plaster", "#e9d9b6");
  const ceiling = material("ceiling", "#e8deca", true);
  const soffit = material("gallery-soffit", "#c8bda5", true);
  const oak = patterned("oak-planks", "#b88e5e", "#9f7750", true);
  const stair = material("stone-treads", "#aa9b88");
  const nosing = material("stair-nosing", "#624e3e");
  const rail = material("blue-grey-steel", "#364b52");
  const shelfBlue = material("ground-shelf-frames", "#59737a");
  const shelfWood = material("gallery-shelves", "#8d7154");
  const dark = material("cabinet-interiors", "#44392e");
  const cap = material("railing-wood", "#7b4c37");
  const tableWood = material("reading-table-tops", "#8f6948");
  const seat = material("burgundy-chair", "#71464e");
  const paper = material("open-books", "#f4ebd8");
  const screen = material("laptop-screen", "#79a8bb", true);
  const light = material("light-diffusers", "#fff3d8", true);
  const bookColors = ["#7a5043", "#496d68", "#456382", "#a48f5d", "#6c6858", "#b0a997", "#70576a"];
  const books = bookColors.map((color, index) => material(`book-spines-${index}`, color));
  const width = extent[2] - extent[0];
  const depth = extent[3] - extent[1];
  const centerZ = (extent[3] + extent[1]) / 2;
  const height = 7.75;

  floor(oak, extent, 0, 1.65);
  box(ceiling, [0, height + 0.1, centerZ], [width, 0.2, depth], true);
  for (const side of [-1, 1]) {
    box(plaster, [side * 10, height / 2, centerZ], [0.2, height, depth], true);
    box(cap, [side * 9.88, 0.08, centerZ], [0.045, 0.16, depth]);
    const gallery: InteriorBounds = side < 0 ? [-10, extent[1], -galleryEdge, frontBridge]
      : [galleryEdge, extent[1], 10, frontBridge];
    floor(oak, gallery, galleryY, 1.65);
    box(plaster, [side * (galleryEdge + 10) / 2, galleryY - 0.14, (extent[1] + frontBridge) / 2],
      [10 - galleryEdge, 0.28, frontBridge - extent[1]], true);
    box(soffit, [side * (galleryEdge + 10) / 2, galleryY - 0.29, (extent[1] + frontBridge) / 2],
      [10 - galleryEdge, 0.024, frontBridge - extent[1]]);
    box(shelfWood, [side * galleryEdge, galleryY - 0.12, (extent[1] + frontBridge) / 2],
      [0.085, 0.24, frontBridge - extent[1]]);
    railing(rail, cap, [side * galleryEdge, galleryY, frontBridge], [side * galleryEdge, galleryY, stairEnd]);
    railing(rail, cap, [side * galleryEdge, galleryY, landingEnd], [side * galleryEdge, galleryY, extent[1] + 0.1]);
    for (const z of [-24.9, -22.1, -19.3, -16.5, -13.7, -10.9, -8.1, -5.3, -2.5]) {
      shelf(side, z, 0.13, true);
      shelf(side, z, galleryY + 0.14, false);
    }
    for (const level of [0.13, galleryY + 0.14]) {
      const shelfCollider = box(shelfWood, [side * 9.56, level + 1.175, -13.7], [0.54, 2.35, 25.06], true);
      shelfCollider.visibility = 0;
    }
    for (const z of [-23.6, -18, -12.4, -6.8, -1.2]) {
      box(plaster, [side * 8.28, 1.75, z], [0.26, 3.5, 0.23]);
      box(rail, [side * 8, galleryY - 0.44, z], [1.43, 0.12, 0.42]);
      box(light, [side * 8, galleryY - 0.51, z], [1.29, 0.032, 0.32]);
    }
  }
  floor(oak, [-10, frontBridge, 10, 2.2], galleryY, 1.65);
  box(plaster, [0, galleryY - 0.14, (frontBridge + 2.2) / 2], [width, 0.28, 2.2 - frontBridge], true);
  box(soffit, [0, galleryY - 0.29, (frontBridge + 2.2) / 2], [width, 0.024, 2.2 - frontBridge]);
  railing(rail, cap, [-galleryEdge, galleryY, frontBridge], [galleryEdge, galleryY, frontBridge]);

  const entrance = 2.6;
  for (const side of [-1, 1]) {
    box(plaster, [side * (10 + entrance / 2) / 2, height / 2, 2.2],
      [10 - entrance / 2, height, 0.22], true);
    box(rail, [side * entrance / 2, 1.34, 2.08], [0.13, 2.68, 0.22]);
  }
  box(plaster, [0, (height + 2.68) / 2, 2.2], [entrance, height - 2.68, 0.22], true);
  box(rail, [0, 2.69, 2.08], [entrance + 0.16, 0.12, 0.22]);
  box(plaster, [0, height / 2, -27], [width, height, 0.22], true);
  box(cap, [0, 0.09, -26.88], [width, 0.18, 0.045]);
  box(shelfWood, [0, 6.01, -26.83], [5.2, 2.24, 0.1]);
  sign("back-wall-plaque", [0, 6.04, -26.75], 4.83, 0.95, "CENTRAL LIBRARY", "केंद्रीय पुस्तकालय");

  for (const z of [-3.35, -7, -10.65, -14.3]) {
    for (const side of [-1, 1]) readingTable(side * 3.45, z);
  }

  const steps = 12;
  for (let index = 0; index < steps; index++) {
    const rise = landingY * (index + 1) / steps;
    const tread = (stairStart - stairEnd) / steps;
    const z = stairStart - (index + 0.5) * tread;
    box(stair, [0, rise / 2, z], [stairEdge * 2, rise, tread + 0.002]);
    box(nosing, [0, rise - 0.022, z + tread / 2 - 0.02], [stairEdge * 2, 0.044, 0.045]);
  }
  box(stair, [0, landingY / 2, (landingEnd + stairEnd) / 2],
    [stairEdge * 2, landingY, stairEnd - landingEnd]);
  for (const side of [-1, 1]) {
    railing(rail, cap, [side * stairEdge, 0, stairStart], [side * stairEdge, landingY, stairEnd]);
    railing(rail, cap, [side * stairEdge, landingY, stairEnd], [side * galleryEdge, galleryY, stairEnd]);
    railing(rail, cap, [side * stairEdge, landingY, landingEnd], [side * galleryEdge, galleryY, landingEnd]);
    for (let index = 0; index < steps; index++) {
      const rise = (galleryY - landingY) * (index + 1) / steps;
      const tread = (galleryEdge - stairEdge) / steps;
      const x = side * (stairEdge + (index + 0.5) * tread);
      const z = (landingEnd + stairEnd) / 2;
      box(stair, [x, landingY - 0.2 + (rise + 0.2) / 2, z], [tread + 0.002, rise + 0.2, stairEnd - landingEnd]);
      box(nosing, [x - side * (tread / 2 - 0.022), landingY + rise - 0.022, z],
        [0.044, 0.044, stairEnd - landingEnd]);
    }
  }
  railing(rail, cap, [-stairEdge, landingY, landingEnd], [stairEdge, landingY, landingEnd]);

  for (const z of [-18.3, -12.8, -7.3, -1.8]) {
    for (const x of [-3.4, 3.4]) {
      box(rail, [x, 7.06, z], [0.06, 1.33, 0.06]);
      box(rail, [x, 6.37, z], [2.55, 0.16, 0.38]);
      box(light, [x, 6.28, z], [2.38, 0.045, 0.28]);
    }
  }
  finish();

  function shelf(side: number, z: number, y: number, framed: boolean) {
    const x = side * 9.56;
    const frame = framed ? shelfBlue : shelfWood;
    const rows = 5;
    const pitch = 0.44;
    const height = rows * pitch + 0.15;
    box(dark, [x + side * 0.21, y + height / 2, z], [0.052, height, 2.65]);
    for (const edge of [-1, 1]) box(frame, [x, y + height / 2, z + edge * 1.31], [0.5, height, 0.075]);
    for (let row = 0; row <= rows; row++) {
      const shelfY = y + row * pitch + 0.06;
      box(frame, [x, shelfY, z], [0.5, 0.055, 2.65]);
      if (row === rows) continue;
      for (let index = 0; index < 18; index++) {
        const variant = (Math.floor(Math.abs(z) * 11) + row * 23 + index * 13 + side + 1) % 17;
        if (variant === 0 || variant === 5) continue;
        const spineHeight = 0.24 + (variant % 5) * 0.025;
        const spineZ = z - 1.23 + index * 0.139;
        box(books[(row * 5 + index * 3 + variant) % books.length],
          [x - side * (0.095 + 0.008 * (variant % 4)), shelfY + 0.029 + spineHeight / 2, spineZ],
          [0.215, spineHeight, 0.071 + 0.014 * (variant % 4)]);
      }
    }
    if (framed) {
      for (let bar = -5; bar <= 5; bar++) {
        box(shelfBlue, [x - side * 0.261, y + height / 2, z + bar * 0.232], [0.026, height, 0.025]);
      }
      for (const band of [0.4, 1.12, 1.84]) {
        box(shelfBlue, [x - side * 0.263, y + band, z], [0.026, 0.028, 2.64]);
      }
    }
  }

  function readingTable(x: number, z: number) {
    box(tableWood, [x, 0.77, z], [3.27, 0.09, 1.55], true);
    for (const dx of [-1.43, 1.43]) {
      for (const dz of [-0.58, 0.58]) box(tableWood, [x + dx, 0.36, z + dz], [0.12, 0.72, 0.12]);
    }
    for (const side of [-1, 1]) {
      const chairRow = box(seat, [x, 0.43, z + side * 1.01], [2.61, 0.86, 0.49], true);
      chairRow.visibility = 0;
      for (const offset of [-1.03, 0, 1.03]) {
        const seatX = x + offset;
        const seatZ = z + side * 1.01;
        box(seat, [seatX, 0.46, seatZ], [0.55, 0.09, 0.49]);
        box(seat, [seatX, 0.69, seatZ + side * 0.21], [0.55, 0.35, 0.075]);
        for (const dx of [-0.23, 0.23]) {
          for (const dz of [-0.18, 0.18]) box(rail, [seatX + dx, 0.225, seatZ + dz], [0.036, 0.45, 0.036]);
        }
        box(paper, [seatX + 0.04, 0.822, z + side * 0.48], [0.29, 0.015, 0.22]);
      }
    }
    box(rail, [x + 0.94, 0.832, z - 0.23], [0.28, 0.033, 0.23]);
    box(screen, [x + 0.94, 0.955, z - 0.12], [0.28, 0.22, 0.025]);
    box(books[3], [x - 0.42, 0.842, z + 0.17], [0.23, 0.055, 0.31]);
  }

  return {
    spawn: [0, 0, 0.85],
    extent,
    floorAt(x, z, y) {
      const stairs = stairHeightAt(x, z);
      if (stairs !== undefined && y >= stairs - 0.27) return stairs;
      return y >= galleryY - 0.28 && (Math.abs(x) >= galleryEdge || z >= frontBridge) ? galleryY : 0;
    },
    location(x, y, z) {
      if (y >= galleryY - 0.25) return "Upper Book Galleries";
      if (y > 0.2 && stairHeightAt(x, z) !== undefined) return "Library Staircase";
      return z > -1.3 ? "Library Entrance" : "Reading Floor";
    },
    exitNear: (x, y, z) => Math.abs(x) < 1.65 && y < 0.35 && z > 0.05,
  };
}
