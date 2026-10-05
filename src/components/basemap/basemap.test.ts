import { describe, expect, it } from "vitest";
import {
  BASE_MAP_GLYPHS,
  BASE_MAP_SNAPSHOTS,
  BASE_MAP_SOURCES,
  BASE_MAP_SPRITE,
  MAP_SCHEMES,
  baseMapLayerIds,
  baseMapLayers,
} from "./basemap.ts";

describe("base map snapshots", () => {
  // The composed style declares sources, glyphs and sprite once for both
  // schemes. If OpenFreeMap ever diverges the two styles, fail here rather than
  // render one scheme against the other's tiles.
  it("share sources, glyphs and sprite", () => {
    const { light, dark } = BASE_MAP_SNAPSHOTS;
    expect(dark.sources).toEqual(light.sources);
    expect(dark.glyphs).toEqual(light.glyphs);
    expect(dark.sprite).toEqual(light.sprite);
  });

  it("read the OpenFreeMap vector tiles and natural-earth raster", () => {
    expect(Object.keys(BASE_MAP_SOURCES).sort()).toEqual([
      "ne2_shaded",
      "openmaptiles",
    ]);
    expect(BASE_MAP_SOURCES.openmaptiles).toMatchObject({
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    });
    expect(BASE_MAP_GLYPHS).toContain("tiles.openfreemap.org/fonts");
    expect(BASE_MAP_SPRITE).toBeTruthy();
  });

  // The Playwright scheme test reads `light/background` and `dark/background`.
  it("each have a background layer", () => {
    for (const scheme of MAP_SCHEMES) {
      expect(
        baseMapLayers(scheme).some(
          (layer) => layer.id === `${scheme}/background`,
        ),
      ).toBe(true);
    }
  });
});

describe("baseMapLayers", () => {
  it("prefixes every id with its scheme and keeps the snapshot order", () => {
    for (const scheme of MAP_SCHEMES) {
      const layers = baseMapLayers(scheme);
      expect(layers.map((layer) => layer.id)).toEqual(
        BASE_MAP_SNAPSHOTS[scheme].layers.map(
          (layer) => `${scheme}/${layer.id}`,
        ),
      );
    }
  });

  it("produces ids unique across both schemes", () => {
    const ids = baseMapLayerIds();
    expect(new Set(ids).size).toBe(ids.length);
  });
});
