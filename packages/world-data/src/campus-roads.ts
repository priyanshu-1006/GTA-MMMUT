import type { AnnotationPoint } from "./southern-entrance";

interface CampusRoadNetwork {
  readonly status: "PROVISIONAL";
  readonly pavedSurfaces: readonly {
    readonly id: string;
    readonly kind: "road" | "paved-connection";
    readonly outline: readonly AnnotationPoint[];
  }[];
  readonly centerlines: readonly {
    readonly id: string;
    readonly from: keyof typeof roadNodes;
    readonly to: keyof typeof roadNodes;
    readonly points: readonly AnnotationPoint[];
  }[];
}

const roadNodes = {
  // These three endpoints also occur in southernEntrance.centerlines.
  westNorth: [531, 535],
  westSouth: [529, 755],
  eastEnd: [1280, 647],
  northWest: [529, 64],
  westNorthTip: [529, 6],
  westSouthTip: [529, 891],
  westAccessNorth: [530, 187],
  westAccessMiddle: [530, 315],
  westAccessSouth: [531, 505],
  westAccessNorthTip: [797, 188],
  westAccessMiddleTip: [610, 318],
  westAccessSouthTip: [564, 539],
  northAccessWest: [818, 62],
  northAccessCenter: [923, 62],
  northAccessWorkshops: [1233, 60],
  northAccessWestTip: [821, 140],
  northAccessCenterTurn: [921, 187],
  northAccessCenterWestTip: [869, 188],
  northAccessCenterEastTip: [978, 189],
  northAccessWorkshopsTip: [1232, 184],
  northEastTip: [1538, 38],
  eastLinkBend: [1391, 646],
  eastLinkNorthTip: [1394, 605],
  eastLinkTip: [1414, 646],
} as const satisfies Record<string, AnnotationPoint>;

