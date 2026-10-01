import { describe, expect, it } from "vitest";
import {
  BASE_MAP_SNAPSHOTS,
  MAP_SCHEMES,
  baseMapLayerIds,
} from "../components/basemap/basemap.ts";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  mapSchemeFor,
} from "./baseMapScheme.ts";

const hiddenUpstream = new Set(
  MAP_SCHEMES.flatMap((scheme) =>
    BASE_MAP_SNAPSHOTS[scheme].layers
      .filter(
        (layer) =>
          (layer as { layout?: { visibility?: string } }).layout?.visibility ===
          "none",
      )
      .map((layer) => `${scheme}/${layer.id}`),
  ),
);

describe("baseLayerVisibility", () => {
  it("covers every base layer exactly once", () => {
    for (const scheme of MAP_SCHEMES) {
      const ids = baseLayerVisibility(scheme).map(([id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([...baseMapLayerIds()].sort());
    }
  });

  it("shows the chosen scheme's layers and hides the other's", () => {
    for (const scheme of MAP_SCHEMES) {
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        const own = id.startsWith(`${scheme}/`);
        const expected = own && !hiddenUpstream.has(id) ? "visible" : "none";
        expect([id, visibility]).toEqual([id, expected]);
      }
    }
  });

  // A layer the snapshot itself ships hidden (Fiord's `highway_ref` at the
  // time of writing) must not be switched on by a scheme change.
  it("never reveals a layer the snapshot ships hidden", () => {
    for (const scheme of MAP_SCHEMES) {
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        if (hiddenUpstream.has(id)) expect(visibility).toBe("none");
      }
    }
  });
});

describe("SCHEME_PAINT", () => {
  it("keeps today's light values", () => {
    expect(SCHEME_PAINT.light).toEqual({
      buildings: "#d6d0c8",
      hillshadeShadow: "#473b24",
      sky: {
        "sky-color": "#b9d7ee",
        "horizon-color": "#eef3f6",
        "sky-horizon-blend": 0.6,
      },
      transit: {
        rail: "#8f96a3",
        ferry: "#6f86a6",
        stopFill: "#ffffff",
        stopStroke: "#5b6475",
        stationFill: "#4a5263",
        stationStroke: "#ffffff",
        text: "#3d4452",
        textHalo: "#ffffff",
      },
    });
  });

  it("defines every paint for both schemes", () => {
    for (const scheme of MAP_SCHEMES) {
      expect(SCHEME_PAINT[scheme].buildings).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].hillshadeShadow).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].sky["sky-color"]).toBeTruthy();
      for (const colour of Object.values(SCHEME_PAINT[scheme].transit)) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("mapSchemeFor", () => {
  it("maps MUI's resolved colour scheme onto a base map", () => {
    expect(mapSchemeFor("dark")).toBe("dark");
    expect(mapSchemeFor("light")).toBe("light");
    // MUI reports undefined before it has resolved the scheme.
    expect(mapSchemeFor(undefined)).toBe("light");
  });
});
