import type { AnnotationPoint } from "./southern-entrance";

type SurfaceKind = "road" | "sidewalk" | "apron" | "median";

interface DeoriaSurface {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly outline: readonly AnnotationPoint[];
}

const left = 411;
const right = 1570;
const northEdge = 912;
const laneWidth = 6.8;
const outerShoulder = 1;
const innerShoulder = 0.8;
const northMedianEdge = northEdge + outerShoulder + 3 * laneWidth + innerShoulder;
const southMedianEdge = northMedianEdge + 4.4;
const southEdge = southMedianEdge + innerShoulder + 3 * laneWidth + outerShoulder;

function strip(north: number, south: number): readonly AnnotationPoint[] {
  return [[left, north], [right, north], [right, south], [left, south]];
}

const carriageways = [
  {
    id: "deoria-eastbound",
    direction: "eastbound",
    outline: strip(northEdge, northMedianEdge),
    laneCenters: [0.5, 1.5, 2.5].map((offset) => northEdge + outerShoulder + offset * laneWidth),
    laneSeparators: [1, 2].map((offset) => northEdge + outerShoulder + offset * laneWidth),
    edgeLines: [northEdge + outerShoulder, northMedianEdge - innerShoulder],
  },
  {
    id: "deoria-westbound",
    direction: "westbound",
    outline: strip(southMedianEdge, southEdge),
    laneCenters: [0.5, 1.5, 2.5].map((offset) => southMedianEdge + innerShoulder + offset * laneWidth),
    laneSeparators: [1, 2].map((offset) => southMedianEdge + innerShoulder + offset * laneWidth),
    edgeLines: [southMedianEdge + innerShoulder, southEdge - outerShoulder],
  },
] as const;

// Frontage follows the map-bottom road alignment. The six lanes, central
// divider, and both driveway extensions are provisional exterior geometry.
// The cross-section continues south of the reference image's crop.
export const deoriaRoad = {
  label: "Deoria Road",
  status: "PROVISIONAL",
  annotationBounds: { left, top: 895, right, bottom: southEdge },
  carriageways,
  surfaces: [
    ...carriageways.map(({ id, outline }) => ({ id, kind: "road" as const, outline })),
    {
      id: "deoria-median",
      kind: "median",
      outline: strip(northMedianEdge, southMedianEdge),
    },
    {
      id: "main-gate-exterior-apron",
      kind: "apron",
      // The north edge matches the southern entrance road at y895.
      outline: [[864, 895], [932, 895], [929, 901], [923.5, northEdge], [872.5, northEdge], [867, 901]],
    },
    {
      id: "old-gate-exterior-apron",
      kind: "apron",
      // The north edge matches the old gate approach at y905.
      outline: [[514, 905], [544, 905], [544, northEdge], [514, northEdge]],
    },
    {
      id: "frontage-sidewalk-west",
      kind: "sidewalk",
      outline: [[left, 902], [516, 902], [514, 905], [514, northEdge], [left, northEdge]],
    },
    {
      id: "frontage-sidewalk-middle",
      kind: "sidewalk",
      outline: [
        [542, 902], [675, 900], [789, 900], [859, 900], [867, 901], [872.5, northEdge],
        [544, northEdge], [544, 905],
      ],
    },
    {
      id: "frontage-sidewalk-east",
      kind: "sidewalk",
      outline: [
        [929, 901], [943, 900], [1090, 900], [1220, 899], [1390, 898], [1538, 897],
        [right, 897], [right, northEdge], [923.5, northEdge],
      ],
    },
  ] satisfies readonly DeoriaSurface[],
  sidewalkCrossings: [
    { id: "main-gate-driveway-crossing", span: [[873, 907], [923, 907]] },
    { id: "old-gate-driveway-crossing", span: [[516, 908], [542, 908]] },
  ],
  signs: [
    { id: "deoria-main-gate-sign", position: [953, 904], gate: "MMMUT MAIN GATE" },
    { id: "deoria-old-gate-sign", position: [555, 904], gate: "MMMUT OLD GATE" },
  ],
} as const;
