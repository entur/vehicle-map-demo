import { describe, expect, it } from "vitest";
import {
  BuildingRing,
  CLEARANCE_M,
  PUMPKIN_ASPECT,
  PUMPKIN_CAP,
  Pumpkin,
  TrafficLine,
  PumpkinCache,
  pumpkinsAtStop,
  pumpkinsInView,
} from "./pumpkinPlacement.ts";
import type { ViewBounds } from "./vehiclesInView.ts";

type LngLat = [number, number];

const OSLO: LngLat = [10.7509, 59.9114];
const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

const east = ([lng, lat]: LngLat, m: number): LngLat => [
  lng + m / mPerDegLng(lat),
  lat,
];
const north = ([lng, lat]: LngLat, m: number): LngLat => [
  lng,
  lat + m / M_PER_DEG_LAT,
];

/** Metres east and north of `origin`. */
const local = (origin: LngLat, [lng, lat]: LngLat) => [
  (lng - origin[0]) * mPerDegLng(origin[1]),
  (lat - origin[1]) * M_PER_DEG_LAT,
];
const metres = (a: LngLat, b: LngLat) => Math.hypot(...local(a, b));

const road = (cls: string, from: LngLat, to: LngLat): TrafficLine => ({
  class: cls,
  coordinates: [from, to],
});

function metresToSegment(p: LngLat, line: TrafficLine) {
  const [a, b] = line.coordinates;
  const [px, py] = local(a, p);
  const [bx, by] = local(a, b);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
  return Math.hypot(px - t * bx, py - t * by);
}

const square = (centre: LngLat, side: number): BuildingRing => {
  const h = side / 2;
  const sw = north(east(centre, -h), -h);
  const ne = north(east(centre, h), h);
  return [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]], sw];
};

/** True when a pumpkin's footprint lies wholly outside an axis-aligned square. */
function clearOf(p: Pumpkin, ring: BuildingRing) {
  const [x0, y0] = ring[0];
  const [x1, y1] = ring[2];
  const r = (PUMPKIN_ASPECT * p.height) / 2;
  const [px, py] = p.position;
  const dx = Math.max(x0 - px, 0, px - x1) * mPerDegLng(py);
  const dy = Math.max(y0 - py, 0, py - y1) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy) >= r - 1e-6;
}

const viewAround = (centre: LngLat, m = 300): ViewBounds => [
  north(east(centre, -m), -m),
  north(east(centre, m), m),
];

/** A stop that gets three pumpkins when nothing is in the way. */
const LUCKY: LngLat = (() => {
  for (let i = 0; i < 1000; i++) {
    const stop = east(OSLO, i);
    if (pumpkinsAtStop(stop, [], []).length === 3) return stop;
  }
  throw new Error("no stop with three pumpkins");
})();

describe("pumpkinsAtStop", () => {
  it("is deterministic per stop", () => {
    expect(pumpkinsAtStop(LUCKY, [], [])).toEqual(
      pumpkinsAtStop(LUCKY, [], []),
    );
  });

  it("gives every stop 1–3 pumpkins when nothing is in the way", () => {
    const stops = Array.from({ length: 3000 }, (_, i) => east(OSLO, i * 5));
    const counts = stops.map((s) => pumpkinsAtStop(s, [], []).length);
    expect(Math.min(...counts)).toBe(1);
    expect(Math.max(...counts)).toBe(3);
  });

  it("keeps every pumpkin between 2 and 3 m tall, under a bus, and 3–15 m from the stop", () => {
    const stops = Array.from({ length: 300 }, (_, i) => east(OSLO, i * 5));
    const all = stops.flatMap((s) =>
      pumpkinsAtStop(s, [], []).map((p) => ({ stop: s, p })),
    );
    expect(all.length).toBeGreaterThan(0);
    for (const { stop, p } of all) {
      expect(p.height).toBeGreaterThanOrEqual(2);
      expect(p.height).toBeLessThanOrEqual(3);
      expect(metres(stop, p.position)).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(metres(stop, p.position)).toBeLessThanOrEqual(15 + 1e-6);
    }
  });

  it("keeps clear of a primary road's estimated edge", () => {
    const traffic = [road("primary", north(LUCKY, -50), north(LUCKY, 50))];
    const pumpkins = pumpkinsAtStop(LUCKY, traffic, []);
    expect(pumpkins.length).toBeGreaterThan(0);
    for (const p of pumpkins)
      expect(metresToSegment(p.position, traffic[0])).toBeGreaterThanOrEqual(
        7 + CLEARANCE_M + (PUMPKIN_ASPECT * p.height) / 2 - 1e-6,
      );
  });

  it("does not count a footway or cycleway as traffic", () => {
    const traffic = [road("path", north(LUCKY, -50), north(LUCKY, 50))];
    expect(pumpkinsAtStop(LUCKY, traffic, [])).toEqual(
      pumpkinsAtStop(LUCKY, [], []),
    );
  });

  // Ferries are in the feed; a quay's stop must not crowd its berth.
  it("keeps clear of a ferry line", () => {
    const traffic = [road("ferry", north(LUCKY, -50), north(LUCKY, 50))];
    const pumpkins = pumpkinsAtStop(LUCKY, traffic, []);
    for (const p of pumpkins)
      expect(metresToSegment(p.position, traffic[0])).toBeGreaterThanOrEqual(
        10 + CLEARANCE_M + (PUMPKIN_ASPECT * p.height) / 2 - 1e-6,
      );
    expect(pumpkins).not.toEqual(pumpkinsAtStop(LUCKY, [], []));
  });

  it("never stands a pumpkin inside a building", () => {
    const building = square(east(LUCKY, 12), 20);
    const pumpkins = pumpkinsAtStop(LUCKY, [], [building]);
    expect(pumpkins.length).toBeGreaterThan(0);
    for (const p of pumpkins) expect(clearOf(p, building)).toBe(true);
  });

  it("keeps pumpkins from overlapping each other", () => {
    const stops = Array.from({ length: 1000 }, (_, i) => east(OSLO, i * 5));
    for (const stop of stops) {
      const pumpkins = pumpkinsAtStop(stop, [], []);
      for (const a of pumpkins)
        for (const b of pumpkins)
          if (a !== b)
            expect(metres(a.position, b.position)).toBeGreaterThanOrEqual(
              (PUMPKIN_ASPECT * (a.height + b.height)) / 2 - 1e-6,
            );
    }
  });

  it("gives a stop with no clear spot no pumpkins", () => {
    // A primary road through the stop, buildings filling both sides from
    // just beyond its edge to past the farthest a pumpkin may stand.
    const traffic = [road("primary", north(LUCKY, -50), north(LUCKY, 50))];
    const buildings = [
      square(east(LUCKY, 20), 24),
      square(east(LUCKY, -20), 24),
    ];
    expect(pumpkinsAtStop(LUCKY, traffic, buildings)).toEqual([]);
  });
});

