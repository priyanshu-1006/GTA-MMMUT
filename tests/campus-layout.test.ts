import { expect, it } from "vitest";
import { campusAccess, openStage } from "../packages/world-data/src/campus-access";
import { campusBuildings } from "../packages/world-data/src/campus-buildings";
import { campusBoundary } from "../packages/world-data/src/campus-boundary";
import { campusGardens } from "../packages/world-data/src/campus-gardens";
import { campusRoads } from "../packages/world-data/src/campus-roads";
import { coveredWalkways } from "../packages/world-data/src/covered-walkways";
import { deoriaRoad } from "../packages/world-data/src/deoria-road";
import { campusRegistry } from "../packages/world-data/src/registry";
import { southernEntrance, type AnnotationPoint } from "../packages/world-data/src/southern-entrance";

it("models at least 80 percent of the confirmed structure IDs without including exclusions", () => {
  const confirmed = new Set(campusRegistry.filter(({ status }) => status === "CONFIRMED").map(({ id }) => id));
  const modeled = new Set(campusBuildings.map(({ id }) => id));
  expect(modeled.size).toBe(campusBuildings.length);
  expect(modeled.size).toBeGreaterThanOrEqual(Math.ceil(confirmed.size * 0.8));
  expect([...modeled].every((id) => confirmed.has(id))).toBe(true);
});

it("keeps the owner-confirmed destinations connected by the covered route", () => {
  const positions = new Map<string, AnnotationPoint>();
  for (const { from, to, points } of coveredWalkways.segments) {
    expect(points.length).toBeGreaterThan(1);
    for (const [node, point] of [[from, points[0]], [to, points[points.length - 1]]] as const) {
      if (positions.has(node)) expect(positions.get(node)).toEqual(point);
      positions.set(node, point);
    }
  }

  const connected = new Set(["administration"]);
  for (const node of connected) {
    for (const { from, to } of coveredWalkways.segments) {
      if (node === from) connected.add(to);
      if (node === to) connected.add(from);
    }
  }
  expect(coveredWalkways.connectivity).toBe("OWNER_CONFIRMED");
  expect(coveredWalkways.destinations.map(({ id }) => id)).toEqual([
    "administration", "pushpagiri", "civil", "cse-it", "electrical", "physics",
  ]);
  expect(coveredWalkways.widthPixels).toBeGreaterThan(4.5);
  for (const { node, point } of coveredWalkways.destinations) {
    expect(connected).toContain(node);
    expect(positions.get(node)).toEqual(point);
  }
});

it("ends the Civil covered path between Old CSE and IT", () => {
  const passage = coveredWalkways.destinations.find(({ id }) => id === "cse-it")!;
  const [x, y] = passage.point;
  const oldCse = campusBuildings.find(({ id }) => id === "B23")!;
  const itSite = campusBuildings.find(({ id }) => id === "B24")!;
  expect(x).toBeGreaterThan(Math.max(...oldCse.footprint.map(([x]) => x)));
  expect(x).toBeLessThan(Math.min(...itSite.footprint.map(([x]) => x)));
  expect(y).toBeLessThan(270);
  expect(coveredWalkways.segments.find(({ to }) => to === passage.node)?.points.at(-1)).toEqual(passage.point);
});

it("joins the internal access roads at the existing gate, parking and drive edges", () => {
  const [atal, library, civil, mechanical] = campusAccess.roads;
  expect(atal.outline.slice(0, 2)).toEqual([[887, 799], [887, 810]]);
  expect(library.outline.slice(0, 2).every(([x]) => x === campusGardens.placementParking.lot[0])).toBe(true);
  expect(civil.centerline[0]).toEqual([806, 641]);
  expect(mechanical.centerline[0]).toEqual([1150, 617]);
  expect(openStage.heightMeters).toBeCloseTo(7 * 0.3048, 8);
});

it("connects the old gate apron and leaves two distinct wall openings", () => {
  const [left, right] = campusBoundary.oldGate.approach.outline;
  expect(campusRoads.pavedSurfaces.some(({ outline }) => outline.some((point, index) => {
    const next = outline[(index + 1) % outline.length];
    return point.join(",") === right.join(",") && next.join(",") === left.join(",");
  }))).toBe(true);
  const [west, middle, east] = campusBoundary.wallRuns;
  expect(west.points.at(-1)).toEqual(campusBoundary.oldGate.span[0]);
  expect(middle.points[0]).toEqual(campusBoundary.oldGate.span[1]);
  expect(middle.points.at(-1)).toEqual(southernEntrance.gate.span[0]);
  expect(east.points[0]).toEqual(southernEntrance.gate.span[1]);
});

it("joins both gate approaches to the divided six-lane highway", () => {
  const [north, south] = deoriaRoad.carriageways;
  expect(north.laneCenters).toHaveLength(3);
  expect(south.laneCenters).toHaveLength(3);
  const median = deoriaRoad.surfaces.find(({ kind }) => kind === "median")!;
  expect(north.outline[2][1]).toBe(median.outline[0][1]);
  expect(south.outline[0][1]).toBe(median.outline[2][1]);

  const mainRoad = southernEntrance.pavedSurfaces.find(({ id }) => id === "southern-entrance-paving")!;
  for (const [id, inner] of [
    ["main-gate-exterior-apron", mainRoad.outline],
    ["old-gate-exterior-apron", campusBoundary.oldGate.approach.outline],
  ] as const) {
    const apron = deoriaRoad.surfaces.find((surface) => surface.id === id)!;
    const [left, right] = apron.outline;
    expect(inner.some((point, index) => point.join(",") === right.join(",") &&
      inner[(index + 1) % inner.length].join(",") === left.join(","))).toBe(true);
    expect(apron.outline.filter(([, y]) => y === north.outline[0][1])).toHaveLength(2);
  }
});

it("keeps four garden quarters and all TNP parking stalls within their layout", () => {
  expect(campusGardens.atal.quarters).toHaveLength(4);
  const sizes = campusGardens.atal.quarters.map(([x, y, right, bottom]) => [right - x, bottom - y].join(","));
  expect(new Set(sizes).size).toBe(1);
  const { lot: [x, y, right, bottom], stalls } = campusGardens.placementParking;
  expect(stalls.left).toBeGreaterThan(x);
  expect(stalls.left + stalls.count * stalls.width).toBeLessThan(right);
  expect(stalls.top).toBeGreaterThan(y);
  expect(stalls.top + stalls.depth).toBeLessThan(bottom);
});

it("joins the wider road network to the south entrance with matching junction coordinates", () => {
  const junctions = new Map<string, AnnotationPoint>();
  const links = [...southernEntrance.centerlines, ...campusRoads.centerlines];
  for (const { from, to, points } of links) {
    for (const [node, point] of [[from, points[0]], [to, points[points.length - 1]]] as const) {
      if (junctions.has(node)) expect(junctions.get(node)).toEqual(point);
      junctions.set(node, point);
    }
  }

  const connected = new Set(["gate"]);
  for (const junction of connected) {
    for (const { from, to } of links) {
      if (from === junction) connected.add(to);
      if (to === junction) connected.add(from);
    }
  }
  expect(connected).toEqual(new Set(junctions.keys()));
  expect(connected).toContain("northEastTip");
  expect(connected).toContain("westSouthTip");
  expect(connected).toContain("eastLinkBend");
});
