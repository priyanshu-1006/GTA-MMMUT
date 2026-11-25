import { expect, it } from "vitest";
import { campusGardens } from "../packages/world-data/src/campus-gardens";
import { campusRoads } from "../packages/world-data/src/campus-roads";
import { southernEntrance, worldToAnnotation, type AnnotationPoint } from "../packages/world-data/src/southern-entrance";
import { campusMissionLocations as locations } from "../apps/web/src/campus-mission-locations";
import { campusMissionRoute } from "../apps/web/src/campus-mission-routes";

function contains([x, z]: AnnotationPoint, outline: readonly AnnotationPoint[]) {
  return outline.reduce((inside, [startX, startZ], index) => {
    const [endX, endZ] = outline[(index + 1) % outline.length];
    const crosses = (startZ > z) !== (endZ > z)
      && x < startX + (endX - startX) * (z - startZ) / (endZ - startZ);
    return crosses ? !inside : inside;
  }, false);
}

const { lot: [west, north, east, south], driveway } = campusGardens.placementParking;
const surfaces: readonly (readonly AnnotationPoint[])[] = [
  ...[...southernEntrance.pavedSurfaces, ...campusRoads.pavedSurfaces].map(({ outline }) => outline),
  [[west, north], [east, north], [east, south], [west, south]],
  driveway,
  // The access slabs and bays placed by campus-mission-world.ts.
  [[714.6, 168.4], [721.4, 168.4], [721.4, 179.6], [714.6, 179.6]],
  [[714.15, 176.8], [721.85, 176.8], [721.85, 181.8], [714.15, 181.8]],
  [[676.1, 149.1], [679.9, 149.1], [679.9, 154.9], [676.1, 154.9]],
  [[675.3, 152.3], [680.7, 152.3], [680.7, 187.7], [675.3, 187.7]],
];

it.each([
  ["parkCar", locations.tnpCar, locations.cseParking],
  ["parkBike", locations.gardenBike, locations.cafeteriaParking],
] as const)("keeps the %s route on the connected paving and outside the fountain island", (step, from, to) => {
  const route = campusMissionRoute(step)!;
  expect(route[0]).toEqual(worldToAnnotation(from.point));
  expect(route.at(-1)).toEqual(worldToAnnotation(to.point));
  for (let index = 1; index < route.length; index++) {
    const [x, z] = route[index - 1];
    const dx = route[index][0] - x;
    const dz = route[index][1] - z;
    const count = Math.ceil(Math.hypot(dx, dz));
    for (let sample = 0; sample < count; sample++) {
      const fraction = (sample + 0.5) / count;
      const point: AnnotationPoint = [x + dx * fraction, z + dz * fraction];
      expect(surfaces.some((surface) => contains(point, surface)), `Unpaved route at ${point}`).toBe(true);
      expect(contains(point, southernEntrance.splitterIsland.outline), `Fountain island at ${point}`).toBe(false);
    }
  }
});