// Aerial traces in the same 1623 × 928 frame as the registry and southern
// entrance. Seams are shared edges. Light paving has unverified access rules.
export const campusRoads: CampusRoadNetwork = {
  status: "PROVISIONAL",
  pavedSurfaces: [
    {
      id: "west-and-north-spines",
      kind: "road",
      outline: [
        [520, 6], [538, 6], [538, 48], [543, 55], [559, 58],
        [741, 56], [992, 56], [1200, 54], [1315, 53], [1355, 51],
        [1380, 43], [1404, 32], [1442, 31], [1494, 32], [1538, 31],
        [1538, 45], [1495, 44], [1442, 43], [1408, 44], [1386, 55],
        [1356, 63], [1315, 65], [1238, 66], [1227, 66], [1002, 68],
        [930, 69], [914, 69], [823, 69], [811, 69], [744, 69],
        [559, 71], [546, 75], [540, 84], [539, 140], [540, 178],
        [540, 195], [539, 250], [540, 310], [540, 321], [541, 373],
        [542, 429], [541, 499], [541, 511], [540, 535], [521, 535],
        [521, 480], [520, 425], [520, 370], [519, 320], [520, 269],
        [519, 207], [520, 148], [520, 90],
      ],
    },
    {
      id: "west-spine-south-extension",
      kind: "road",
      outline: [
        [519, 755], [539, 755], [538, 795], [540, 833], [540, 862],
        [539, 891], [519, 891], [520, 862], [519, 833], [519, 790],
      ],
    },
    {
      id: "west-access-north",
      kind: "paved-connection",
      outline: [
        [540, 178], [556, 177], [588, 177], [652, 178], [713, 180],
        [784, 180], [794, 181], [801, 188], [796, 194], [762, 192],
        [689, 187], [666, 189], [652, 194], [610, 197], [573, 199],
        [553, 197], [540, 195],
      ],
    },
    {
      id: "west-access-middle",
      kind: "paved-connection",
      outline: [
        [540, 310], [555, 312], [570, 312], [591, 313], [610, 314],
        [610, 322], [588, 321], [568, 321], [553, 320], [540, 321],
      ],
    },
    {
      id: "west-access-south",
      kind: "paved-connection",
      outline: [
        [541, 499], [558, 499], [570, 500], [577, 504], [576, 512],
        [569, 517], [569, 539], [558, 539], [558, 517], [550, 513],
        [541, 511],
      ],
    },
    {
      id: "north-access-west",
      kind: "paved-connection",
      outline: [
        [811, 69], [823, 69], [825, 81], [824, 103], [825, 140],
        [817, 140], [815, 103], [816, 82],
      ],
    },
    {
      id: "north-access-center",
      kind: "paved-connection",
      outline: [
        [914, 69], [930, 69], [926, 83], [925, 148], [926, 164],
        [934, 177], [953, 182], [978, 183], [978, 195], [950, 195],
        [929, 194], [905, 194], [875, 197], [865, 192], [870, 182],
        [899, 181], [910, 175], [915, 163], [915, 86],
      ],
    },
    {
      id: "north-access-workshops",
      kind: "paved-connection",
      outline: [
        [1227, 66], [1238, 66], [1237, 105], [1236, 151], [1235, 184],
        [1229, 184], [1227, 151], [1228, 105],
      ],
    },
    {
      id: "east-access-extension",
      kind: "paved-connection",
      outline: [
        [1280, 642], [1330, 640], [1358, 640], [1370, 635], [1383, 626],
        [1388, 616], [1389, 605], [1399, 605], [1398, 624], [1404, 635],
        [1414, 640], [1414, 653], [1402, 654], [1386, 655], [1378, 652],
        [1350, 653], [1320, 653], [1280, 653],
      ],
    },
  ],
  centerlines: [
    {
      id: "west-spine-to-north",
      from: "westNorth",
      to: "westAccessSouth",
      points: [roadNodes.westNorth, roadNodes.westAccessSouth],
    },
    {
      id: "west-spine-middle-south",
      from: "westAccessSouth",
      to: "westAccessMiddle",
      points: [roadNodes.westAccessSouth, [531, 430], [530, 370], roadNodes.westAccessMiddle],
    },
    {
      id: "west-spine-middle-north",
      from: "westAccessMiddle",
      to: "westAccessNorth",
      points: [roadNodes.westAccessMiddle, [529, 245], roadNodes.westAccessNorth],
    },
    {
      id: "west-spine-north-junction",
      from: "westAccessNorth",
      to: "northWest",
      points: [roadNodes.westAccessNorth, [529, 115], roadNodes.northWest],
    },
    {
      id: "west-spine-north-end",
      from: "northWest",
      to: "westNorthTip",
      points: [roadNodes.northWest, roadNodes.westNorthTip],
    },
    {
      id: "west-spine-south-end",
      from: "westSouth",
      to: "westSouthTip",
      points: [roadNodes.westSouth, [529, 805], [530, 851], roadNodes.westSouthTip],
    },
    {
      id: "west-access-north",
      from: "westAccessNorth",
      to: "westAccessNorthTip",
      points: [roadNodes.westAccessNorth, [573, 186], [655, 185], [710, 185], [774, 187], roadNodes.westAccessNorthTip],
    },
    {
      id: "west-access-middle",
      from: "westAccessMiddle",
      to: "westAccessMiddleTip",
      points: [roadNodes.westAccessMiddle, [569, 316], roadNodes.westAccessMiddleTip],
    },
    {
      id: "west-access-south",
      from: "westAccessSouth",
      to: "westAccessSouthTip",
      points: [roadNodes.westAccessSouth, [564, 506], [564, 516], roadNodes.westAccessSouthTip],
    },
    {
      id: "north-spine-west",
      from: "northWest",
      to: "northAccessWest",
      points: [roadNodes.northWest, [560, 64], [745, 62], roadNodes.northAccessWest],
    },
    {
      id: "north-spine-center-west",
      from: "northAccessWest",
      to: "northAccessCenter",
      points: [roadNodes.northAccessWest, roadNodes.northAccessCenter],
    },
    {
      id: "north-spine-center-east",
      from: "northAccessCenter",
      to: "northAccessWorkshops",
      points: [roadNodes.northAccessCenter, [1060, 61], roadNodes.northAccessWorkshops],
    },
    {
      id: "north-spine-east",
      from: "northAccessWorkshops",
      to: "northEastTip",
      points: [roadNodes.northAccessWorkshops, [1345, 58], [1376, 51], [1406, 38], [1480, 38], roadNodes.northEastTip],
    },
    {
      id: "north-access-west",
      from: "northAccessWest",
      to: "northAccessWestTip",
      points: [roadNodes.northAccessWest, [820, 84], roadNodes.northAccessWestTip],
    },
    {
      id: "north-access-center",
      from: "northAccessCenter",
      to: "northAccessCenterTurn",
      points: [roadNodes.northAccessCenter, [921, 90], [920, 162], roadNodes.northAccessCenterTurn],
    },
    {
      id: "north-access-center-west",
      from: "northAccessCenterTurn",
      to: "northAccessCenterWestTip",
      points: [roadNodes.northAccessCenterTurn, [895, 188], roadNodes.northAccessCenterWestTip],
    },
    {
      id: "north-access-center-east",
      from: "northAccessCenterTurn",
      to: "northAccessCenterEastTip",
      points: [roadNodes.northAccessCenterTurn, [951, 189], roadNodes.northAccessCenterEastTip],
    },
    {
      id: "north-access-workshops",
      from: "northAccessWorkshops",
      to: "northAccessWorkshopsTip",
      points: [roadNodes.northAccessWorkshops, [1233, 104], [1231, 149], roadNodes.northAccessWorkshopsTip],
    },
    {
      id: "east-access-extension",
      from: "eastEnd",
      to: "eastLinkBend",
      points: [roadNodes.eastEnd, [1352, 646], roadNodes.eastLinkBend],
    },
    {
      id: "east-access-north",
      from: "eastLinkBend",
      to: "eastLinkNorthTip",
      points: [roadNodes.eastLinkBend, [1391, 632], [1393, 620], roadNodes.eastLinkNorthTip],
    },
    {
      id: "east-access-end",
      from: "eastLinkBend",
      to: "eastLinkTip",
      points: [roadNodes.eastLinkBend, roadNodes.eastLinkTip],
    },
  ],
};
