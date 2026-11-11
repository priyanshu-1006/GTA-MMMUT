import { describe, expect, it } from "vitest";
import {
  annotationToWorld,
  southernEntrance,
  southernEntranceTransform,
  worldToAnnotation,
  type AnnotationPoint,
} from "../packages/world-data/src/southern-entrance";

describe("southern entrance data", () => {
  it("converts map-right and map-down to positive world X and Z", () => {
    const [x, y] = southernEntranceTransform.origin;
    const scale = southernEntranceTransform.metersPerPixel;

    expect(annotationToWorld([x, y])).toEqual([0, 0]);
    expect(annotationToWorld([x + 1, y])).toEqual([scale, 0]);
    expect(annotationToWorld([x, y + 1])).toEqual([0, scale]);
  });

  it("preserves gate and island points through the coordinate round trip", () => {
    for (const point of [...southernEntrance.gate.span, ...southernEntrance.splitterIsland.outline]) {
      expect(worldToAnnotation(annotationToWorld(point))).toEqual(point);
    }
  });

  it("joins the asphalt and east paving along a shared edge", () => {
    const surfaces = southernEntrance.pavedSurfaces;
    const road = surfaces.find(({ kind }) => kind === "road");
    const paving = surfaces.find(({ kind }) => kind === "paved-connection");
    if (!road || !paving) throw new Error("Expected both road surfaces");

    const roadEdges = new Set(road.outline.map((start, index) => {
      const end = road.outline[(index + 1) % road.outline.length];
      return `${start}:${end}`;
    }));
    expect(paving.outline.some((start, index) => {
      const end = paving.outline[(index + 1) % paving.outline.length];
      return roadEdges.has(`${end}:${start}`);
    })).toBe(true);
  });

  it("keeps shared junction coordinates equal and connects the gate to both mapped junctions", () => {
    const positions = new Map<string, AnnotationPoint>();
    const neighbors = new Map<string, Set<string>>();
    for (const { from, to, points } of southernEntrance.centerlines) {
      const endpoints = [
        [from, points[0]],
        [to, points[points.length - 1]],
      ] as const;
      for (const [node, point] of endpoints) {
        if (positions.has(node)) expect(positions.get(node)).toEqual(point);
        positions.set(node, point);
      }
      if (!neighbors.has(from)) neighbors.set(from, new Set());
      if (!neighbors.has(to)) neighbors.set(to, new Set());
      neighbors.get(from)!.add(to);
      neighbors.get(to)!.add(from);
    }

    const connected = new Set(["gate"]);
    for (const node of connected) {
      for (const neighbor of neighbors.get(node) ?? []) connected.add(neighbor);
    }

    expect(positions.get("gate")).toEqual(southernEntrance.gate.position);
    expect(connected).toEqual(new Set(neighbors.keys()));
    expect(southernEntrance.connections.map(({ node }) => node)).toEqual(["west", "east"]);
    for (const { node, point } of southernEntrance.connections) {
      expect(connected).toContain(node);
      expect(positions.get(node)).toEqual(point);
    }
    expect(neighbors.get("west")).toEqual(new Set(["westNorth", "westSouth", "westFork"]));
    expect(neighbors.get("east")).toEqual(new Set(["eastCourtyard", "eastNorth", "eastSouth", "eastEnd"]));
    expect(neighbors.get("westFork")).toContain("eastFork");
    expect(neighbors.get("westFork")).toContain("southFork");
    expect(neighbors.get("eastFork")).toContain("southFork");
  });
});
