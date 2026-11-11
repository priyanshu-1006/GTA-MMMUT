import { describe, expect, it } from "vitest";
import { adminCoreBuildings } from "../packages/world-data/src/admin-core";
import { campusRegistry } from "../packages/world-data/src/registry";

describe("campus registry and administrative core", () => {
  it("keeps 77 unique source identities and preserves exclusions", () => {
    expect(campusRegistry).toHaveLength(77);
    expect(new Set(campusRegistry.map(({ id }) => id)).size).toBe(77);
    const excluded = campusRegistry.filter(({ status }) => status === "OUTSIDE_CAMPUS");
    expect(excluded).toHaveLength(16);
    expect(excluded.every(({ sourceStatus }) => sourceStatus === "OUTSIDE")).toBe(true);
  });

  it("uses the four confirmed identities and only their known floor counts", () => {
    expect(adminCoreBuildings.map(({ id, name, floorCount }) => [id, name, floorCount])).toEqual([
      ["B70", "Atal Bhawan", null],
      ["B71", "Administration Building", 2],
      ["B72", "Training and Placement Cell", 2],
      ["B75", "Library", null],
    ]);
    expect(adminCoreBuildings.every(({ footprintStatus }) => footprintStatus === "PROVISIONAL")).toBe(true);
  });
});
