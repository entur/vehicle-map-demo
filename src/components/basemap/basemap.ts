/**
 * The base map: OpenFreeMap's Positron (light) and Fiord (dark), both composed
 * into the app's one style so a colour scheme change is a visibility switch
 * rather than a `setStyle` — see BaseMapScheme.
 *
 * positron.json and fiord.json are unmodified snapshots of
 * https://tiles.openfreemap.org/styles/positron and
 * https://tiles.openfreemap.org/styles/fiord, fetched 2026-09-16 by
 * `npm run fetch-basemap`. Refresh: run it, check both schemes in the browser,
 * commit.
 */
import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import positron from "./positron.json";
import fiord from "./fiord.json";

export type MapScheme = "light" | "dark";

export const MAP_SCHEMES: MapScheme[] = ["light", "dark"];

export const BASE_MAP_SNAPSHOTS: Record<MapScheme, StyleSpecification> = {
  light: positron as unknown as StyleSpecification,
  dark: fiord as unknown as StyleSpecification,
};

/** Keeps the two schemes' layer ids apart inside one style. */
export function schemePrefix(scheme: MapScheme): string {
  return `${scheme}/`;
}

/** A snapshot's layers with scheme-prefixed ids, otherwise as published. */
export function baseMapLayers(scheme: MapScheme): LayerSpecification[] {
  return BASE_MAP_SNAPSHOTS[scheme].layers.map((layer) => ({
    ...layer,
    id: schemePrefix(scheme) + layer.id,
  }));
}

/** Every base map layer id in the composed style, both schemes. */
export function baseMapLayerIds(): string[] {
  return MAP_SCHEMES.flatMap((scheme) =>
    baseMapLayers(scheme).map((layer) => layer.id),
  );
}

// Identical in both snapshots (basemap.test.ts), so declared once.
export const BASE_MAP_SOURCES: Record<string, SourceSpecification> =
  BASE_MAP_SNAPSHOTS.light.sources;
export const BASE_MAP_GLYPHS: string = BASE_MAP_SNAPSHOTS.light.glyphs ?? "";
export const BASE_MAP_SPRITE: StyleSpecification["sprite"] =
  BASE_MAP_SNAPSHOTS.light.sprite;
