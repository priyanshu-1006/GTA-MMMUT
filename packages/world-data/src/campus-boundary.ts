import { southernEntrance, type AnnotationPoint } from "./southern-entrance";

const oldGateSpan = [[524.5, 891], [533.5, 891]] as const satisfies readonly [AnnotationPoint, AnnotationPoint];

// The owner identified the west-spine access as the old gate. Its opening,
// approach and the adjoining visible southern frontage are provisional traces.
export const campusBoundary = {
  status: "PROVISIONAL",
  oldGate: {
    position: [529, 891],
    span: oldGateSpan,
    status: "PROVISIONAL",
    approach: {
      id: "old-gate-approach",
      kind: "road",
      // The first edge matches the west spine's existing southern road edge.
      outline: [[519, 891], [539, 891], [540, 899], [544, 905], [514, 905], [518, 899]],
    },
  },
  wallRuns: [
    {
      id: "old-gate-west-wall",
      points: [[443, 900], [498, 900], [517, 898], oldGateSpan[0]],
    },
    {
      id: "between-gates-wall",
      points: [
        oldGateSpan[1], [541, 898], [675, 898], [789, 898], [859, 898],
        [869, 891], [879, 883], southernEntrance.gate.span[0],
      ],
    },
    {
      id: "main-gate-east-wall",
      points: [
        southernEntrance.gate.span[1], [915, 884], [928, 893], [942, 898],
        [1090, 898], [1220, 897], [1390, 896], [1538, 895],
      ],
    },
  ],
} as const satisfies {
  readonly status: "PROVISIONAL";
  readonly oldGate: {
    readonly position: AnnotationPoint;
    readonly span: readonly [AnnotationPoint, AnnotationPoint];
    readonly status: "PROVISIONAL";
    readonly approach: {
      readonly id: string;
      readonly kind: "road";
      readonly outline: readonly AnnotationPoint[];
    };
  };
  readonly wallRuns: readonly {
    readonly id: string;
    readonly points: readonly AnnotationPoint[];
  }[];
};
