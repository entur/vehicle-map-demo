import { describe, expect, it } from "vitest";
import {
  ANIMATION_IDLE_MS,
  ANIMATION_SETTLE_MS,
  animationAmount,
  animationWake,
} from "./animationAmount.ts";
import { twinkleBrightness } from "./twinkle.ts";

describe("animationAmount", () => {
  it("is 1 while active", () => {
    expect(animationAmount(59_000, 0, false)).toBe(1);
  });

  it("eases between 0 and 1 while settling", () => {
    const a = animationAmount(
      ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS / 2,
      0,
      false,
    );
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(animationAmount(60_500, 0, false)).toBeCloseTo(0.5, 9);
  });

  it("is 0 once settled", () => {
    expect(animationAmount(61_000, 0, false)).toBe(0);
    expect(animationAmount(500_000, 0, false)).toBe(0);
  });

  it("is always 0 under reduced motion", () => {
    expect(animationAmount(0, 0, true)).toBe(0);
    expect(animationAmount(30_000, 0, true)).toBe(0);
  });
});

describe("animationWake", () => {
  it("eases from the amount at waking up to 1 over ANIMATION_SETTLE_MS", () => {
    expect(animationWake(10_000, 10_000, 0)).toBe(0);
    expect(animationWake(10_000, 10_000, 0.4)).toBeCloseTo(0.4, 9);
    expect(
      animationWake(10_000 + ANIMATION_SETTLE_MS / 2, 10_000, 0),
    ).toBeCloseTo(0.5, 9);
    expect(animationWake(10_000 + ANIMATION_SETTLE_MS, 10_000, 0)).toBe(1);
    expect(animationWake(500_000, 10_000, 0)).toBe(1);
  });

  it("is 1 when it woke from full", () => {
    expect(animationWake(0, 0, 1)).toBe(1);
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
        ? animationAmount(ms, 0, false)
        : Math.min(
            animationAmount(ms, wake, false),
            animationWake(ms, wake, 0),
          );
    expect(largestStep(amountAt, wake - 500)).toBeLessThanOrEqual(0.1);
  });

  it("never steps brightness by more than 0.1 a tick waking mid-settle", () => {
    const wake = ANIMATION_IDLE_MS + ANIMATION_SETTLE_MS / 2;
    const from = animationAmount(wake, 0, false);
    const amountAt = (ms: number) =>
      ms < wake
        ? animationAmount(ms, 0, false)
        : Math.min(
            animationAmount(ms, wake, false),
            animationWake(ms, wake, from),
          );
    expect(largestStep(amountAt, ANIMATION_IDLE_MS - 500)).toBeLessThanOrEqual(
      0.1,
    );
  });
});
