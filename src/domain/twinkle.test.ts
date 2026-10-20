import { describe, expect, it } from "vitest";
import {
  TWINKLE_IDLE_MS,
  TWINKLE_MIN,
  TWINKLE_PERIOD_S,
  TWINKLE_SETTLE_MS,
  twinkleAmount,
  twinkleBrightness,
} from "./twinkle.ts";

const times = Array.from({ length: 300 }, (_, i) => i / 12);

describe("twinkleBrightness", () => {
  it("stays within [TWINKLE_MIN, 1]", () => {
    for (const t of times) {
      const b = twinkleBrightness(t, 0.21, 1, 3, 1);
      expect(b).toBeGreaterThanOrEqual(TWINKLE_MIN - 1e-9);
      expect(b).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("has a period of TWINKLE_PERIOD_S", () => {
    for (const t of [0, 0.4, 1.7, 2.9]) {
      expect(twinkleBrightness(t + TWINKLE_PERIOD_S, 0.2, 1, 3, 1)).toBeCloseTo(
        twinkleBrightness(t, 0.2, 1, 3, 1),
        9,
      );
    }
  });

  it("differs between trees with different phases", () => {
    expect(twinkleBrightness(0.5, 0, 0, 3, 1)).not.toBeCloseTo(
      twinkleBrightness(0.5, 0.37, 0, 3, 1),
      3,
    );
  });

  it("puts the groups of one tree out of step", () => {
    expect(twinkleBrightness(0.5, 0.1, 0, 3, 1)).not.toBeCloseTo(
      twinkleBrightness(0.5, 0.1, 1, 3, 1),
      3,
    );
  });

  it("is steady and fully lit at amount 0", () => {
    for (const t of times) expect(twinkleBrightness(t, 0.3, 2, 3, 0)).toBe(1);
  });

  it("never changes by more than 0.1 between ticks 1/12 s apart", () => {
    for (const t of times) {
      const step = Math.abs(
        twinkleBrightness(t + 1 / 12, 0.3, 1, 3, 1) -
          twinkleBrightness(t, 0.3, 1, 3, 1),
      );
      expect(step).toBeLessThanOrEqual(0.1);
    }
  });
});

describe("twinkleAmount", () => {
  it("is 1 while active", () => {
    expect(twinkleAmount(59_000, 0, false)).toBe(1);
  });

  it("eases between 0 and 1 while settling", () => {
    const a = twinkleAmount(TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS / 2, 0, false);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(twinkleAmount(60_500, 0, false)).toBeCloseTo(0.5, 9);
  });

  it("is 0 once settled", () => {
    expect(twinkleAmount(61_000, 0, false)).toBe(0);
    expect(twinkleAmount(500_000, 0, false)).toBe(0);
  });

  it("is always 0 under reduced motion", () => {
    expect(twinkleAmount(0, 0, true)).toBe(0);
    expect(twinkleAmount(30_000, 0, true)).toBe(0);
  });
});
