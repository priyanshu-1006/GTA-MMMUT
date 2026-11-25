import { describe, expect, it } from "vitest";
import { campusMissionLocations as locations } from "../apps/web/src/campus-mission-locations";
import { missionActionAvailable, updateCampusMission, type CampusMissionProgress } from "../apps/web/src/campus-missions";

describe("campus mission checkpoints", () => {
  it("requires the T&P car, a stopped car at CSE and an on-foot handoff", () => {
    const pickup: CampusMissionProgress = { id: "delivery", step: "collectCar" };
    const atTnp = { player: locations.tnpCar.point, vehicle: { position: locations.tnpCar.point, speed: 0 } };
    expect(updateCampusMission(pickup, { ...atTnp, driving: "sedan" })).toBe(pickup);
    const delivery = updateCampusMission(pickup, { ...atTnp, driving: "hatchback" });
    expect(delivery.step).toBe("parkCar");
    const atCse = { player: locations.cseParking.point, vehicle: { position: locations.cseParking.point, speed: 0 } };
    expect(updateCampusMission(delivery, { ...atCse, driving: "hatchback" })).toBe(delivery);
    expect(updateCampusMission(delivery, { ...atCse, driving: null, vehicle: { ...atCse.vehicle, speed: 4 } })).toBe(delivery);
    const handoff = updateCampusMission(delivery, { ...atCse, driving: null });
    expect(handoff.step).toBe("handoff");
    expect(missionActionAvailable(handoff, { ...atCse, driving: null })).toBe(false);
    expect(missionActionAvailable(handoff, { ...atCse, player: locations.cseHandoff.point, driving: null })).toBe(true);
    expect(updateCampusMission(handoff, { ...atTnp, driving: null }).step).toBe("parkCar");
  });

  it("requires meeting on foot, mounting the Bullet and dismounting at the cafeteria bay", () => {
    const meeting: CampusMissionProgress = { id: "chai", step: "meetFriend" };
    const atFriend = { player: locations.gardenFriend.point, vehicle: undefined };
    expect(missionActionAvailable(meeting, { ...atFriend, driving: null })).toBe(true);
    expect(missionActionAvailable(meeting, { ...atFriend, driving: "bullet" })).toBe(false);
    const mount: CampusMissionProgress = { ...meeting, step: "mountBike" };
    const atBike = { player: locations.gardenBike.point, vehicle: { position: locations.gardenBike.point, speed: 0 } };
    expect(updateCampusMission(mount, { ...atBike, driving: "bicycle" })).toBe(mount);
    expect(updateCampusMission(mount, { ...atBike, driving: "moped" })).toBe(mount);
    const ride = updateCampusMission(mount, { ...atBike, driving: "bullet" });
    expect(ride.step).toBe("parkBike");
    expect(updateCampusMission(ride, { ...atBike, driving: null })).toBe(ride);
    const atCafe = { player: locations.cafeteriaParking.point, vehicle: { position: locations.cafeteriaParking.point, speed: 0 } };
    expect(updateCampusMission(ride, { ...atCafe, driving: "bullet" })).toBe(ride);
    expect(updateCampusMission(ride, { ...atCafe, driving: null }).step).toBe("enterCafe");
  });
});
