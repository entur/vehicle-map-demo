import { describe, expect, it } from "vitest";
import {
  PEEK_HEIGHT,
  clampSnap,
  maxSnapFor,
  SHEET_SNAPS,
  nearestSnap,
  nextSnap,
  sheetBottom,
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

describe("sheetBottom", () => {
  it("floats the sheet at the inset when the attribution is short", () => {
    expect(sheetBottom(12, 0)).toBe(12);
    expect(sheetBottom(12, 6)).toBe(12);
  });

  it("stands the sheet clear above the attribution strip", () => {
    expect(sheetBottom(12, 16)).toBe(20);
    expect(sheetBottom(12, 32)).toBe(36);
  });
});

describe("a sheet raised off the bottom", () => {
  it("keeps the same clearance above the fully open sheet", () => {
    const vh = 844;
    const top = (bottom: number) =>
      vh - bottom - sheetHeight("full", vh, bottom);
    expect(top(36)).toBe(top(12));
  });

  it("leaves peek and half their heights", () => {
    expect(sheetHeight("peek", 844, 36)).toBe(PEEK_HEIGHT);
    expect(sheetHeight("half", 844, 36)).toBe(422);
  });

  it("pads the map by the sheet and everything under it", () => {
    expect(sheetMapInset("peek", 844, 36)).toBe(PEEK_HEIGHT + 36);
    expect(sheetMapInset("full", 844, 36)).toBe(sheetMapInset("full", 844, 12));
  });

  it("lands a drag on the raised sheet's own heights", () => {
    const full = sheetHeight("full", 844, 36);
    expect(nearestSnap(full, 844, "full", 36)).toBe("full");
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
