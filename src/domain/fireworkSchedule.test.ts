import { describe, expect, it, vi } from "vitest";
import { SPARK_LIFE_S, SPARK_SPEED, sparkOffset } from "./fireworks.ts";
import {
  BURST_HEIGHT_M,
  LAUNCH_INSET,
  LAUNCH_SCREEN_SHARE,
  groundFor,
  launchPoint,
  launchScreenPoint,
  nextSlotStartMs,
  placeLaunch,
  scatteredDelayMs,
  scatteredLaunch,
  slotAt,
  slotEndMs,
  slotLaunches,
} from "./fireworkSchedule.ts";

describe("slotAt", () => {
  it("floors to five minutes", () => {
    const s = slotAt(Date.parse("2026-12-28T14:07:30+01:00"));
    expect(s.startMs).toBe(Date.parse("2026-12-28T14:05:00+01:00"));
    expect(s.finale).toBe(false);
  });
  it("marks 00:00 on 1 January in Oslo as the finale", () => {
    expect(slotAt(Date.parse("2026-12-31T23:00:00Z")).finale).toBe(true);
    expect(slotAt(Date.parse("2027-01-01T00:00:00Z")).finale).toBe(false);
    expect(slotAt(Date.parse("2026-12-31T22:55:00Z")).finale).toBe(false);
  });
});

describe("nextSlotStartMs", () => {
  it("is strictly after", () => {
    const start = Date.parse("2026-12-28T14:05:00+01:00");
    expect(nextSlotStartMs(start)).toBe(start + 300_000);
    expect(nextSlotStartMs(start + 1234)).toBe(start + 300_000);
  });
});

describe("slotEndMs", () => {
  it("lasts 10 s, or 60 s for the finale", () => {
    expect(slotEndMs({ startMs: 1000, finale: false })).toBe(11_000);
    expect(slotEndMs({ startMs: 1000, finale: true })).toBe(61_000);
  });
});

describe("slotLaunches", () => {
  const slot = {
    startMs: Date.parse("2026-12-28T14:05:00+01:00"),
    finale: false,
  };
  it("has 24 rockets, or 72 for the finale", () => {
    expect(slotLaunches(slot)).toHaveLength(24);
    expect(slotLaunches({ ...slot, finale: true })).toHaveLength(72);
  });
  it("is sorted and within the slot, inset and height range", () => {
    for (const s of [slot, { ...slot, finale: true }]) {
      const launches = slotLaunches(s);
      for (let i = 0; i < launches.length; i++) {
        const l = launches[i];
        if (i > 0) expect(l.atMs).toBeGreaterThanOrEqual(launches[i - 1].atMs);
        expect(l.atMs).toBeGreaterThanOrEqual(s.startMs);
        expect(l.atMs).toBeLessThan(slotEndMs(s));
        for (const f of [l.fx, l.fy]) {
          expect(f).toBeGreaterThanOrEqual(LAUNCH_INSET);
          expect(f).toBeLessThanOrEqual(1 - LAUNCH_INSET);
        }
        expect(l.heightM).toBeGreaterThanOrEqual(BURST_HEIGHT_M[0]);
        expect(l.heightM).toBeLessThanOrEqual(BURST_HEIGHT_M[1]);
      }
    }
  });
  it("is deterministic per slot", () => {
    expect(slotLaunches(slot)).toEqual(slotLaunches({ ...slot }));
    expect(slotLaunches(slot)).not.toEqual(
      slotLaunches({ startMs: slot.startMs + 300_000, finale: false }),
    );
  });
});

describe("scattered rockets", () => {
  it("delays 2-4 s", () => {
    expect(scatteredDelayMs(() => 0)).toBe(2000);
    const late = scatteredDelayMs(() => 0.9999999);
    expect(late).toBeLessThan(4000);
    expect(late).toBeGreaterThan(3999);
  });
  it("launches now, inside the inset", () => {
    let n = 0.1;
    const l = scatteredLaunch(5000, () => (n = (n + 0.37) % 1));
    expect(l.atMs).toBe(5000);
    expect(l.fx).toBeGreaterThanOrEqual(LAUNCH_INSET);
    expect(l.colours[0]).not.toEqual(l.colours[1]);
  });
});

describe("launchPoint", () => {
  it("is linear", () => {
    expect(
      launchPoint(
        [
          [10, 59],
          [11, 60],
        ],
        0.5,
        0.25,
      ),
    ).toEqual([10.5, 59.25]);
  });
});

describe("groundFor", () => {
  it("keeps the ground's height, the sea's 0 included", () => {
    expect(groundFor(120, 5)).toBe(120);
    expect(groundFor(0, 150)).toBe(0);
    expect(groundFor(-3, 10)).toBe(-3);
  });

  it("falls back to the centre's height where there is no data yet", () => {
    expect(groundFor(null, 80)).toBe(80);
    expect(groundFor(null, null)).toBe(0);
  });
});

