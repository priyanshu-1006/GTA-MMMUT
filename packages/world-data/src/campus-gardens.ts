import type { AnnotationPoint } from "./southern-entrance";

export type AnnotationRect = readonly [left: number, top: number, right: number, bottom: number];

// The aerial identifies the open lawns and road edge. The garden partitions,
// flowerbeds, drive widths and parking markings are a provisional layout.
export const campusGardens = {
  status: "PROVISIONAL",
  atal: {
    center: [797, 746],
    quarters: [
      [734, 702, 792.5, 741.5],
      [801.5, 702, 860, 741.5],
      [734, 750.5, 792.5, 790],
      [801.5, 750.5, 860, 790],
    ],
    paths: [
      [714, 741.5, 883, 750.5],
      [792.5, 702, 801.5, 741.5],
      [792.5, 750.5, 801.5, 790],
    ],
  },
  east: {
    center: [991, 760],
    lawns: [
      [933, 726, 1052, 766],
      [933, 774, 1052, 795],
    ],
    path: [914, 766, 1052, 774],
  },
  placementParking: {
    center: [1046, 619],
    lot: [1011, 605, 1082, 633],
    driveway: [[1049, 633], [1061, 633], [1063, 641], [1047, 641]],
    entranceWalk: [1019, 591.3, 1025.5, 605],
    stalls: { left: 1029, top: 607, width: 5.5, depth: 10.6, count: 9 },
  },
} as const satisfies {
  readonly status: "PROVISIONAL";
  readonly atal: {
    readonly center: AnnotationPoint;
    readonly quarters: readonly AnnotationRect[];
    readonly paths: readonly AnnotationRect[];
  };
  readonly east: {
    readonly center: AnnotationPoint;
    readonly lawns: readonly AnnotationRect[];
    readonly path: AnnotationRect;
  };
  readonly placementParking: {
    readonly center: AnnotationPoint;
    readonly lot: AnnotationRect;
    readonly driveway: readonly AnnotationPoint[];
    readonly entranceWalk: AnnotationRect;
    readonly stalls: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly depth: number;
      readonly count: number;
    };
  };
};
