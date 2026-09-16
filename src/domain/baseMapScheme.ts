import type { SkySpecification } from "@maplibre/maplibre-gl-style-spec";
import {
  BASE_MAP_SNAPSHOTS,
  MAP_SCHEMES,
  MapScheme,
  schemePrefix,
} from "../components/basemap/basemap.ts";

/**
 * Visibility of every base map layer for `scheme`: its own layers shown, the
 * other scheme's hidden. A layer the snapshot itself ships hidden stays hidden,
 * so a scheme change can never reveal something OpenFreeMap switched off.
 */
export function baseLayerVisibility(
  scheme: MapScheme,
): [string, "visible" | "none"][] {
  return MAP_SCHEMES.flatMap((owner) =>
    BASE_MAP_SNAPSHOTS[owner].layers.map(
      (layer): [string, "visible" | "none"] => {
        const hiddenUpstream =
          (layer as { layout?: { visibility?: string } }).layout?.visibility ===
          "none";
        return [
          schemePrefix(owner) + layer.id,
          owner === scheme && !hiddenUpstream ? "visible" : "none",
        ];
      },
    ),
  );
}

/**
 * Base map colours that differ per scheme. Not data colours — those are tuned
 * once for both schemes in dataColours.ts.
 */
export type SchemePaint = {
  buildings: string;
  hillshadeShadow: string;
  sky: SkySpecification;
};

export const SCHEME_PAINT: Record<MapScheme, SchemePaint> = {
  light: {
    buildings: "#d6d0c8",
    hillshadeShadow: "#473b24",
    sky: {
      "sky-color": "#b9d7ee",
      "horizon-color": "#eef3f6",
      "sky-horizon-blend": 0.6,
    },
  },
  dark: {
    buildings: "#3a4560",
    hillshadeShadow: "#1c2233",
    sky: {
      "sky-color": "#1f2638",
      "horizon-color": "#2c3550",
      "sky-horizon-blend": 0.6,
    },
  },
};

/** MUI's resolved colour scheme (undefined before it resolves) as a base map. */
export function mapSchemeFor(colorScheme: string | undefined): MapScheme {
  return colorScheme === "dark" ? "dark" : "light";
}
