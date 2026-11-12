import { expect, it } from "vitest";
import { campusAreaAt } from "../apps/web/src/campus-analytics-areas";
import { campusBoundary } from "../packages/world-data/src/campus-boundary";
import { campusGardens } from "../packages/world-data/src/campus-gardens";
import { southernEntrance, splitterFountainCenter } from "../packages/world-data/src/southern-entrance";

it("uses named public spaces ahead of nearby building footprints", () => {
  expect(campusAreaAt(southernEntrance.gate.position)).toBe("Main gate");
  expect(campusAreaAt(campusBoundary.oldGate.position)).toBe("Old gate");
  expect(campusAreaAt(splitterFountainCenter)).toBe("Entrance fountain");
  expect(campusAreaAt(campusGardens.atal.center)).toBe("Atal Bhawan garden");
  expect(campusAreaAt(campusGardens.placementParking.center)).toBe("TNP parking");
  expect(campusAreaAt([1046, 397])).toBe("Nalanda courtyard");
});

it("recognizes mapped roads and limits building labels to nearby points", () => {
  expect(campusAreaAt([900, 920])).toBe("Deoria Road");
  expect(campusAreaAt([1100, 61])).toBe("North campus road");
  expect(campusAreaAt([1035, 549])).toBe("Central Library");
  expect(campusAreaAt([85, 200])).toBe("Other campus areas");
});
