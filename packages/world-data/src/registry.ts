import source from "../../../GTA_MMMUT_Preproduction_Master_Pack_v01/map/data/building_registry.json";
import type { AnnotationPoint } from "./southern-entrance";

const statuses = {
  CONFIRMED: "CONFIRMED",
  UNIDENTIFIED: "UNKNOWN",
  UNDER_CONSTRUCTION: "CONSTRUCTION",
  OUTSIDE: "OUTSIDE_CAMPUS",
} as const;

type SourceStatus = keyof typeof statuses;

export const campusRegistry = source.map((building) => {
  const status = statuses[building.status as SourceStatus];
  if (!status) throw new Error(`Invalid campus status for ${building.id}`);
  const anchor: AnnotationPoint = [building.map_x_px, building.map_y_px];
  return {
    id: building.id,
    name: building.name,
    anchor,
    sourceStatus: building.status,
    status,
    floorCount: building.floors === "" ? null : Number(building.floors),
  };
});
