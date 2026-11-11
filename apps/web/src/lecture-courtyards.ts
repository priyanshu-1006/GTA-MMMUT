import { annotationToWorld } from "@gta-mmmut/world-data";
import type { InteriorBounds } from "./interior-furnishing";

export const nalandaGalleryRise = 0.6096;
export const nalandaGalleryWidth = 3.2;
export const nalandaGalleryHeadroom = 2.92;
export const nalandaCampusGardenY = 0.025;
export const nalandaCampusDeckY = nalandaCampusGardenY + nalandaGalleryRise;
export const nalandaCampusEntrance = annotationToWorld([980, 393]);
const [nalandaWest, nalandaNorth] = annotationToWorld([980, 352]);
const [nalandaEast, nalandaSouth] = annotationToWorld([1082, 435]);
export const nalandaCampusCourt: InteriorBounds = [nalandaWest, nalandaNorth, nalandaEast, nalandaSouth];
const entranceRun = 3.58;
const landingRun = 0.9;
const entranceHalfWidth = 1.56;

export function insetCourt([left, rear, right, front]: InteriorBounds, width: number): InteriorBounds {
  return [left + width, rear + width, right - width, front - width];
}

export function courtGalleries([left, rear, right, front]: InteriorBounds,
  [courtLeft, courtRear, courtRight, courtFront]: InteriorBounds): readonly InteriorBounds[] {
  return [
    [left, rear, right, courtRear], [left, courtFront, right, front],
    [left, courtRear, courtLeft, courtFront], [courtRight, courtRear, right, courtFront],
  ];
}

export function inCourt([left, rear, right, front]: InteriorBounds, x: number, z: number) {
  return x >= left && x <= right && z >= rear && z <= front;
}

export function courtStairs([left, rear, right, front]: InteriorBounds): InteriorBounds[] {
  const center = (rear + front) / 2;
  return [[left, center - 1.25, left + 1.35, center + 1.25], [right - 1.35, center - 1.25, right, center + 1.25]];
}

export function courtStairHeight(bounds: InteriorBounds, x: number, east: boolean, deck: number) {
  const distance = east ? bounds[2] - x : x - bounds[0];
  const step = Math.min(3, Math.floor(distance / 0.45));
  return deck - step * nalandaGalleryRise / 3;
}

export const takshashilaCourt = [-21, -21, 21, -6] as const;
export const takshashilaGalleryWidth = 4;
export const nalandaCampusGarden = insetCourt(nalandaCampusCourt, nalandaGalleryWidth);
export const nalandaCampusGalleries = courtGalleries(nalandaCampusCourt, nalandaCampusGarden);
export const nalandaCampusStairs = courtStairs(nalandaCampusGarden);
export const nalandaEntranceRamp: InteriorBounds = [nalandaWest - entranceRun, nalandaCampusEntrance[1] - entranceHalfWidth,
  nalandaWest, nalandaCampusEntrance[1] + entranceHalfWidth];

export function nalandaCampusFloor(x: number, z: number) {
  if (inCourt(nalandaEntranceRamp, x, z)) {
    return nalandaCampusGardenY + nalandaGalleryRise * Math.min(1, (x - nalandaEntranceRamp[0]) / (entranceRun - landingRun));
  }
  const step = nalandaCampusStairs.findIndex((bounds) => inCourt(bounds, x, z));
  if (step >= 0) return courtStairHeight(nalandaCampusStairs[step], x, step === 1, nalandaCampusDeckY);
  if (nalandaCampusGalleries.some((gallery) => inCourt(gallery, x, z))) return nalandaCampusDeckY;
  return undefined;
}
