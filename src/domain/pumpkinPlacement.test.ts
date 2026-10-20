import { describe, expect, it } from "vitest";
import {
  BuildingRing,
  CHASE_CLEARANCE_M,
  CLEARANCE_M,
  PUMPKIN_ASPECT,
  PUMPKIN_CAP,
  Pumpkin,
  TrafficLine,
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

  it("gives roughly one stop in three pumpkins, 1–3 each", () => {
    const stops = Array.from({ length: 3000 }, (_, i) => east(OSLO, i * 5));
    const counts = stops.map((s) => pumpkinsAtStop(s, [], []).length);
    const decorated = counts.filter((c) => c > 0).length / stops.length;
    expect(decorated).toBeGreaterThan(0.28);
    expect(decorated).toBeLessThan(0.39);
    expect(Math.max(...counts)).toBe(3);
  });

  it("keeps every pumpkin between 1.5 and 2.5 m tall and 3–15 m from the stop", () => {
    const stops = Array.from({ length: 300 }, (_, i) => east(OSLO, i * 5));
    const all = stops.flatMap((s) =>
      pumpkinsAtStop(s, [], []).map((p) => ({ stop: s, p })),
    );
    expect(all.length).toBeGreaterThan(0);
    for (const { stop, p } of all) {
      expect(p.height).toBeGreaterThanOrEqual(1.5);
      expect(p.height).toBeLessThanOrEqual(2.5);
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

  it("drops pumpkins within the avoid radius", () => {
    const pumpkins = pumpkinsInView([LUCKY], [], [], viewAround(LUCKY), {
      avoid: { position: LUCKY, radiusM: CHASE_CLEARANCE_M },
    });
    expect(pumpkins).toEqual([]);
    const far = pumpkinsInView([LUCKY], [], [], viewAround(LUCKY), {
      avoid: { position: east(LUCKY, 200), radiusM: CHASE_CLEARANCE_M },
    });
    expect(far).toHaveLength(3);
  });
});
