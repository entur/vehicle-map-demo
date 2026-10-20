import { describe, expect, it } from "vitest";
import {
  TWINKLE_IDLE_MS,
  TWINKLE_MIN,
  TWINKLE_PERIOD_S,
  TWINKLE_SETTLE_MS,
  twinkleAmount,
  twinkleBrightness,
  twinkleWake,
} from "./twinkle.ts";

const times = Array.from({ length: 300 }, (_, i) => i / 12);

describe("twinkleBrightness", () => {
  // Literal anchors, so the curve the shader copies cannot drift unnoticed.
  it("is fully lit at the start of a cycle and dimmest half way through", () => {
    expect(twinkleBrightness(0, 0, 0, 3, 1)).toBe(1);
    expect(twinkleBrightness(TWINKLE_PERIOD_S / 2, 0, 0, 3, 1)).toBeCloseTo(
      TWINKLE_MIN,
      9,
    );
    expect(TWINKLE_PERIOD_S).toBe(3);
    expect(TWINKLE_MIN).toBe(0.35);
    // A quarter of the way, half way down: 1 - 0.65 / 2.
    expect(twinkleBrightness(0.75, 0, 0, 3, 1)).toBeCloseTo(0.675, 9);
    // Group 1 of 3 is a third of a cycle ahead; half the amount, half the dip.
    expect(twinkleBrightness(0, 0, 1, 3, 1)).toBeCloseTo(0.5125, 9);
    expect(twinkleBrightness(1.5, 0, 0, 3, 0.5)).toBeCloseTo(0.675, 9);
  });

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

describe("twinkleWake", () => {
  it("eases from the amount at waking up to 1 over TWINKLE_SETTLE_MS", () => {
    expect(twinkleWake(10_000, 10_000, 0)).toBe(0);
    expect(twinkleWake(10_000, 10_000, 0.4)).toBeCloseTo(0.4, 9);
    expect(twinkleWake(10_000 + TWINKLE_SETTLE_MS / 2, 10_000, 0)).toBeCloseTo(
      0.5,
      9,
    );
    expect(twinkleWake(10_000 + TWINKLE_SETTLE_MS, 10_000, 0)).toBe(1);
    expect(twinkleWake(500_000, 10_000, 0)).toBe(1);
  });

  it("is 1 when it woke from full", () => {
    expect(twinkleWake(0, 0, 1)).toBe(1);
  });

  // Brightness over a tick, with the amount from `amountAt`, on every phase.
  function largestStep(amountAt: (ms: number) => number, fromMs: number) {
    let largest = 0;
    for (let phase = 0; phase < 1; phase += 0.01)
      for (let ms = fromMs; ms < fromMs + 3_000; ms += 1000 / 12) {
        const b = (t: number) =>
          twinkleBrightness(t / 1000, phase, 1, 3, amountAt(t));
        largest = Math.max(largest, Math.abs(b(ms + 1000 / 12) - b(ms)));
      }
    return largest;
  }

  it("never steps brightness by more than 0.1 a tick waking from idle", () => {
    const wake = 100_000;
    // Settled before `wake`, then activity: the clock's composition.
    const amountAt = (ms: number) =>
      ms < wake
        ? twinkleAmount(ms, 0, false)
        : Math.min(twinkleAmount(ms, wake, false), twinkleWake(ms, wake, 0));
    expect(largestStep(amountAt, wake - 500)).toBeLessThanOrEqual(0.1);
  });

  it("never steps brightness by more than 0.1 a tick waking mid-settle", () => {
    const wake = TWINKLE_IDLE_MS + TWINKLE_SETTLE_MS / 2;
    const from = twinkleAmount(wake, 0, false);
    const amountAt = (ms: number) =>
      ms < wake
        ? twinkleAmount(ms, 0, false)
        : Math.min(twinkleAmount(ms, wake, false), twinkleWake(ms, wake, from));
    expect(largestStep(amountAt, TWINKLE_IDLE_MS - 500)).toBeLessThanOrEqual(
      0.1,
    );
  });
});
