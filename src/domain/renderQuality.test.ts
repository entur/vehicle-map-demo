import { describe, expect, it } from "vitest";
import {
  QUALITY_SETTINGS,
  QualitySettings,
  RENDER_QUALITIES,
  parseRenderQuality,
  pixelRatioFor,
} from "./renderQuality.ts";

describe("parseRenderQuality", () => {
  it("reads each level", () => {
    for (const quality of RENDER_QUALITIES) {
      expect(parseRenderQuality(quality)).toBe(quality);
    }
  });

  it("defaults to high", () => {
    expect(parseRenderQuality(null)).toBe("high");
    expect(parseRenderQuality("ultra")).toBe("high");
  });
});

describe("QUALITY_SETTINGS", () => {
  const pixels = (settings: QualitySettings) => settings.maxPixels ?? Infinity;
  const pairs = RENDER_QUALITIES.slice(1).map((quality, i) => [
    QUALITY_SETTINGS[RENDER_QUALITIES[i]],
    QUALITY_SETTINGS[quality],
  ]);

  it("never spends more at a cheaper level", () => {
    for (const [cheaper, dearer] of pairs) {
      expect(pixels(cheaper)).toBeLessThanOrEqual(pixels(dearer));
      expect(cheaper.chaseFps).toBeLessThanOrEqual(dearer.chaseFps);
      // Every on/off setting is an effect that costs when on, so a new one
      // is checked here without being listed.
      for (const [key, on] of Object.entries(cheaper)) {
        if (typeof on !== "boolean" || !on) continue;
        expect(dearer[key as keyof QualitySettings], key).toBe(true);
      }
    }
  });
});

describe("pixelRatioFor", () => {
  it("leaves the device's ratio alone without a limit", () => {
    expect(pixelRatioFor(null, 2, 3840, 2160)).toBeNull();
  });

  it("leaves the device's ratio alone when it fits", () => {
    expect(pixelRatioFor(1920 * 1080, 1, 1920, 1080)).toBeNull();
    expect(pixelRatioFor(1920 * 1080, 2, 960, 540)).toBeNull();
  });

  it("draws a 4K screen at 1080p's pixel count", () => {
    expect(pixelRatioFor(1920 * 1080, 1, 3840, 2160)).toBeCloseTo(0.5);
  });

  it("lowers a high-density screen's ratio to fit", () => {
    const ratio = pixelRatioFor(1920 * 1080, 2, 1440, 900)!;
    expect(1440 * ratio * 900 * ratio).toBeCloseTo(1920 * 1080);
    expect(ratio).toBeLessThan(2);
  });

  it("leaves a map with no size alone", () => {
    expect(pixelRatioFor(1920 * 1080, 1, 0, 0)).toBeNull();
  });
});
