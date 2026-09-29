import { describe, expect, it } from "vitest";
import {
  PEEK_HEIGHT,
  clampSnap,
  maxSnapFor,
  SHEET_SNAPS,
  nearestSnap,
  nextSnap,
  sheetHeight,
  sheetMapInset,
} from "./bottomSheet.ts";

describe("sheetHeight", () => {
  it("grows from peek through half to full on a phone", () => {
    const vh = 844;
    expect(sheetHeight("peek", vh)).toBe(PEEK_HEIGHT);
    expect(sheetHeight("half", vh)).toBe(422);
    expect(sheetHeight("full", vh)).toBe(772);
  });

  it("never lets half fall below peek or rise above full", () => {
    for (const vh of [200, 300, 400, 2000]) {
      const [peek, half, full] = SHEET_SNAPS.map((s) => sheetHeight(s, vh));
      expect(peek).toBeLessThanOrEqual(half);
      expect(half).toBeLessThanOrEqual(full);
    }
  });
});

describe("nearestSnap", () => {
  it("lands a released drag on the closest height", () => {
    const vh = 844;
    expect(nearestSnap(100, vh)).toBe("peek");
    expect(nearestSnap(400, vh)).toBe("half");
    expect(nearestSnap(700, vh)).toBe("full");
    expect(nearestSnap(5000, vh)).toBe("full");
  });
});

describe("nextSnap", () => {
  it("opens a step further and wraps back to peek", () => {
    expect(nextSnap("peek")).toBe("half");
    expect(nextSnap("half")).toBe("full");
    expect(nextSnap("full")).toBe("peek");
  });
});

describe("sheetMapInset", () => {
  it("counts the gap under the floating sheet as hidden", () => {
    expect(sheetMapInset("peek", 844, 12)).toBe(PEEK_HEIGHT + 12);
  });
});

describe("capping the sheet", () => {
  it("clamps a snap to the cap", () => {
    expect(clampSnap("full", "half")).toBe("half");
    expect(clampSnap("peek", "half")).toBe("peek");
  });

  it("wraps the handle's taps at the cap", () => {
    expect(nextSnap("peek", "half")).toBe("half");
    expect(nextSnap("half", "half")).toBe("peek");
    expect(nextSnap("full", "half")).toBe("peek");
  });

  it("never lands a drag above the cap", () => {
    expect(nearestSnap(5000, 844, "half")).toBe("half");
  });

  it("caps at half only during a chase", () => {
    expect(maxSnapFor(true)).toBe("half");
    expect(maxSnapFor(false)).toBe("full");
  });
});
