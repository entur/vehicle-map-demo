import { describe, expect, it } from "vitest";
import { SPARK_LIFE_S, SPARK_SPEED, sparkOffset } from "./fireworks.ts";
import {
  BURST_HEIGHT_M,
  LAUNCH_INSET,
  LAUNCH_SCREEN_SHARE,
  groundFor,
  launchPointIn,
  launchStrip,
  launchPoint,
  nextSlotStartMs,
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
  it("falls back to the centre's height", () => {
    expect(groundFor(120, 5)).toBe(120);
    expect(groundFor(0, 80)).toBe(80);
    expect(groundFor(null, 80)).toBe(80);
    expect(groundFor(null, null)).toBe(0);
    expect(groundFor(0, 0)).toBe(0);
    expect(groundFor(-3, 10)).toBe(10);
  });
});

describe("launchStrip", () => {
  it("is the corners of the lower share of the screen, in screen pixels", () => {
    const top = 800 * (1 - LAUNCH_SCREEN_SHARE);
    expect(launchStrip(1280, 800)).toEqual([
      [0, top],
      [1280, top],
      [0, 800],
      [1280, 800],
    ]);
  });

  it("is the lower 60% of the screen", () => {
    expect(LAUNCH_SCREEN_SHARE).toBe(0.6);
  });

  it("leaves out what the bottom padding covers", () => {
    // The phone's detail sheet or the kiosk's band: the map under it is hidden.
    const visible = 800 - 300;
    const top = visible * (1 - LAUNCH_SCREEN_SHARE);
    expect(launchStrip(1280, 800, 300)).toEqual([
      [0, top],
      [1280, top],
      [0, visible],
      [1280, visible],
    ]);
  });
});

type Point = [number, number];

/** Whether `p` is inside the convex quadrilateral `quad`, given in order around it. */
function insideConvex(p: Point, quad: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < quad.length; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % quad.length];
    const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

describe("launchPointIn", () => {
  const wide: [Point, Point] = [
    [10, 59],
    [11, 60],
  ];

  /**
   * The ground under the strip of a map turned 45°: a trapezoid, narrow at
   * the screen's bottom edge and wide at the strip's top, its axis running
   * north-east. Its box is about twice its area.
   */
  function rotatedStrip(): [Point, Point, Point, Point] {
    const centre: Point = [10.5, 59.5];
    const turn = ([x, y]: Point): Point => {
      const c = Math.SQRT1_2;
      return [centre[0] + c * (x - y), centre[1] + c * (x + y)];
    };
    // In the strip's own frame: x across the screen, y ahead.
    return [
      turn([-0.2, 0.2]), // top left
      turn([0.2, 0.2]), // top right
      turn([-0.08, -0.1]), // bottom left
      turn([0.08, -0.1]), // bottom right
    ];
  }

  it("puts every slot's launches inside a turned strip, not just its box", () => {
    const strip = rotatedStrip();
    const [tl, tr, bl, br] = strip;
    const around = [bl, br, tr, tl];
    for (const slot of [
      slotAt(Date.parse("2026-12-28T14:05:00+01:00")),
      slotAt(Date.parse("2026-12-31T23:00:00Z")),
    ]) {
      for (const { fx, fy } of slotLaunches(slot)) {
        const p = launchPointIn({ strip, view: wide }, fx, fy);
        expect(insideConvex(p, around)).toBe(true);
      }
    }
  });

  it("runs fx across the screen and fy up from its bottom edge", () => {
    const strip = rotatedStrip();
    const [tl, tr, bl, br] = strip;
    const area = { strip, view: wide };
    expect(launchPointIn(area, 0, 0)).toEqual(bl);
    expect(launchPointIn(area, 1, 0)).toEqual(br);
    expect(launchPointIn(area, 0, 1)).toEqual(tl);
    expect(launchPointIn(area, 1, 1)).toEqual(tr);
  });

  it("keeps launches inside the view the vehicles use", () => {
    // Tilted, the strip's top can reach past the capped view.
    const strip: [Point, Point, Point, Point] = [
      [10.6, 60.1],
      [10.9, 60.1],
      [10.74, 59.91],
      [10.76, 59.91],
    ];
    const view: [Point, Point] = [
      [10.7, 59.9],
      [10.8, 59.95],
    ];
    for (const fx of [0, 0.15, 0.5, 0.85, 1]) {
      for (const fy of [0, 0.15, 0.5, 0.85, 1]) {
        const [lng, lat] = launchPointIn({ strip, view }, fx, fy);
        expect(lng).toBeGreaterThanOrEqual(10.7);
        expect(lng).toBeLessThanOrEqual(10.8);
        expect(lat).toBeGreaterThanOrEqual(59.9);
        expect(lat).toBeLessThanOrEqual(59.95);
      }
    }
  });

  it("falls back to the view when a corner could not be placed", () => {
    const strip = rotatedStrip();
    strip[0] = [Number.NaN, 59.5];
    expect(launchPointIn({ strip, view: wide }, 0.3, 0.7)).toEqual(
      launchPoint(wide, 0.3, 0.7),
    );
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
