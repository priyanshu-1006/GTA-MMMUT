import type { VehicleState } from "./campus-vehicles";
import type { PortalTarget } from "./building-interiors";

export const playerCameras = {
  follow: "Third person",
  shoulder: "Over the shoulder",
  wide: "Wide third person",
  first: "First person",
} as const;

export type PlayerCamera = keyof typeof playerCameras;

export interface PlayerStatus {
  camera: PlayerCamera;
  vehicle: string | null;
  vehicleKind: VehicleState["kind"] | null;
  nearby: string | null;
  portalNearby: PortalTarget | null;
  speed: number;
}
