import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUMPKIN_SOURCE,
  Placed,
  PumpkinController,
  PumpkinMap,
} from "./pumpkinController.ts";
import {
  DECORATIONS,
  decorationsAtStop,
} from "../../domain/decorationPlacement.ts";
import type { ViewBounds } from "../../domain/vehiclesInView.ts";

type LngLat = [number, number];

/** A stop that gets pumpkins when nothing is in the way. */
const STOP: LngLat = (() => {
  for (let i = 0; i < 1000; i++) {
    const stop: LngLat = [10.7509 + i * 1e-5, 59.9114];
    if (decorationsAtStop(DECORATIONS.halloween, stop, [], []).length === 3)
      return stop;
  }
  throw new Error("no stop with three pumpkins");
})();
const VIEW: ViewBounds = [
  [STOP[0] - 0.01, STOP[1] - 0.005],
  [STOP[0] + 0.01, STOP[1] + 0.005],
];

type Listener = (event?: unknown) => void;

/**
 * Just enough of a MapLibre map, counting what is read. Cast where it is
 * passed: MapLibre's overloaded `on` and `off` are more than a fake needs.
 */
class FakeMap {
  moving = false;
  elevation = 0;
  water: LngLat[][] = [];
  roads: LngLat[][] = [];
  reads: string[] = [];
  heightReads = 0;
  private listeners = new Map<string, Set<Listener>>();

  querySourceFeatures(
    _source: string,
    { sourceLayer }: { sourceLayer: string },
  ) {
    this.reads.push(sourceLayer);
    if (sourceLayer === "poi")
      return [
        {
          geometry: { type: "Point", coordinates: STOP },
          properties: { class: "bus", subclass: "bus_stop" },
        },
      ] as never;
    if (sourceLayer === "transportation")
      return this.roads.map((coordinates) => ({
        geometry: { type: "LineString", coordinates },
        properties: { class: "primary" },
      })) as never;
    if (sourceLayer === "water")
      return this.water.map((ring) => ({
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: { class: "lake" },
      })) as never;
    return [] as never;
  }
  queryTerrainElevation() {
    this.heightReads++;
    return this.elevation;
  }
  isMoving() {
    return this.moving;
  }
  getTerrain() {
    return { source: "terrain" };
  }
  on(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return this;
  }
  off(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
    return this;
  }
  emit(type: string, event?: unknown) {
    for (const listener of [...(this.listeners.get(type) ?? [])])
      listener(event);
  }
  listening() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
  /** How many full placements ran: each reads the stops once. */
  placements() {
    return this.reads.filter((layer) => layer === "poi").length;
  }
}

const tile = (sourceId: string) => ({ sourceId, tile: {} });
const last = (all: Placed[]): Placed | undefined => all[all.length - 1];

