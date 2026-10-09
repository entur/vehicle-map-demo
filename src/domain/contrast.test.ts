import { describe, expect, it } from "vitest";
import { EDGE_INK, EDGE_WHITE, ROUTE, SEVERITY_SEVERE } from "./dataColours.ts";
import { contrastRatio, mostLegibleOn, relativeLuminance } from "./contrast.ts";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("accepts upper-case hex", () => {
    expect(relativeLuminance("#FFFFFF")).toBe(1);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white, either way round", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("is 1 for a colour against itself", () => {
    expect(contrastRatio("#e5483a", "#e5483a")).toBe(1);
  });

  // WCAG's published example pair.
  it("matches a known mid-grey value", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("mostLegibleOn", () => {
  it("picks the candidate that contrasts most with the background", () => {
    expect(mostLegibleOn("#ffffff", ["#000000", "#eeeeee"])).toBe("#000000");
    expect(mostLegibleOn("#000000", ["#000000", "#eeeeee"])).toBe("#eeeeee");
  });

  // The stop pole's name board: white on the route colour was about 2.6:1.
  it("writes on the route colour in ink, legibly", () => {
    const text = mostLegibleOn(ROUTE, [EDGE_INK, EDGE_WHITE]);
    expect(text).toBe(EDGE_INK);
    expect(contrastRatio(text, ROUTE)).toBeGreaterThanOrEqual(4.5);
  });

  it("writes on the cancellation colour in whichever reads better", () => {
    const text = mostLegibleOn(SEVERITY_SEVERE, [EDGE_INK, EDGE_WHITE]);
    expect(contrastRatio(text, SEVERITY_SEVERE)).toBeGreaterThanOrEqual(
      contrastRatio(EDGE_INK, SEVERITY_SEVERE),
    );
  });
});
