import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast.ts";

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
