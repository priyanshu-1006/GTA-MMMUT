export type AnnotationPoint = readonly [number, number];
export type WorldGroundPoint = readonly [number, number];

export const splitterFountainCenter = [899, 701] as const satisfies AnnotationPoint;

export const southernEntranceTransform = {
  origin: [900, 700],
  metersPerPixel: 0.5,
} as const;

// Provisional right-handed ground plane: +X follows image right, +Z image down.
// The scale is for gameplay blockout and has no survey calibration.
export function annotationToWorld([u, v]: AnnotationPoint): WorldGroundPoint {
  const { origin, metersPerPixel } = southernEntranceTransform;
  return [(u - origin[0]) * metersPerPixel, (v - origin[1]) * metersPerPixel];
}

export function worldToAnnotation([x, z]: WorldGroundPoint): AnnotationPoint {
  const { origin, metersPerPixel } = southernEntranceTransform;
  return [x / metersPerPixel + origin[0], z / metersPerPixel + origin[1]];
}

const roadNodes = {
  westNorth: [531, 535],
  westSouth: [529, 755],
  west: [530, 645],
  westFork: [863, 684],
  eastFork: [937, 684],
  eastSeam: [1010, 647],
  eastCourtyard: [1149, 648],
  eastCourtyardEnd: [1150, 617],
  east: [1251, 647],
  eastNorth: [1250, 608],
  eastSouth: [1267, 684],
  eastEnd: [1280, 647],
  southFork: [898, 731],
  gate: [897, 875],
  apron: [898, 895],
} as const satisfies Record<string, AnnotationPoint>;

type RoadNodeId = keyof typeof roadNodes;

interface RoadCenterline {
  readonly id: string;
  readonly from: RoadNodeId;
  readonly to: RoadNodeId;
  readonly points: readonly AnnotationPoint[];
}

interface Area {
  readonly id: string;
  readonly outline: readonly AnnotationPoint[];
}

interface PavedSurface extends Area {
  readonly kind: 'road' | 'paved-connection';
}

interface SouthernEntrance {
  readonly annotationSize: AnnotationPoint;
  readonly status: 'PROVISIONAL';
  readonly pavedSurfaces: readonly PavedSurface[];
  readonly splitterIsland: Area;
  readonly centerlines: readonly RoadCenterline[];
  readonly connections: readonly {
    readonly id: string;
    readonly label: string;
    readonly node: RoadNodeId;
    readonly point: AnnotationPoint;
  }[];
  readonly crosswalks: readonly {
    readonly id: string;
    readonly span: readonly [AnnotationPoint, AnnotationPoint];
  }[];
  readonly gate: {
    readonly position: AnnotationPoint;
    readonly span: readonly [AnnotationPoint, AnnotationPoint];
    readonly status: 'PROVISIONAL';
  };
}

