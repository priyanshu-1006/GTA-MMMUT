import type { AnnotationPoint } from "./southern-entrance";

const walkwayNodes = {
  administration: [972, 547],
  lawnEast: [973, 505],
  eastCorridor: [973, 325],
  pushpagiriApproach: [1296, 322],
  pushpagiri: [1296, 313],
  lawnWest: [821, 505],
  civil: [821, 454],
  physicsSpine: [821, 334],
  physics: [810, 334],
  electrical: [1003, 239],
  cseItPassage: [865, 258],
} as const satisfies Record<string, AnnotationPoint>;

type WalkwayNode = keyof typeof walkwayNodes;

interface CoveredWalkwayNetwork {
  readonly status: "PROVISIONAL";
  readonly connectivity: "OWNER_CONFIRMED";
  readonly widthPixels: number;
  readonly segments: readonly {
    readonly id: string;
    readonly from: WalkwayNode;
    readonly to: WalkwayNode;
    readonly points: readonly AnnotationPoint[];
    readonly kind: "covered" | "crossing";
  }[];
  readonly destinations: readonly {
    readonly id: string;
    readonly label: string;
    readonly node: WalkwayNode;
    readonly point: AnnotationPoint;
    readonly buildingIds: readonly string[];
  }[];
}

// The owner confirmed continuous cover between the listed destinations.
// The traced centerlines, clear walking width and building approach points
// are provisional. Exact doors and canopy junctions are unknown.
export const coveredWalkways: CoveredWalkwayNetwork = {
  status: "PROVISIONAL",
  connectivity: "OWNER_CONFIRMED",
  widthPixels: 6,
  segments: [
    {
      id: "administration-approach",
      from: "administration",
      to: "lawnEast",
      points: [walkwayNodes.administration, walkwayNodes.lawnEast],
      kind: "covered",
    },
    {
      id: "east-lawn-spine",
      from: "lawnEast",
      to: "eastCorridor",
      points: [walkwayNodes.lawnEast, [973, 423], walkwayNodes.eastCorridor],
      kind: "covered",
    },
    {
      id: "pushpagiri-connector",
      from: "eastCorridor",
      to: "pushpagiriApproach",
      points: [
        walkwayNodes.eastCorridor, [1033, 325], [1103, 325], [1166, 323],
        [1216, 323], walkwayNodes.pushpagiriApproach,
      ],
      kind: "covered",
    },
    {
      id: "pushpagiri-approach",
      from: "pushpagiriApproach",
      to: "pushpagiri",
      points: [walkwayNodes.pushpagiriApproach, walkwayNodes.pushpagiri],
      kind: "covered",
    },
    {
      id: "central-lawn-connector",
      from: "lawnEast",
      to: "lawnWest",
      points: [walkwayNodes.lawnEast, [896, 505], walkwayNodes.lawnWest],
      kind: "covered",
    },
    {
      id: "civil-approach",
      from: "lawnWest",
      to: "civil",
      points: [walkwayNodes.lawnWest, walkwayNodes.civil],
      kind: "covered",
    },
    {
      id: "civil-basic-sciences-spine",
      from: "civil",
      to: "physicsSpine",
      points: [walkwayNodes.civil, walkwayNodes.physicsSpine],
      kind: "covered",
    },
    {
      id: "basic-sciences-approach",
      from: "physicsSpine",
      to: "physics",
      points: [walkwayNodes.physicsSpine, walkwayNodes.physics],
      kind: "covered",
    },
    {
      id: "basic-sciences-cse-it-passage",
      from: "physicsSpine",
      to: "cseItPassage",
      points: [
        walkwayNodes.physicsSpine, [821, 325], [825, 316],
        [846, 312], [865, 306], walkwayNodes.cseItPassage,
      ],
      kind: "covered",
    },
    {
      id: "electrical-connector",
      from: "eastCorridor",
      to: "electrical",
      points: [
        walkwayNodes.eastCorridor, [977, 299], [978, 275], [977, 248],
        [978, 239], walkwayNodes.electrical,
      ],
      kind: "covered",
    },
  ],
  destinations: [
    {
      id: "administration",
      label: "Administration Building",
      node: "administration",
      point: walkwayNodes.administration,
      buildingIds: ["B71"],
    },
    {
      id: "pushpagiri",
      label: "Pushpagiri Lecture Hall Complex",
      node: "pushpagiri",
      point: walkwayNodes.pushpagiri,
      buildingIds: ["B45"],
    },
    {
      id: "civil",
      label: "Civil Engineering",
      node: "civil",
      point: walkwayNodes.civil,
      buildingIds: ["B73", "B74", "B28", "B29"],
    },
    {
      id: "cse-it",
      label: "CSE–IT passage",
      node: "cseItPassage",
      point: walkwayNodes.cseItPassage,
      buildingIds: ["B23", "B24"],
    },
    {
      id: "electrical",
      label: "Electrical Engineering",
      node: "electrical",
      point: walkwayNodes.electrical,
      buildingIds: ["B30", "B31", "B32"],
    },
    {
      id: "physics",
      label: "Physics / Basic Sciences",
      node: "physics",
      point: walkwayNodes.physics,
      buildingIds: ["B25", "B26"],
    },
  ],
};
