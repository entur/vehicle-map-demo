import { describe, expect, it } from "vitest";
import { mapStyle } from "../components/mapStyle.ts";
import { MODE_LAYERS, MODE_SOURCES, APP_MODES } from "./appMode.ts";
import {
  BASE_LAYERS,
  BASE_SOURCES,
  VIEW_3D_LAYERS,
  ROTATION_STEP,
  cameraFor,
  parseViewDimension,
  rotatedBearing,
  terrainFor,
} from "./viewDimension.ts";

describe("parseViewDimension", () => {
  it("accepts a known dimension", () => {
    expect(parseViewDimension("3d")).toBe("3d");
    expect(parseViewDimension("2d")).toBe("2d");
  });

  it("falls back to 2d for anything else", () => {
    expect(parseViewDimension("3D")).toBe("2d");
    expect(parseViewDimension("")).toBe("2d");
    expect(parseViewDimension(null)).toBe("2d");
    expect(parseViewDimension(undefined)).toBe("2d");
  });
});

describe("base map classification", () => {
  it("names only layers and sources that exist in the style", () => {
    const layers = new Set(mapStyle.layers.map((layer) => layer.id));
    for (const id of BASE_LAYERS) expect(layers.has(id)).toBe(true);
    for (const id of BASE_SOURCES) expect(id in mapStyle.sources).toBe(true);
  });

  it("never overlaps a mode's layers or sources", () => {
    const modeLayers = new Set(APP_MODES.flatMap((m) => MODE_LAYERS[m]));
    const modeSources = new Set(APP_MODES.flatMap((m) => MODE_SOURCES[m]));
    for (const id of BASE_LAYERS) expect(modeLayers.has(id)).toBe(false);
    for (const id of BASE_SOURCES) expect(modeSources.has(id)).toBe(false);
  });

  // 3D-only layers start hidden so the 2D map looks exactly as it did before
  // the toggle existed; ViewDimensionLayers reveals them.
  it("declares every 3D-only layer as a hidden base layer", () => {
    for (const id of VIEW_3D_LAYERS) {
      expect(BASE_LAYERS).toContain(id);
      const layer = mapStyle.layers.find((l) => l.id === id);
      expect(layer?.layout?.visibility).toBe("none");
    }
  });
});

describe("terrainFor", () => {
  it("points 3d at a raster-dem source and removes terrain in 2d", () => {
    const terrain = terrainFor("3d");
    expect(terrain).not.toBeNull();
    expect(mapStyle.sources[terrain!.source].type).toBe("raster-dem");
    expect(terrainFor("2d")).toBeNull();
  });
});

describe("cameraFor", () => {
  it("lays 2d flat and tilts 3d within MapLibre's default pitch limit", () => {
    expect(cameraFor("2d").pitch).toBe(0);
    expect(cameraFor("3d").pitch).toBeGreaterThan(0);
    expect(cameraFor("3d").pitch).toBeLessThanOrEqual(60);
  });
});

describe("rotatedBearing", () => {
  it("turns a north-up map by one step either way", () => {
    expect(rotatedBearing(0, "clockwise")).toBe(ROTATION_STEP);
    expect(rotatedBearing(0, "counterclockwise")).toBe(-ROTATION_STEP);
  });

  // Snapping means repeated clicks settle on round headings even after the
  // map has been rotated freely by dragging.
  it("snaps to the next step in the direction of turn", () => {
    expect(rotatedBearing(30, "clockwise")).toBe(45);
    expect(rotatedBearing(30, "counterclockwise")).toBe(0);
    expect(rotatedBearing(-30, "clockwise")).toBe(0);
    expect(rotatedBearing(-30, "counterclockwise")).toBe(-45);
  });

  // A bearing a hair off a step, as easing leaves it, must not count as short
  // of that step — or a click would appear to do nothing.
  it("treats a bearing within half a degree of a step as on it", () => {
    expect(rotatedBearing(44.9999, "clockwise")).toBe(90);
    expect(rotatedBearing(45.2, "counterclockwise")).toBe(0);
  });

  it("stays within MapLibre's (-180, 180] range", () => {
    expect(rotatedBearing(180, "clockwise")).toBe(-135);
    expect(rotatedBearing(-135, "counterclockwise")).toBe(180);
    expect(rotatedBearing(170, "clockwise")).toBe(180);
  });
});
