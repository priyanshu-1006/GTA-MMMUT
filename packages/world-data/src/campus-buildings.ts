import { adminCoreBuildings } from "./admin-core";
import { campusRegistry } from "./registry";
import type { AnnotationPoint } from "./southern-entrance";

type MassStyle = "low" | "standard" | "hall";
type RoofTint = "neutral" | "blue" | "terracotta";

interface RoofTrace {
  readonly footprint: readonly AnnotationPoint[];
  readonly holes?: readonly (readonly AnnotationPoint[])[];
  readonly style: MassStyle;
  readonly roofTint?: RoofTint;
  readonly partial?: true;
}

// Approximate visible roof silhouettes on the registry's annotation canvas.
// A source pin can label a compound from its courtyard or an adjacent gap.
const traces: Readonly<Record<string, RoofTrace>> = {
  // Northwest residences and auditorium. Tree cover limits the quarters traces.
  B06: {
    style: "low", partial: true,
    footprint: [[334, 126], [354, 125], [354, 154], [361, 159], [361, 170], [350, 178],
      [347, 189], [336, 194], [336, 173], [328, 173], [328, 163], [334, 159]],
  },
  B07: {
    style: "low", partial: true,
    footprint: [[431, 138], [448, 135], [466, 126], [466, 150], [456, 156], [457, 191],
      [438, 191], [438, 173], [430, 165]],
  },
  B08: {
    style: "low", partial: true,
    footprint: [[336, 244], [354, 242], [353, 268], [361, 280], [363, 302], [352, 310],
      [338, 315], [338, 296], [330, 287], [330, 257]],
  },
  B09: {
    style: "low", partial: true,
    footprint: [[437, 237], [452, 239], [467, 248], [468, 302], [456, 312], [449, 320],
      [437, 309], [437, 289], [429, 285], [429, 254], [436, 252]],
  },
  B10: {
    style: "hall", roofTint: "blue",
    footprint: [[105, 351], [142, 337], [137, 323], [159, 315], [166, 328], [194, 316],
      [220, 389], [231, 392], [239, 411], [233, 414], [254, 467], [186, 492], [173, 499], [149, 496]],
  },
  B11: {
    style: "low",
    footprint: [[347, 384], [375, 384], [375, 391], [397, 391], [397, 411], [346, 411]],
  },
  B12: {
    style: "low",
    footprint: [[410, 393], [438, 390], [438, 415], [444, 415], [444, 431], [435, 431],
      [435, 450], [401, 450], [401, 432], [410, 432]],
  },

  // The aerial cuts off the northern hall. Only its visible roof is traced.
  B16: { style: "hall", partial: true, footprint: [[788, 1], [851, 1], [851, 23], [790, 23]] },
  B17: {
    style: "hall", roofTint: "terracotta",
    footprint: [[815, 24], [854, 25], [853, 55], [798, 55], [798, 41], [815, 41]],
  },
  B19: {
    style: "low",
    footprint: [[552, 77], [577, 77], [577, 90], [588, 90], [588, 104], [571, 104], [571, 112], [552, 112]],
  },
  B20: {
    style: "low",
    footprint: [[569, 147], [624, 147], [624, 144], [648, 144], [648, 174], [569, 174]],
  },
  B21: {
    style: "low", roofTint: "terracotta",
    footprint: [[631, 111], [644, 103], [652, 109], [664, 109], [676, 103], [687, 109],
      [697, 109], [708, 104], [719, 112], [719, 124], [708, 131], [695, 124], [685, 131],
      [675, 125], [664, 130], [653, 124], [641, 128], [631, 121]],
  },
  B22: {
    style: "standard",
    footprint: [[694, 204], [712, 204], [712, 195], [730, 195], [730, 204], [748, 204], [748, 265], [694, 265]],
  },
  B23: {
    style: "standard",
    footprint: [[766, 206], [805, 206], [805, 239], [825, 239], [825, 206], [849, 206],
      [855, 213], [855, 296], [817, 296], [817, 255], [800, 255], [800, 266], [766, 266]],
  },
  B24: {
    style: "standard", roofTint: "blue",
    footprint: [[878, 207], [911, 207], [911, 196], [928, 196], [928, 207], [957, 207],
      [957, 314], [875, 314], [875, 289], [878, 289]],
  },
  B25: {
    style: "standard",
    footprint: [[664, 299], [736, 299], [736, 310], [749, 310], [749, 324], [736, 324], [736, 347], [664, 347]],
  },
  B26: {
    style: "standard",
    footprint: [[750, 297], [815, 297], [815, 315], [804, 315], [804, 344], [782, 344],
      [782, 351], [761, 351], [761, 362], [742, 362], [742, 329], [750, 329]],
  },
  B27: { style: "standard", footprint: [[875, 316], [916, 316], [916, 345], [875, 345]] },
  B28: {
    style: "standard",
    footprint: [[659, 400], [706, 400], [706, 412], [718, 412], [718, 426], [708, 426], [708, 448], [659, 448]],
  },
  B29: {
    style: "standard",
    footprint: [[735, 374], [809, 374], [809, 448], [708, 448], [708, 426], [723, 426], [723, 416], [735, 416]],
  },
  B30: { style: "standard", footprint: [[1012, 127], [1059, 127], [1059, 175], [1012, 175]] },
  B31: {
    style: "standard",
    footprint: [[1009, 189], [1059, 189], [1059, 235], [1046, 235], [1046, 245], [1064, 245],
      [1064, 260], [1029, 260], [1029, 237], [1009, 237]],
  },
  B32: {
    style: "standard",
    footprint: [[1010, 263], [1029, 263], [1029, 276], [1054, 276], [1054, 291], [1077, 291],
      [1077, 286], [1118, 286], [1121, 320], [1035, 320], [1035, 293], [1010, 293]],
  },
  B33: { style: "standard", footprint: [[980, 331], [1090, 331], [1090, 352], [980, 352]] },
  // B34 identifies the east wing across the court from the source pin.
  B34: { style: "standard", partial: true, footprint: [[1082, 367], [1097, 367], [1097, 421], [1082, 421]] },
  B35: { style: "standard", footprint: [[981, 435], [1090, 435], [1090, 454], [981, 454]] },

  // B36 sits between two roof strips. The visible east strip is the proxy.
  B36: { style: "standard", partial: true, footprint: [[1107, 117], [1134, 117], [1135, 173], [1107, 173]] },
  B38: { style: "hall", roofTint: "blue", footprint: [[1243, 100], [1358, 100], [1359, 138], [1243, 138]] },
  B39: { style: "hall", roofTint: "blue", footprint: [[1423, 99], [1531, 100], [1532, 139], [1423, 139]] },
  B40: { style: "hall", roofTint: "blue", footprint: [[1498, 142], [1532, 142], [1530, 214], [1498, 214]] },
  B41: { style: "hall", roofTint: "blue", footprint: [[1244, 219], [1360, 219], [1360, 251], [1244, 251]] },
  B42: { style: "hall", roofTint: "blue", partial: true, footprint: [[1425, 219], [1524, 219], [1526, 254], [1425, 254]] },
  B43: {
    style: "standard",
    footprint: [[1123, 193], [1173, 193], [1173, 254], [1178, 254], [1178, 272],
      [1134, 272], [1134, 266], [1123, 266]],
  },
  B44: { style: "standard", roofTint: "blue", footprint: [[1184, 192], [1225, 192], [1225, 269], [1184, 269]] },
  B45: {
    style: "hall", roofTint: "blue",
    footprint: [[1235, 257], [1378, 257], [1383, 264], [1374, 279], [1374, 308],
      [1362, 308], [1362, 286], [1351, 286], [1351, 308], [1231, 308], [1231, 303],
      [1219, 303], [1219, 287], [1235, 287]],
  },
  B46: { style: "standard", footprint: [[1177, 297], [1212, 297], [1212, 314], [1177, 314]] },
  B47: {
    style: "hall", roofTint: "blue",
    footprint: [[1215, 332], [1305, 332], [1305, 337], [1324, 337], [1324, 353], [1329, 353],
      [1329, 386], [1309, 386], [1309, 417], [1214, 417], [1214, 389], [1194, 389],
      [1194, 355], [1203, 355], [1203, 342], [1215, 342]],
    holes: [[[1225, 358], [1295, 358], [1295, 387], [1225, 387]]],
  },
  B48: {
    style: "standard",
    footprint: [[1123, 330], [1164, 330], [1164, 420], [1124, 420], [1124, 378],
      [1100, 378], [1100, 355], [1123, 355]],
  },
  B49: {
    style: "standard", roofTint: "blue",
    footprint: [[1201, 432], [1256, 432], [1256, 490], [1261, 490], [1261, 517],
      [1187, 517], [1187, 493], [1201, 493]],
  },
  B52: {
    style: "standard",
    footprint: [[1122, 424], [1179, 424], [1179, 442], [1156, 442], [1156, 456],
      [1170, 456], [1170, 504], [1150, 504], [1150, 512], [1115, 512], [1115, 448], [1122, 448]],
  },

  // The hostel and guest house pins sit in their respective courtyards.
  B53: {
    style: "standard",
    footprint: [[327, 502], [438, 502], [438, 516], [443, 516], [443, 558], [437, 558],
      [437, 574], [327, 574], [327, 563], [305, 563], [305, 516], [327, 516]],
    holes: [[[338, 523], [406, 523], [406, 554], [338, 554]]],
  },
  B55: {
    style: "standard", partial: true,
    footprint: [[358, 758], [395, 758], [412, 727], [428, 734], [414, 764],
      [414, 774], [430, 798], [414, 805], [397, 772], [358, 772]],
  },
  B73: { style: "standard", footprint: [[762, 484], [816, 484], [816, 520], [762, 520]] },
  B74: {
    style: "standard",
    footprint: [[683, 485], [735, 485], [735, 497], [762, 497], [762, 510], [758, 510],
      [758, 532], [745, 532], [745, 509], [735, 509], [735, 520], [687, 520], [687, 511], [683, 511]],
  },
};

const proxyHeight = { low: 4.2, standard: 6.3, hall: 8.1 } as const;
const confirmedById = new Map(campusRegistry.filter(({ status }) => status === "CONFIRMED").map((building) => [building.id, building]));

export const campusBuildings = [
  ...adminCoreBuildings.map((building) => ({
    ...building,
    holes: [],
    style: "standard" as MassStyle,
    roofTint: "neutral" as RoofTint,
    partial: false,
  })),
  ...Object.entries(traces).map(([id, trace]) => {
    const building = confirmedById.get(id);
    if (!building) throw new Error(`Missing confirmed building ${id}`);
    return {
      ...building,
      footprint: trace.footprint,
      holes: trace.holes ?? [],
      footprintStatus: "PROVISIONAL" as const,
      // These are display heights, with no inferred floors for unverified cases.
      height: building.floorCount === null ? proxyHeight[trace.style] : 3.5 * building.floorCount,
      style: trace.style,
      roofTint: trace.roofTint ?? "neutral",
      partial: trace.partial ?? false,
    };
  }),
].sort((a, b) => a.id.localeCompare(b.id));
