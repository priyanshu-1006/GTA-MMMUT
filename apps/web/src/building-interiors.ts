import type { WorldGroundPoint } from "@gta-mmmut/world-data";

export const buildingInteriors = {
  cse: { title: "CSE Department", entryName: "CSE", view: "cse", meshIds: ["B22", "B23"], directions: "Follow the corridor to Old CSE. The stairs on the left in New CSE connect the floors." },
  library: { title: "Central Library", entryName: "Central Library", view: "library", meshIds: ["B75"], directions: "The split staircase beyond the reading tables leads to the upper book galleries." },
  hall: { title: "Multipurpose Hall", entryName: "Multipurpose Hall", view: "hall", meshIds: ["B16", "B17"], directions: "The center and side aisles lead to the stage stairs." },
  nalanda: { title: "Nalanda Lecture Hall Complex", entryName: "Nalanda", view: "nalanda", meshIds: ["B33", "B34", "B35"], directions: "L-103 to L-105 are in the Library wing. L-106 to L-108 are in the Electrical wing." },
  pushpagiri: { title: "Pushpagiri Lecture Hall Complex", entryName: "Pushpagiri", view: "pushpagiri", meshIds: ["B45"], directions: "Use either end staircase to reach the first-floor gallery." },
  takshashila: { title: "Takshashila Lecture Hall Complex", entryName: "Takshashila", view: "takshashila-entry", meshIds: ["B47"], directions: "Follow the gallery around the open courtyard to find the lecture halls and stairs." },
} as const;

export type InteriorId = keyof typeof buildingInteriors;
export type PortalTarget = InteriorId | "exit";

export function interiorForView(view: string): InteriorId | null {
  if (view === "cse-complex") return "cse";
  if (view === "takshashila") return "takshashila";
  if (view === "nalanda-courtyard") return "nalanda";
  for (const id of Object.keys(buildingInteriors) as InteriorId[]) {
    if (buildingInteriors[id].view === view) return id;
  }
  return null;
}

export interface BuildingDoorway {
  readonly id: InteriorId;
  readonly point: WorldGroundPoint;
  readonly outward: WorldGroundPoint;
  readonly baseY?: number;
  readonly width: number;
  readonly height: number;
  readonly finish: string;
}
