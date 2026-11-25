import type { WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusMissionLocations, type CampusMissionLocationId } from "./campus-mission-locations";
import type { VehicleId, VehicleState } from "./campus-vehicles";

export const chaiMissionVehicle = "bullet";

export const campusMissions = {
  delivery: { title: "T&P to CSE", summary: "Deliver the Alto 800 to Dr. Pradeep Kumar Singh.", first: "collectCar" },
  chai: { title: "Chai with a friend", summary: "Meet at the entrance garden and ride to the cafeteria.", first: "meetFriend" },
} as const;

export type CampusMissionId = keyof typeof campusMissions;
type Step = "collectCar" | "parkCar" | "handoff" | "meetFriend" | "mountBike" | "parkBike" | "enterCafe" | "shareChai" | "complete";

export interface CampusMissionProgress {
  readonly id: CampusMissionId;
  readonly step: Step;
}

export interface CampusMissionSnapshot {
  readonly player: WorldGroundPoint;
  readonly driving: VehicleId | null;
  readonly vehicle: Pick<VehicleState, "position" | "speed"> | undefined;
}

interface Objective {
  readonly text: string;
  readonly target?: CampusMissionLocationId;
  readonly action?: string;
}

export const missionObjectives: Record<Step, Objective> = {
  collectCar: { text: "Go to T&P parking and enter the marked Alto 800.", target: "tnpCar" },
  parkCar: { text: "Drive to the marked CSE bay, stop, and press E to get out.", target: "cseParking" },
  handoff: { text: "Walk over to Dr. Pradeep Kumar Singh and hand over the keys.", target: "cseHandoff", action: "Hand over keys" },
  meetFriend: { text: "Find your friend in the garden to the right of the main gate.", target: "gardenFriend", action: "Meet friend" },
  mountBike: { text: "Walk to the marked Royal Enfield Bullet and press E. Your friend will ride with you.", target: "gardenBike" },
  parkBike: { text: "Ride to the marked cafeteria bay, stop, and press E to dismount.", target: "cafeteriaParking" },
  enterCafe: { text: "Walk up to the cafeteria entrance and press E to go inside.", target: "cafeteriaDoor" },
  shareChai: { text: "Join your friend at the back-right table and share chai.", action: "Share chai" },
  complete: { text: "Mission complete." },
};

export const missionFriendShirt = "#43877c";

export function isAtMissionLocation(point: WorldGroundPoint, id: CampusMissionLocationId) {
  const { point: [x, z], radius } = campusMissionLocations[id];
  return Math.hypot(point[0] - x, point[1] - z) <= radius;
}

function parkedAt(snapshot: CampusMissionSnapshot, target: CampusMissionLocationId) {
  return snapshot.vehicle && Math.abs(snapshot.vehicle.speed) < 0.7 && isAtMissionLocation(snapshot.vehicle.position, target);
}

export function missionActionAvailable(progress: CampusMissionProgress, snapshot: CampusMissionSnapshot) {
  if (snapshot.driving) return false;
  if (progress.step === "meetFriend") return isAtMissionLocation(snapshot.player, "gardenFriend");
  return progress.step === "handoff" && Boolean(parkedAt(snapshot, "cseParking")) &&
    isAtMissionLocation(snapshot.player, "cseHandoff");
}

export function updateCampusMission(progress: CampusMissionProgress, snapshot: CampusMissionSnapshot): CampusMissionProgress {
  let step = progress.step;
  switch (step) {
    case "collectCar":
      if (snapshot.driving === "hatchback" && isAtMissionLocation(snapshot.player, "tnpCar")) step = "parkCar";
      break;
    case "parkCar":
      if (!snapshot.driving && parkedAt(snapshot, "cseParking") && isAtMissionLocation(snapshot.player, "cseParking")) step = "handoff";
      break;
    case "handoff":
      if (!parkedAt(snapshot, "cseParking")) step = "parkCar";
      break;
    case "mountBike":
      if (snapshot.driving === chaiMissionVehicle && isAtMissionLocation(snapshot.player, "gardenBike")) step = "parkBike";
      break;
    case "parkBike":
      if (!snapshot.driving && parkedAt(snapshot, "cafeteriaParking") && isAtMissionLocation(snapshot.player, "cafeteriaParking")) step = "enterCafe";
      break;
    case "enterCafe":
      if (!parkedAt(snapshot, "cafeteriaParking")) step = "parkBike";
      break;
  }
  return step === progress.step ? progress : { ...progress, step };
}

const completionKey = "gta-mmmut.missions.v1";

export function loadCompletedMissions(): CampusMissionId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(completionKey) ?? "[]");
    return Array.isArray(saved) ? (Object.keys(campusMissions) as CampusMissionId[]).filter((id) => saved.includes(id)) : [];
  } catch {
    return [];
  }
}

export function saveCompletedMissions(ids: readonly CampusMissionId[]) {
  try {
    localStorage.setItem(completionKey, JSON.stringify(ids));
  } catch {
    // Mission completion is still available in this session when storage is disabled.
  }
}