// Traced against campus_reference_original.png resampled to the registry's
// 1623 × 928 annotation canvas. The trace stops within the southern sector.
export const southernEntrance: SouthernEntrance = {
  annotationSize: [1623, 928],
  status: 'PROVISIONAL',
  pavedSurfaces: [
    {
      id: 'southern-entrance-paving',
      kind: 'road',
      outline: [
        [540, 535],
        [540, 602],
        [540, 625],
        [546, 635],
        [559, 638],
        [579, 639],
        [731, 637],
        [806, 641],
        [849, 644],
        [853, 650],
        [852, 663],
        [860, 672],
        [874, 677],
        [919, 677],
        [929, 672],
        [937, 660],
        [940, 645],
        [971, 644],
        [1010, 641],
        [1010, 653],
        [1006, 653],
        [980, 657],
        [956, 670],
        [939, 685],
        [926, 704],
        [914, 725],
        [909, 741],
        [909, 805],
        [909, 845],
        [912, 866],
        [912, 882],
        [932, 895],
        [864, 895],
        [882, 882],
        [882, 870],
        [886, 849],
        [887, 810],
        [887, 751],
        [883, 736],
        [875, 717],
        [864, 700],
        [849, 683],
        [828, 670],
        [801, 659],
        [773, 653],
        [705, 652],
        [586, 651],
        [556, 655],
        [545, 660],
        [540, 670],
        [538, 713],
        [539, 755],
        [519, 755],
        [519, 713],
        [520, 675],
        [519, 644],
        [520, 608],
        [521, 570],
        [521, 535],
      ],
    },
    {
      // The aerial shows lighter paving here. Vehicle access is unverified.
      id: 'east-paved-connection',
      kind: 'paved-connection',
      outline: [
        [1010, 641],
        [1075, 641],
        [1104, 643],
        [1134, 643],
        [1140, 641],
        [1144, 636],
        [1145, 617],
        [1155, 617],
        [1155, 637],
        [1160, 642],
        [1177, 643],
        [1242, 642],
        [1247, 638],
        [1247, 608],
        [1253, 608],
        [1253, 637],
        [1257, 642],
        [1280, 642],
        [1280, 653],
        [1263, 653],
        [1259, 654],
        [1264, 662],
        [1270, 673],
        [1271, 684],
        [1263, 684],
        [1262, 675],
        [1258, 667],
        [1250, 658],
        [1245, 654],
        [1217, 653],
        [1146, 654],
        [1068, 652],
        [1010, 653],
      ],
    },
  ],
  // This outline also acts as a hole in southern-entrance-paving.
  splitterIsland: {
    id: 'triangular-splitter-island',
    outline: [
      [883, 692],
      [915, 692],
      [899, 718],
    ],
  },
  centerlines: [
    {
      id: 'west-spine-north',
      from: 'westNorth',
      to: 'west',
      points: [roadNodes.westNorth, [531, 604], roadNodes.west],
    },
    {
      id: 'west-spine-south',
      from: 'west',
      to: 'westSouth',
      points: [roadNodes.west, [529, 710], roadNodes.westSouth],
    },
    {
      id: 'west-campus-connection',
      from: 'west',
      to: 'westFork',
      points: [
        roadNodes.west,
        [675, 645],
        [785, 647],
        [823, 655],
        [846, 670],
        roadNodes.westFork,
      ],
    },
    {
      id: 'splitter-west',
      from: 'westFork',
      to: 'southFork',
      points: [roadNodes.westFork, [877, 705], [888, 723], roadNodes.southFork],
    },
    {
      id: 'splitter-north',
      from: 'westFork',
      to: 'eastFork',
      points: [roadNodes.westFork, [899, 684], roadNodes.eastFork],
    },
    {
      id: 'splitter-east',
      from: 'southFork',
      to: 'eastFork',
      points: [roadNodes.southFork, [911, 713], [924, 694], roadNodes.eastFork],
    },
    {
      id: 'east-campus-connection',
      from: 'eastFork',
      to: 'eastSeam',
      points: [roadNodes.eastFork, [954, 667], [979, 653], roadNodes.eastSeam],
    },
    {
      id: 'east-paved-link',
      from: 'eastSeam',
      to: 'eastCourtyard',
      points: [roadNodes.eastSeam, [1075, 647], roadNodes.eastCourtyard],
    },
    {
      id: 'east-courtyard-connection',
      from: 'eastCourtyard',
      to: 'eastCourtyardEnd',
      points: [roadNodes.eastCourtyard, [1150, 636], roadNodes.eastCourtyardEnd],
    },
    {
      id: 'east-lane-continuation',
      from: 'eastCourtyard',
      to: 'east',
      points: [roadNodes.eastCourtyard, [1192, 648], roadNodes.east],
    },
    {
      id: 'east-link-north',
      from: 'east',
      to: 'eastNorth',
      points: [roadNodes.east, [1250, 637], roadNodes.eastNorth],
    },
    {
      id: 'east-link-south',
      from: 'east',
      to: 'eastSouth',
      points: [roadNodes.east, [1255, 657], [1262, 667], [1266, 676], roadNodes.eastSouth],
    },
    {
      id: 'east-link-end',
      from: 'east',
      to: 'eastEnd',
      points: [roadNodes.east, roadNodes.eastEnd],
    },
    {
      id: 'entrance-approach',
      from: 'southFork',
      to: 'gate',
      points: [roadNodes.southFork, [899, 751], [898, 798], [898, 839], roadNodes.gate],
    },
    {
      id: 'gate-apron',
      from: 'gate',
      to: 'apron',
      points: [roadNodes.gate, roadNodes.apron],
    },
  ],
  connections: [
    { id: 'west-spine', label: 'West spine', node: 'west', point: roadNodes.west },
    { id: 'east-connection', label: 'East paved link', node: 'east', point: roadNodes.east },
  ],
  crosswalks: [
    {
      id: 'west-spine-crossing',
      span: [[522, 650], [538, 650]],
    },
  ],
  gate: {
    position: roadNodes.gate,
    span: [
      [882, 875],
      [912, 875],
    ],
    status: 'PROVISIONAL',
  },
};
