import { describe, expect, it } from "vitest";
import {
  FLUTTER_AMPLITUDE,
  FLUTTER_PERIOD_S,
  FLUTTER_STILL,
  flutterOffset,
} from "./flutter.ts";

const times = Array.from({ length: 320 }, (_, i) => i / 200);
const us = Array.from({ length: 21 }, (_, i) => i / 20);

describe("flutterOffset", () => {
  it("is zero at the pole for any time, phase and amount", () => {
    for (const t of times) {
      expect(flutterOffset(t, 0.3, 0, 1)).toBeCloseTo(0, 12);
      expect(flutterOffset(t, 0.7, 0, 0)).toBeCloseTo(0, 12);
    }
  });

  it("stays within the still curve plus the flutter amplitude", () => {
    const bound = FLUTTER_STILL + FLUTTER_AMPLITUDE;
    for (const t of times) {
      for (const u of us) {
        expect(Math.abs(flutterOffset(t, 0.21, u, 1))).toBeLessThanOrEqual(
          bound + 1e-9,
        );
      }
    }
  });

  it("is independent of time and phase at amount 0, and not flat there", () => {
    for (const u of us) {
      const still = flutterOffset(0, 0, u, 0);
      for (const t of times) {
        expect(flutterOffset(t, 0.9, u, 0)).toBeCloseTo(still, 12);
      }
    }
    expect(flutterOffset(0, 0, 0.5, 0)).toBeGreaterThan(0.01);
  });

  it("has a period of FLUTTER_PERIOD_S", () => {
    for (const t of [0, 0.4, 0.9, 1.3]) {
      expect(flutterOffset(t + FLUTTER_PERIOD_S, 0.2, 0.6, 1)).toBeCloseTo(
        flutterOffset(t, 0.2, 0.6, 1),
        9,
      );
    }
  });

  it("differs between vehicles with different phases", () => {
    expect(flutterOffset(0.5, 0, 1, 1)).not.toBeCloseTo(
      flutterOffset(0.5, 0.37, 1, 1),
      3,
    );
  });

  it("never changes by more than 0.04 at the free edge between ticks 0.08 s apart", () => {
    for (const t of times) {
      const step = Math.abs(
        flutterOffset(t + 0.08, 0.3, 1, 1) - flutterOffset(t, 0.3, 1, 1),
      );
      expect(step).toBeLessThanOrEqual(0.04);
    }
  });

  it("anchors the free edge at a known point", () => {
    expect(flutterOffset(0, 0, 1, 0)).toBeCloseTo(0, 9);
    expect(flutterOffset(FLUTTER_PERIOD_S / 4, 0, 1, 1)).toBeCloseTo(
      FLUTTER_AMPLITUDE * Math.sin(Math.PI / 2 - 2 * Math.PI),
      9,
    );
  });
});