describe("pumpkinsInView", () => {
  it("dedupes a stop returned by two tiles", () => {
    expect(
      pumpkinsInView([LUCKY, LUCKY], [], [], viewAround(LUCKY)),
    ).toHaveLength(3);
  });

  it("is stable across views", () => {
    const a = pumpkinsInView([LUCKY], [], [], viewAround(LUCKY));
    const b = pumpkinsInView([LUCKY], [], [], viewAround(east(LUCKY, 100)));
    expect(b).toEqual(a);
  });

  it("leaves out stops outside the view", () => {
    expect(
      pumpkinsInView([LUCKY], [], [], viewAround(east(LUCKY, 2000))),
    ).toEqual([]);
  });

  it("caps at PUMPKIN_CAP, keeping the stops nearest the view's centre", () => {
    const stops = Array.from({ length: 2000 }, (_, i) =>
      north(east(OSLO, (i % 45) * 40), Math.floor(i / 45) * 40),
    );
    const centre = north(east(OSLO, 900), 900);
    const view = viewAround(centre, 2000);
    const pumpkins = pumpkinsInView(stops, [], [], view);
    expect(pumpkins).toHaveLength(PUMPKIN_CAP);
    const nearest = Math.max(
      ...pumpkins.map((p) => metres(centre, p.position)),
    );
    const all = stops.flatMap((s) => pumpkinsAtStop(s, [], []));
    const farther = all.filter(
      (p) => metres(centre, p.position) > nearest + 30,
    );
    expect(farther.length).toBeGreaterThan(0);
    for (const p of farther) expect(pumpkins).not.toContainEqual(p);
  });

  // In 3D the loaded tiles reach the horizon, and a low-zoom tile there can
  // carry a ferry line or motorway several degrees long. Indexing every cell
  // it covers overflowed a Map and took the whole app down.
  it("copes with an obstacle many degrees long", () => {
    const long = road(
      "motorway",
      [OSLO[0] - 3, OSLO[1] - 3],
      [OSLO[0] + 3, OSLO[1] - 2.9],
    );
    const building = square(OSLO, 1) as BuildingRing;
    const huge: BuildingRing = [
      [OSLO[0] - 4, OSLO[1] + 1],
      [OSLO[0] + 4, OSLO[1] + 1],
      [OSLO[0] + 4, OSLO[1] + 3],
      [OSLO[0] - 4, OSLO[1] + 3],
      [OSLO[0] - 4, OSLO[1] + 1],
    ];
    expect(
      pumpkinsInView([LUCKY], [long], [building, huge], viewAround(LUCKY)),
    ).toEqual(pumpkinsInView([LUCKY], [], [building], viewAround(LUCKY)));
  });
});

describe("pumpkinsInView's cache", () => {
  const view = () => viewAround(LUCKY);
  const along = (m: number) =>
    road("primary", north(east(LUCKY, m), -50), north(east(LUCKY, m), 50));

  // Between two builds — a pan, or once a second in a chase — most stops
  // are the same, and placing them again was most of a build's cost.
  it("reuses a stop's pumpkins while the obstacles near it are unchanged", () => {
    const cache: PumpkinCache = new Map();
    const first = pumpkinsInView([LUCKY], [along(10)], [], view(), { cache });
    const moved = pumpkinsInView([LUCKY], [along(-10)], [], view());
    expect(moved).not.toEqual(first);
    // The same count of roads and points near the stop: served from cache.
    expect(
      pumpkinsInView([LUCKY], [along(-10)], [], view(), { cache }),
    ).toEqual(first);
  });

  it("places a stop again when the obstacles near it change", () => {
    const cache: PumpkinCache = new Map();
    pumpkinsInView([LUCKY], [], [], view(), { cache });
    expect(pumpkinsInView([LUCKY], [along(10)], [], view(), { cache })).toEqual(
      pumpkinsInView([LUCKY], [along(10)], [], view()),
    );
  });

  it("forgets stops that have left the view", () => {
    const cache: PumpkinCache = new Map();
    pumpkinsInView([LUCKY], [], [], view(), { cache });
    expect(cache.size).toBe(1);
    pumpkinsInView([LUCKY], [], [], viewAround(east(LUCKY, 2000)), { cache });
    expect(cache.size).toBe(0);
  });
});
