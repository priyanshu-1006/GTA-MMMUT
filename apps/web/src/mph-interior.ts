import type { Scene } from "@babylonjs/core/scene";
import { createInteriorFurnishing, type FurnishedInterior } from "./interior-furnishing";

const extent = [-12, -31, 12, 2.2] as const;
const stageHalfWidth = 10.5;
const stageFront = -22.6;
const stageY = 0.91;
const stairStart = -20.3;
const stairInner = 6.65;
const stairOuter = 8.85;

export function buildMphInterior(scene: Scene): FurnishedInterior {
  const { material, patterned, box, floor, sign, finish } = createInteriorFurnishing(scene, "mph");
  const plaster = material("white-plaster", "#ebe7df");
  const ceiling = patterned("acoustic-ceiling", "#e8e7df", "#b6b3a9", false, [39, 52]);
  ceiling.unlit = true;
  const tile = patterned("terrazzo", "#b2a79a", "#8c8279");
  const wood = material("wall-panels", "#a16c44");
  const timber = material("wall-trim", "#6f4d39");
  const red = material("red-seating", "#9a3435");
  const darkRed = material("red-seating-variation", "#873236");
  const curtain = material("curtain", "#9f383c");
  const folds = material("curtain-shadow", "#74282d");
  const felt = material("acoustic-panels", "#263954");
  const frame = material("chair-frames", "#574d47");
  const charcoal = material("sound-system-and-stage-front", "#302d2c");
  const carpet = material("stage-carpet", "#743c38");
  const light = material("ceiling-light", "#fff6e4", true);
  const window = material("daylit-window", "#ffcc9b", true);
  const projection = material("projection", "#d7e7ad", true);
  const width = extent[2] - extent[0];
  const depth = extent[3] - extent[1];
  const centerZ = (extent[3] + extent[1]) / 2;
  const height = 8.25;
  const panelTop = 4.62;

  floor(tile, extent, 0, 0.82);
  box(ceiling, [0, height + 0.095, centerZ], [width, 0.19, depth], true);

  for (const side of [-1, 1]) {
    box(wood, [side * 12, panelTop / 2, centerZ], [0.24, panelTop, depth], true);
    box(plaster, [side * 12, (panelTop + height) / 2, centerZ], [0.24, height - panelTop, depth], true);
    box(timber, [side * 11.85, panelTop, centerZ], [0.1, 0.15, depth]);
    box(timber, [side * 11.85, 0.11, centerZ], [0.1, 0.22, depth]);
    for (let index = 0; index < 7; index++) {
      const z = -2.7 - index * 4.0;
      box(timber, [side * 11.845, 2.26, z + 1.64], [0.11, 4.52, 0.11]);
      box(plaster, [side * 11.85, 3.17, z], [0.1, 1.95, 1.26]);
      box(window, [side * 11.782, 3.17, z], [0.025, 1.76, 1.04]);
      box(timber, [side * 11.755, 3.17, z], [0.032, 1.78, 0.045]);
      box(timber, [side * 11.755, 3.17, z], [0.032, 0.052, 1.05]);
      for (const edge of [-1, 1]) {
        box(curtain, [side * 11.738, 3.21, z + edge * 0.49], [0.15, 1.95, 0.28]);
        for (const tuck of [-0.075, 0.075]) {
          box(folds, [side * 11.65, 3.21, z + edge * 0.49 + tuck], [0.025, 1.93, 0.025]);
        }
      }
      box(timber, [side * 11.695, 4.23, z], [0.06, 0.08, 1.43]);
      box(timber, [side * 11.845, 1.19, z], [0.085, 1.01, 2.36]);
      box(felt, [side * 11.784, 1.19, z], [0.055, 0.84, 2.16]);
      box(charcoal, [side * 11.72, 5.05, z], [0.38, 0.25, 0.33]);
      box(light, [side * 11.51, 5.02, z], [0.045, 0.13, 0.17]);
    }
  }

  const entrance = 2.6;
  for (const side of [-1, 1]) {
    box(wood, [side * (12 + entrance / 2) / 2, height / 2, 2.2],
      [12 - entrance / 2, height, 0.22], true);
    box(charcoal, [side * entrance / 2, 1.34, 2.06], [0.13, 2.68, 0.19]);
  }
  box(wood, [0, (height + 2.68) / 2, 2.2], [entrance, height - 2.68, 0.22], true);
  box(charcoal, [0, 2.7, 2.05], [entrance + 0.15, 0.12, 0.18]);
  box(wood, [0, panelTop / 2, -31], [width, panelTop, 0.24], true);
  box(plaster, [0, (panelTop + height) / 2, -31], [width, height - panelTop, 0.24], true);

  const rows = 12;
  for (let row = 0; row < rows; row++) {
    const z = -1.84 - row * 1.43 - (row >= 6 ? 0.57 : 0);
    for (const side of [-1, 1]) {
      const rowCollider = box(frame, [side * 5.66, 0.46, z + 0.02], [8.08, 0.92, 0.59], true);
      rowCollider.visibility = 0;
      for (let column = 0; column < 9; column++) {
        const x = side * (1.96 + column * 0.925);
        const upholstery = (row + column * 2 + (side > 0 ? 1 : 0)) % 5 === 0 ? darkRed : red;
        box(upholstery, [x, 0.466, z], [0.67, 0.082, 0.48]);
        box(upholstery, [x, 0.72, z + 0.228], [0.64, 0.44, 0.071]);
        for (const dx of [-0.28, 0.28]) {
          for (const dz of [-0.19, 0.19]) box(frame, [x + dx, 0.222, z + dz], [0.036, 0.444, 0.037]);
          box(upholstery, [x + dx, 0.617, z + 0.012], [0.068, 0.046, 0.38]);
        }
      }
    }
  }

  box(charcoal, [0, stageY / 2, (-31 + stageFront) / 2],
    [stageHalfWidth * 2, stageY, stageFront + 31], true);
  box(carpet, [0, stageY - 0.014, (-31 + stageFront) / 2],
    [stageHalfWidth * 2 + 0.035, 0.039, stageFront + 31]);
  box(timber, [0, stageY - 0.055, stageFront + 0.04], [stageHalfWidth * 2, 0.093, 0.086]);
  for (const side of [-1, 1]) {
    const steps = 6;
    const tread = (stairStart - stageFront) / steps;
    const x = side * (stairInner + stairOuter) / 2;
    for (let index = 0; index < steps; index++) {
      const rise = stageY * (index + 1) / steps;
      const z = stairStart - (index + 0.5) * tread;
      box(timber, [x, rise / 2, z], [stairOuter - stairInner, rise, tread + 0.001]);
      box(wood, [x, rise - 0.014, z + tread / 2 - 0.024], [stairOuter - stairInner, 0.028, 0.049]);
    }
    box(charcoal, [side * 9.47, stageY + 0.72, -28.7], [0.91, 1.44, 0.74], true);
    box(frame, [side * 9.47, stageY + 0.73, -28.315], [0.76, 1.22, 0.035]);
    box(carpet, [side * 7.43, stageY + 1.65, -30.81], [3.28, 3.3, 0.12]);
    for (let pleat = 0; pleat < 9; pleat++) {
      box(folds, [side * (5.99 + pleat * 0.34), stageY + 1.65, -30.69], [0.09, 3.3, 0.08]);
    }
  }
  box(charcoal, [0, 3.05, -30.61], [6.65, 2.75, 0.13]);
  box(projection, [0, 3.05, -30.529], [6.4, 2.53, 0.034]);
  box(timber, [0, 5.92, -30.82], [16.15, 1.65, 0.13]);
  sign("stage-banner", [0, 5.94, -30.73], 15.9, 1.55, "MULTIPURPOSE HALL",
    "Madan Mohan Malaviya University of Technology, Gorakhpur");
  box(timber, [-6.35, stageY + 0.53, -25.42], [0.63, 1.06, 0.51], true);
  box(wood, [-6.35, stageY + 1.09, -25.42], [0.83, 0.084, 0.65]);
  box(charcoal, [-6.49, stageY + 1.23, -25.51], [0.038, 0.24, 0.039]);
  box(charcoal, [-6.49, stageY + 1.35, -25.46], [0.046, 0.045, 0.14]);
  for (const z of [-1.2, -5.7, -10.2, -14.7, -19.2, -23.7, -28.2]) {
    for (const x of [-7, 0, 7]) {
      box(frame, [x, height - 0.055, z], [0.79, 0.11, 1.68]);
      box(light, [x, height - 0.121, z], [0.67, 0.031, 1.56]);
    }
  }
  finish();

  return {
    spawn: [0, 0, 0.85],
    extent,
    floorAt(x, z, y) {
      const across = Math.abs(x);
      if (across >= stairInner && across <= stairOuter && z <= stairStart && z >= stageFront) {
        return stageY * (stairStart - z) / (stairStart - stageFront);
      }
      return across <= stageHalfWidth && z <= stageFront && y >= stageY - 0.25 ? stageY : 0;
    },
    location(_x, y, z) {
      if (y >= stageY - 0.18 && z <= stageFront) return "Stage";
      return z > -0.9 ? "Hall Entrance" : "Auditorium";
    },
    exitNear: (x, y, z) => Math.abs(x) < 1.65 && y < 0.35 && z > 0.05,
  };
}
