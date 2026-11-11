import { campusRegistry } from "./registry";
import type { AnnotationPoint } from "./southern-entrance";

// Exterior roof traces on the registry's 1623 × 928 annotation canvas.
// Heights define visual proxies and do not imply surveyed dimensions.
const proxies: readonly {
  id: "B70" | "B71" | "B72" | "B75";
  height: number;
  footprint: readonly AnnotationPoint[];
}[] = [
  {
    id: "B70",
    height: 8.4,
    footprint: [
      [645, 675], [692, 675], [692, 728], [701, 730], [708, 735],
      [713, 742], [713, 749], [708, 757], [701, 761], [692, 763],
      [692, 823], [648, 823], [648, 806], [643, 806], [643, 675],
    ],
  },
  {
    id: "B71",
    height: 7,
    footprint: [
      [814, 552], [975, 552], [975, 581], [912, 581],
      [912, 608], [879, 608], [879, 581], [814, 581],
    ],
  },
  {
    id: "B72",
    height: 7,
    footprint: [[1002, 558], [1080, 558], [1080, 591], [1002, 591]],
  },
  {
    id: "B75",
    height: 7.3,
    footprint: [
      [996, 469], [1080, 469], [1080, 520], [1037, 520], [1037, 543],
      [997, 543], [997, 522], [983, 522], [983, 487], [996, 487],
    ],
  },
];

export const adminCoreBuildings = proxies.map((proxy) => {
  const building = campusRegistry.find(({ id }) => id === proxy.id);
  if (building?.status !== "CONFIRMED") throw new Error(`Missing confirmed building ${proxy.id}`);
  return { ...building, ...proxy, footprintStatus: "PROVISIONAL" as const };
});
