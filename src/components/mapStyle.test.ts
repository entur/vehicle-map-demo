import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { buildMapStyle } from "./mapStyle.ts";
import {
  BASE_MAP_GLYPHS,
  BASE_MAP_SPRITE,
  MAP_SCHEMES,
  MapScheme,
  baseMapLayerIds,
} from "./basemap/basemap.ts";
import { SCHEME_PAINT, baseLayerVisibility } from "../domain/baseMapScheme.ts";

type Loose = {
  id: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

function layer(style: StyleSpecification, id: string): Loose {
  const found = style.layers.find((l) => l.id === id);
  if (!found) throw new Error(`no layer ${id}`);
  return found as unknown as Loose;
}

/** The style with every scheme-dependent part removed. */
function schemeIndependent(scheme: MapScheme): StyleSpecification {
  const style = structuredClone(buildMapStyle(scheme));
  const base = new Set(baseMapLayerIds());
  for (const l of style.layers as unknown as Loose[]) {
    if (base.has(l.id)) delete l.layout?.visibility;
  }
  delete layer(style, "buildings-3d-layer").paint?.["fill-extrusion-color"];
  delete layer(style, "hillshade-layer").paint?.["hillshade-shadow-color"];
  delete style.sky;
  return style;
}

describe("buildMapStyle", () => {
  it("differs between schemes only in base visibility and scheme paints", () => {
    expect(schemeIndependent("dark")).toEqual(schemeIndependent("light"));
  });

  it("bakes in the scheme's visibility and paints, so the first frame is right", () => {
    for (const scheme of MAP_SCHEMES) {
      const style = buildMapStyle(scheme);
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        expect([id, layer(style, id).layout?.visibility]).toEqual([
          id,
          visibility,
        ]);
      }
      expect(
        layer(style, "buildings-3d-layer").paint?.["fill-extrusion-color"],
      ).toBe(SCHEME_PAINT[scheme].buildings);
      expect(
        layer(style, "hillshade-layer").paint?.["hillshade-shadow-color"],
      ).toBe(SCHEME_PAINT[scheme].hillshadeShadow);
      expect(style.sky).toEqual(SCHEME_PAINT[scheme].sky);
    }
  });

  it("draws both base maps beneath everything else", () => {
    const ids = buildMapStyle("light").layers.map((l) => l.id);
    const base = baseMapLayerIds();
    expect(ids.slice(0, base.length)).toEqual(base);
  });

  it("takes glyphs and sprite from OpenFreeMap and drops the OSM raster", () => {
    const style = buildMapStyle("light");
    expect(style.glyphs).toBe(BASE_MAP_GLYPHS);
    expect(style.sprite).toEqual(BASE_MAP_SPRITE);
    expect(Object.keys(style.sources)).not.toContain("osm");
    expect(Object.keys(style.sources)).not.toContain("openfreemap");
  });

  it("asks every app text layer for a font OpenFreeMap serves", () => {
    const base = new Set(baseMapLayerIds());
    for (const l of buildMapStyle("light").layers as unknown as Loose[]) {
      if (base.has(l.id) || !l.layout?.["text-field"]) continue;
      expect([l.id, l.layout["text-font"]]).toEqual([
        l.id,
        ["Noto Sans Regular"],
      ]);
    }
  });

  it("keeps app layer and source ids out of the scheme namespaces", () => {
    const style = buildMapStyle("light");
    const base = new Set(baseMapLayerIds());
    for (const l of style.layers) {
      if (base.has(l.id)) continue;
      expect(l.id).not.toMatch(/^(light|dark)\//);
    }
    for (const id of Object.keys(style.sources)) {
      expect(id).not.toMatch(/^(light|dark)\//);
    }
  });

  it("puts each two-tone edge beneath the feature it outlines", () => {
    const ids = buildMapStyle("light").layers.map((l) => l.id);
    const below = (a: string, b: string) =>
      expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
    below(
      "service-journey-route-outer-casing-layer",
      "service-journey-route-casing-layer",
    );
    below("service-journey-route-casing-layer", "service-journey-route-layer");
    below("situation-lines-outer-casing-layer", "situation-lines-casing-layer");
    below("situation-lines-casing-layer", "situation-lines-layer");
    below("situation-points-edge-layer", "situation-points-layer");
  });
});
