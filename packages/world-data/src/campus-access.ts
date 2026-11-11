import type { AnnotationPoint } from "./southern-entrance";

interface AccessRoad {
  readonly id: string;
  readonly label: string;
  readonly outline: readonly AnnotationPoint[];
  readonly centerline: readonly AnnotationPoint[];
}

export const atalDrivewayOpening = [[887, 799], [887, 810]] as const satisfies readonly AnnotationPoint[];
export const itCampusSplitRow = 270;

// Local aerial alignments and destination approaches are provisional. The
// roads stop at exterior approaches rather than assigning exact doorways.
export const campusAccess = {
  status: "PROVISIONAL",
  roads: [
    {
      id: "atal-perimeter-drive",
      label: "Atal Bhawan drive",
      outline: [
        ...atalDrivewayOpening, [876, 817], [756, 819], [736, 817],
        [723, 811], [718, 801], [717, 778], [718, 750.5], [731, 750.5],
        [731, 785], [732, 796], [737, 802], [752, 804], [875, 804],
      ],
      centerline: [[887, 805], [875, 810], [753, 811], [732, 807], [725, 796], [724, 750.5]],
    },
    {
      id: "placement-library-drive",
      label: "TNP parking to Library",
      outline: [
        [1011, 610], [1011, 623], [995, 623], [989, 620], [985, 612],
        [985, 543], [998, 543], [998, 602], [1000, 607], [1005, 610],
      ],
      centerline: [[1011, 616], [999, 616], [993, 613], [991.5, 606], [991.5, 543]],
    },
    {
      id: "administration-civil-drive",
      label: "Administration to Civil",
      outline: [
        // The two short bottom edges lie on the existing southern road.
        [796.625, 640.5], [801, 629], [803, 608], [803, 554], [804, 537],
        [803, 520], [812, 520], [812, 590], [813, 621],
        [816.75, 641.75], [806, 641],
      ],
      centerline: [[806, 641], [807, 624], [807.5, 554], [808, 520]],
    },
    {
      id: "mechanical-approach-drive",
      label: "Mechanical Engineering approach",
      outline: [
        [1145, 617], [1144, 580], [1140, 571], [1140, 557], [1159, 557],
        [1159, 571], [1155, 578], [1155, 617],
      ],
      centerline: [[1150, 617], [1150, 580], [1149.5, 569], [1149.5, 557]],
    },
  ] satisfies readonly AccessRoad[],
  mechanicalEntrance: {
    position: [1149.5, 550],
    outline: [[1122, 519], [1181, 519], [1183, 525], [1183, 550], [1122, 550]],
    link: [[1140, 512], [1150, 512], [1150, 519], [1140, 519]],
  },
  cseLink: [[748, 210], [766, 210], [766, 219], [748, 219]],
} as const;

// The owner specified seven feet. The platform's plan and stair position
// are provisional and refer to the open area immediately west of Civil I.
export const openStage = {
  id: "civil-open-stage",
  label: "Open stage",
  status: "PROVISIONAL",
  heightMeters: 2.1336,
  bounds: [651, 487, 679, 512],
  footprint: [[651, 487], [679, 487], [679, 512], [651, 512]],
  stairs: { bounds: [661, 512, 669, 520], risers: 12 },
} as const;