describe("launchScreenPoint", () => {
  it("runs fx across the screen and fy up the lower share from its bottom edge", () => {
    const top = 800 * (1 - LAUNCH_SCREEN_SHARE);
    expect(launchScreenPoint(1280, 800, 0, 0, 0)).toEqual([0, 800]);
    expect(launchScreenPoint(1280, 800, 0, 1, 0)).toEqual([1280, 800]);
    expect(launchScreenPoint(1280, 800, 0, 0, 1)).toEqual([0, top]);
    expect(launchScreenPoint(1280, 800, 0, 0.5, 0.5)).toEqual([
      640,
      800 - (800 - top) / 2,
    ]);
  });

  it("is the lower 60% of the screen", () => {
    expect(LAUNCH_SCREEN_SHARE).toBe(0.6);
  });

  it("is even on the screen, so launches do not crowd towards the horizon", () => {
    // Equal steps in fy are equal steps in pixels, whatever the ground does.
    const ys = [0, 0.25, 0.5, 0.75, 1].map(
      (fy) => launchScreenPoint(1280, 800, 0, 0.5, fy)[1],
    );
    const steps = ys.slice(1).map((y, i) => ys[i] - y);
    for (const step of steps) expect(step).toBeCloseTo(steps[0], 9);
  });

  it("leaves out what the bottom padding covers", () => {
    // The phone's detail sheet or the kiosk's band: the map under it is hidden.
    const visible = 800 - 300;
    const top = visible * (1 - LAUNCH_SCREEN_SHARE);
    expect(launchScreenPoint(1280, 800, 300, 0, 0)).toEqual([0, visible]);
    expect(launchScreenPoint(1280, 800, 300, 1, 1)).toEqual([1280, top]);
  });

  it("keeps every slot's launches inside the strip", () => {
    const top = 800 * (1 - LAUNCH_SCREEN_SHARE);
    for (const slot of [
      slotAt(Date.parse("2026-12-28T14:05:00+01:00")),
      slotAt(Date.parse("2026-12-31T23:00:00Z")),
    ]) {
      for (const { fx, fy } of slotLaunches(slot)) {
        const [x, y] = launchScreenPoint(1280, 800, 0, fx, fy);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1280);
        expect(y).toBeGreaterThanOrEqual(top);
        expect(y).toBeLessThanOrEqual(800);
      }
    }
  });
});

describe("placeLaunch", () => {
  const view: [[number, number], [number, number]] = [
    [10.7, 59.9],
    [10.8, 59.95],
  ];
  const at = (point: [number, number]) => () => point;

  it("keeps a point inside the view as it is", () => {
    expect(placeLaunch(at([10.75, 59.92]), view, 0.3, 0.7)).toEqual([
      10.75, 59.92,
    ]);
  });

  it("tries a point outside the view lower on the screen", () => {
    // Tilted past 60°, the strip's top reaches beyond the capped view; the
    // ground under it runs north as the share rises.
    const groundAt = vi.fn((fy: number): [number, number] => [
      10.75,
      59.9 + fy * 0.1,
    ]);
    expect(placeLaunch(groundAt, view, 0.3, 0.8)).toEqual([10.75, 59.94]);
    expect(groundAt.mock.calls.map(([fy]) => fy)).toEqual([0.8, 0.4]);
  });

  it("spreads launches beyond the view rather than lining them up on its edge", () => {
    const groundAt =
      (fx: number) =>
      (fy: number): [number, number] => [10.7 + fx * 0.1, 59.9 + fy * 0.1];
    const lats = [0.6, 0.7, 0.8, 0.9].map(
      (fy) => placeLaunch(groundAt(0.5), view, 0.5, fy)[1],
    );
    expect(new Set(lats).size).toBe(lats.length);
    for (const lat of lats) expect(lat).toBeLessThan(59.95);
  });

  it("moves a point to the view's edge when nothing lower is inside", () => {
    expect(placeLaunch(at([10.9, 60.1]), view, 0.3, 0.7)).toEqual([
      10.8, 59.95,
    ]);
    expect(placeLaunch(at([10.6, 59.8]), view, 0.3, 0.7)).toEqual([10.7, 59.9]);
  });

  it("falls back to the whole view when the point could not be placed", () => {
    expect(placeLaunch(at([Number.NaN, 59.92]), view, 0.3, 0.7)).toEqual(
      launchPoint(view, 0.3, 0.7),
    );
    expect(
      placeLaunch(at([10.75, Number.POSITIVE_INFINITY]), view, 0.3, 0.7),
    ).toEqual(launchPoint(view, 0.3, 0.7));
  });
});

describe("BURST_HEIGHT_M", () => {
  it("keeps the lowest burst's sparks well above the models and stop poles", () => {
    // Straight down at the fastest speed, to the end of its life: the lowest
    // any spark goes. The stop poles stand about 9 m at their 3x scale.
    const clearanceM = 15;
    for (let t = 0; t <= SPARK_LIFE_S; t += 0.05) {
      const [, , z] = sparkOffset([0, 0, -1], 1.05 * SPARK_SPEED, t);
      expect(BURST_HEIGHT_M[0] + z).toBeGreaterThan(clearanceM);
    }
  });
});
