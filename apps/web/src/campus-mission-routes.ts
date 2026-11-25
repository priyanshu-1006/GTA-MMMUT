import {
  southernEntrance,
  worldToAnnotation,
  type AnnotationPoint,
} from "@gta-mmmut/world-data";
import { campusGardens } from "@gta-mmmut/world-data/campus-gardens";
import { campusRoads } from "@gta-mmmut/world-data/campus-roads";
import { campusMissionLocations } from "./campus-mission-locations";
import type { CampusMissionProgress } from "./campus-missions";

const roadLines = new Map([...southernEntrance.centerlines, ...campusRoads.centerlines]
  .map(({ id, points }) => [id, points]));

function centerline(id: string) {
  const points = roadLines.get(id);
  if (!points) throw new Error(`Missing mission road centerline ${id}`);
  return points;
}

// The turnoffs for these bays fall between the mapped road vertices.
function roadToTurnoff(id: string, axis: 0 | 1, coordinate: number): AnnotationPoint[] {
  const points = centerline(id);
  const endIndex = points.findIndex((point) => point[axis] >= coordinate);
  if (endIndex < 1) throw new Error(`Mission turnoff lies outside ${id}`);
  const start = points[endIndex - 1];
  const end = points[endIndex];
  const fraction = (coordinate - start[axis]) / (end[axis] - start[axis]);
  return [...points.slice(0, endIndex), [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ]];
}

function joinRoute(...sections: readonly (readonly AnnotationPoint[])[]) {
  return sections.flat().filter(([x, z], index, points) =>
    index === 0 || x !== points[index - 1][0] || z !== points[index - 1][1]);
}

const toWestAccess = [
  ...[...centerline("west-campus-connection")].reverse(),
  ...[...centerline("west-spine-north")].reverse(),
  ...centerline("west-spine-to-north"),
  ...centerline("west-spine-middle-south"),
  ...centerline("west-spine-middle-north"),
];

const [pickup, cseBay, bike, cafeBay] = [
  campusMissionLocations.tnpCar,
  campusMissionLocations.cseParking,
  campusMissionLocations.gardenBike,
  campusMissionLocations.cafeteriaParking,
].map(({ point }) => worldToAnnotation(point));
const { driveway, stalls } = campusGardens.placementParking;
const drivewayX = (driveway[0][0] + driveway[1][0]) / 2;
const parkingAisle = stalls.top + stalls.depth + 5;

const deliveryRoute = joinRoute(
  // Leave the pickup stall via the shared aisle before turning toward the road.
  [pickup, [pickup[0], parkingAisle], [drivewayX, parkingAisle], [drivewayX, driveway[0][1]]],
  roadToTurnoff("east-paved-link", 0, drivewayX).reverse(),
  [...centerline("east-campus-connection")].reverse(),
  [...centerline("splitter-north")].reverse(),
  toWestAccess,
  roadToTurnoff("west-access-north", 0, cseBay[0]),
  [cseBay],
);

const chaiRoute = joinRoute(
  [bike],
  roadToTurnoff("entrance-approach", 1, bike[1] - 10).reverse(),
  [...centerline("splitter-west")].reverse(),
  toWestAccess,
  roadToTurnoff("west-access-north", 0, cafeBay[0]),
  [cafeBay],
);

const vehicleRoutes: Partial<Record<CampusMissionProgress["step"], readonly AnnotationPoint[]>> = {
  parkCar: deliveryRoute,
  parkBike: chaiRoute,
};

export function campusMissionRoute(step: CampusMissionProgress["step"]) {
  return vehicleRoutes[step] ?? null;
}
