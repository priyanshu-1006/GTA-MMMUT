import { annotationToWorld, type AnnotationPoint, type WorldGroundPoint } from "@gta-mmmut/world-data";

interface CampusMissionLocation {
  readonly point: WorldGroundPoint;
  readonly label: string;
  readonly radius: number;
}

function location(pin: AnnotationPoint, label: string, radius: number): CampusMissionLocation {
  return { point: annotationToWorld(pin), label, radius };
}

// Mission-specific parking and interaction points are authored for the game.
export const campusMissionLocations = {
  tnpCar: location([1064.75, 612], "T&P car pickup", 4),
  cseParking: location([718, 174], "Park near CSE", 2.6),
  cseHandoff: location([727, 190], "Dr. Pradeep Kumar Singh", 2.5),
  gardenFriend: location([952, 769], "Meet your friend", 2.5),
  gardenBike: location([906.7, 770], "Ride with your friend", 3.2),
  cafeteriaParking: location([678, 152], "Cafeteria bike parking", 2.2),
  cafeteriaDoor: location([667.22, 134], "Cafeteria entrance", 2.8),
} as const;

export type CampusMissionLocationId = keyof typeof campusMissionLocations;
