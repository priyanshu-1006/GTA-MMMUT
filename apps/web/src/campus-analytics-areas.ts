import { southernEntrance, worldToAnnotation, type AnnotationPoint } from "@gta-mmmut/world-data";
import { campusAccess, openStage } from "@gta-mmmut/world-data/campus-access";
import { campusBoundary } from "@gta-mmmut/world-data/campus-boundary";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import { campusGardens, type AnnotationRect } from "@gta-mmmut/world-data/campus-gardens";
import { campusRoads } from "@gta-mmmut/world-data/campus-roads";
import { coveredWalkways } from "@gta-mmmut/world-data/covered-walkways";
import { deoriaRoad } from "@gta-mmmut/world-data/deoria-road";
import { nalandaCampusCourt } from "./lecture-courtyards";

const landmarkReach = 20;
const gateReach = 18;
const walkwayReach = coveredWalkways.widthPixels / 2 + 2;
const [courtWest, courtNorth, courtEast, courtSouth] = nalandaCampusCourt;
const nalandaCourt: AnnotationRect = [
  ...worldToAnnotation([courtWest, courtNorth]), ...worldToAnnotation([courtEast, courtSouth]),
];
const landmarkNames: Readonly<Record<string, string>> = {
  "Multi Purpose Hall": "Multipurpose Hall",
  "Cafeteria": "University Cafeteria",
  "Takshilla Lecture Hall Complex": "Takshashila Lecture Hall Complex",
  "Library": "Central Library",
};

const landmarkAreas = campusBuildings.map(({ name, footprint }) => {
  const xs = footprint.map(([x]) => x);
  const ys = footprint.map(([, y]) => y);
  const bounds: AnnotationRect = [
    Math.min(...xs) - landmarkReach, Math.min(...ys) - landmarkReach,
    Math.max(...xs) + landmarkReach, Math.max(...ys) + landmarkReach,
  ];
  return { label: landmarkNames[name] ?? name, footprint, bounds };
});

function inRect([x, y]: AnnotationPoint, [left, top, right, bottom]: AnnotationRect) {
  return x >= left && x <= right && y >= top && y <= bottom;
}

function inOutline([x, y]: AnnotationPoint, outline: readonly AnnotationPoint[]) {
  let inside = false;
  for (let i = 0, previous = outline.length - 1; i < outline.length; previous = i++) {
    const [ax, ay] = outline[previous];
    const [bx, by] = outline[i];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

function distanceSquared([x, y]: AnnotationPoint, [px, py]: AnnotationPoint) {
  return (x - px) ** 2 + (y - py) ** 2;
}

function segmentDistanceSquared([x, y]: AnnotationPoint, [ax, ay]: AnnotationPoint, [bx, by]: AnnotationPoint) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx ** 2 + dy ** 2;
  if (lengthSquared === 0) return (x - ax) ** 2 + (y - ay) ** 2;
  const fraction = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return (x - ax - fraction * dx) ** 2 + (y - ay - fraction * dy) ** 2;
}

function traceDistanceSquared(point: AnnotationPoint, points: readonly AnnotationPoint[], closed = false) {
  let distance = closed ? segmentDistanceSquared(point, points[points.length - 1], points[0]) : Infinity;
  for (let i = 1; i < points.length; i++) {
    distance = Math.min(distance, segmentDistanceSquared(point, points[i - 1], points[i]));
  }
  return distance;
}

const pavement = [...southernEntrance.pavedSurfaces, ...campusRoads.pavedSurfaces];
const roadRoutes = [...southernEntrance.centerlines, ...campusRoads.centerlines].map(({ id, points }) => {
  let label = "South campus road";
  if (id.startsWith("splitter-")) label = "Entrance forecourt";
  else if (id === "entrance-approach" || id === "gate-apron") label = "Main gate approach";
  else if (id.startsWith("west-spine") || id.startsWith("west-access")) label = "West campus road";
  else if (id.startsWith("north-")) label = "North campus road";
  else if (id.startsWith("east-")) label = "East campus road";
  return { label, points };
});

/** Group free-roam samples by landmark or route without sending coordinates. */
export function campusAreaAt(point: AnnotationPoint): string {
  if (deoriaRoad.surfaces.some(({ kind, outline }) => kind !== "apron" && inOutline(point, outline))) return deoriaRoad.label;
  if (distanceSquared(point, southernEntrance.gate.position) <= gateReach ** 2) return "Main gate";
  if (distanceSquared(point, campusBoundary.oldGate.position) <= gateReach ** 2) return "Old gate";
  if (inOutline(point, southernEntrance.splitterIsland.outline)) return "Entrance fountain";

  const { atal, east, placementParking } = campusGardens;
  if ([...atal.quarters, ...atal.paths].some((bounds) => inRect(point, bounds))) return "Atal Bhawan garden";
  if ([...east.lawns, east.path].some((bounds) => inRect(point, bounds))) return "Entrance garden";
  if (inRect(point, placementParking.lot) || inOutline(point, placementParking.driveway)) return "TNP parking";
  if (inRect(point, openStage.bounds) || inRect(point, openStage.stairs.bounds)) return openStage.label;
  if (inRect(point, nalandaCourt)) return "Nalanda courtyard";

  const accessRoad = campusAccess.roads.find(({ outline }) => inOutline(point, outline));
  if (accessRoad) return accessRoad.label;
  if (pavement.some(({ outline }) => inOutline(point, outline))) {
    let nearest = Infinity;
    let road = "Campus roads";
    for (const { label, points } of roadRoutes) {
      const distance = traceDistanceSquared(point, points);
      if (distance >= nearest) continue;
      nearest = distance;
      road = label;
    }
    return road;
  }

  let nearest = landmarkReach ** 2;
  let landmark: string | undefined;
  for (const { label, footprint, bounds } of landmarkAreas) {
    if (!inRect(point, bounds)) continue;
    const distance = inOutline(point, footprint) ? 0 : traceDistanceSquared(point, footprint, true);
    if (distance >= nearest) continue;
    nearest = distance;
    landmark = label;
  }
  if (landmark) return landmark;
  if (coveredWalkways.segments.some(({ points }) => traceDistanceSquared(point, points) <= walkwayReach ** 2)) return "Covered walkway";
  return "Other campus areas";
}