describe("PumpkinController", () => {
  let map: FakeMap;
  let placed: Placed[];
  let controller: PumpkinController;

  beforeEach(() => {
    vi.useFakeTimers();
    map = new FakeMap();
    placed = [];
    controller = new PumpkinController(map as unknown as PumpkinMap, {
      viewBounds: () => VIEW,
      intervalMs: 250,
      onPlaced: (p) => placed.push(p),
    });
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  it("places the pumpkins at once", () => {
    expect(map.placements()).toBe(1);
    expect(last(placed)?.pumpkins).toHaveLength(3);
  });

  // Every tile streaming in during a pan used to run a whole placement
  // mid-gesture; the move's end places once instead.
  it("ignores base map tiles while the camera moves, and places on moveend", () => {
    map.moving = true;
    for (let i = 0; i < 10; i++) {
      map.emit("sourcedata", tile(PUMPKIN_SOURCE));
      vi.advanceTimersByTime(300);
    }
    expect(map.placements()).toBe(1);
    map.moving = false;
    map.emit("moveend");
    expect(map.placements()).toBe(2);
  });

  it("places again when a base map tile arrives at rest", () => {
    vi.advanceTimersByTime(300);
    map.emit("sourcedata", tile(PUMPKIN_SOURCE));
    expect(map.placements()).toBe(2);
  });

  // A terrain tile can change heights, never placement.
  it("only reads heights again when a terrain tile arrives", () => {
    const reads = map.reads.length;
    const heights = map.heightReads;
    map.elevation = 12;
    vi.advanceTimersByTime(300);
    map.emit("sourcedata", tile("terrain"));
    expect(map.reads.length).toBe(reads);
    expect(map.heightReads).toBe(heights + 3);
    expect(last(placed)?.elevations).toEqual([12, 12, 12]);
  });

  it("only reads heights again when terrain comes or goes", () => {
    const reads = map.reads.length;
    map.emit("terrain");
    expect(map.reads.length).toBe(reads);
  });

  it("does not report a placement that did not change", () => {
    vi.advanceTimersByTime(300);
    map.emit("moveend");
    expect(map.placements()).toBe(2);
    expect(placed).toHaveLength(1);
  });

  it("keeps pumpkins off water", () => {
    controller.dispose();
    map = new FakeMap();
    const [lng, lat] = STOP;
    map.water = [
      [
        [lng - 0.1, lat - 0.1],
        [lng + 0.1, lat - 0.1],
        [lng + 0.1, lat + 0.1],
        [lng - 0.1, lat + 0.1],
        [lng - 0.1, lat - 0.1],
      ],
    ];
    placed = [];
    controller = new PumpkinController(map as unknown as PumpkinMap, {
      viewBounds: () => VIEW,
      intervalMs: 250,
      onPlaced: (p) => placed.push(p),
    });
    expect(last(placed)?.pumpkins ?? []).toEqual([]);
  });

  // A pumpkin's key is its stop and its number there, so one that moves
  // keeps its key; only its position tells the move.
  it("reports pumpkins that moved, though their keys did not change", () => {
    const [lng, lat] = STOP;
    const road: LngLat[] = [
      [lng + 0.0001, lat - 0.001],
      [lng + 0.0001, lat + 0.001],
    ];
    expect(
      decorationsAtStop(
        DECORATIONS.halloween,
        STOP,
        [{ class: "primary", coordinates: road }],
        [],
      ),
    ).not.toEqual(decorationsAtStop(DECORATIONS.halloween, STOP, [], []));
    vi.advanceTimersByTime(300);
    map.roads = [road];
    map.emit("moveend");
    expect(placed).toHaveLength(2);
    expect(last(placed)?.pumpkins).toEqual(
      decorationsAtStop(
        DECORATIONS.halloween,
        STOP,
        [{ class: "primary", coordinates: road }],
        [],
      ),
    );
  });

  // A road the same shape somewhere else near the stop would place the
  // pumpkins elsewhere; that they stay is the cache at work.
  it("keeps a stop's pumpkins from one placement to the next", () => {
    const [lng, lat] = STOP;
    const along = (dLng: number): LngLat[] => [
      [lng + dLng, lat - 0.001],
      [lng + dLng, lat + 0.001],
    ];
    controller.dispose();
    map = new FakeMap();
    const placedBy = (road: LngLat[]) =>
      decorationsAtStop(
        DECORATIONS.halloween,
        STOP,
        [{ class: "primary", coordinates: road }],
        [],
      );
    expect(placedBy(along(0.0001))).not.toEqual(placedBy(along(-0.0001)));
    map.roads = [along(0.0001)];
    placed = [];
    controller = new PumpkinController(map as unknown as PumpkinMap, {
      viewBounds: () => VIEW,
      intervalMs: 250,
      onPlaced: (p) => placed.push(p),
    });
    map.roads = [along(-0.0001)];
    vi.advanceTimersByTime(300);
    map.emit("moveend");
    expect(map.placements()).toBe(2);
    expect(placed).toHaveLength(1);
  });

  it("stops listening when disposed", () => {
    controller.dispose();
    expect(map.listening()).toBe(0);
  });
});
