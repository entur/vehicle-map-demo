import type {
  ExpressionSpecification,
  SkySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { EDGE_INK, EDGE_WHITE } from "./dataColours.ts";
import {
  BASE_MAP_SNAPSHOTS,
  MAP_SCHEMES,
  MapScheme,
  schemePrefix,
} from "../components/basemap/basemap.ts";
import {
  FERRY_LABEL_LAYER,
  FERRY_LINE_LAYER,
  STATION_LABEL_LAYER,
  STATION_LAYER,
  STOP_LABEL_LAYER,
  STOP_LAYER,
  TRANSIT_LINE_LAYER,
} from "./transitNetwork.ts";

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
  transit: TransitPaint;
  /**
   * The ring round a vehicle dot: the map's own tone, so the mode colour
   * inside is what reads. White on Positron and ink on Fiord look alike for
   * that reason; a white ring on Fiord outweighed the darker mode colours.
   */
  vehicleDotEdge: string;
};

/**
 * The transit network's colours. Muted slate like the rest of the chrome, so
 * the only saturated marks on the map stay the data: stops are neutral
 * circles, and ferries differ from rail by a dash and a cooler tone.
 */
export type TransitPaint = {
  rail: string;
  ferry: string;
  stopFill: string;
  stopStroke: string;
  stationFill: string;
  stationStroke: string;
  text: string;
  textHalo: string;
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
    vehicleDotEdge: EDGE_WHITE,
  },
  dark: {
    buildings: "#3a4560",
    hillshadeShadow: "#1c2233",
    sky: {
      "sky-color": "#1f2638",
      "horizon-color": "#2c3550",
      "sky-horizon-blend": 0.6,
    },
    transit: {
      rail: "#8e99ad",
      ferry: "#93a9cc",
      stopFill: "#2b3345",
      stopStroke: "#c3cad6",
      stationFill: "#d5dbe5",
      stationStroke: "#2b3345",
      text: "#d5dbe5",
      textHalo: "#2b3345",
    },
    vehicleDotEdge: EDGE_INK,
  },
};

/**
 * Every transit network paint property that differs per scheme, as
 * `[layer, property, value]`. The style is built from these and BaseMapScheme
 * re-applies them on a scheme change, so the two cannot drift.
 */
export function transitNetworkPaint(
  scheme: MapScheme,
): [string, string, string][] {
  const t = SCHEME_PAINT[scheme].transit;
  return [
    [TRANSIT_LINE_LAYER, "line-color", t.rail],
    [FERRY_LINE_LAYER, "line-color", t.ferry],
    [STOP_LAYER, "circle-color", t.stopFill],
    [STOP_LAYER, "circle-stroke-color", t.stopStroke],
    [STATION_LAYER, "circle-color", t.stationFill],
    [STATION_LAYER, "circle-stroke-color", t.stationStroke],
    [STOP_LABEL_LAYER, "text-color", t.text],
    [STOP_LABEL_LAYER, "text-halo-color", t.textHalo],
    [STATION_LABEL_LAYER, "text-color", t.text],
    [STATION_LABEL_LAYER, "text-halo-color", t.textHalo],
    [FERRY_LABEL_LAYER, "text-color", t.ferry],
    [FERRY_LABEL_LAYER, "text-halo-color", t.textHalo],
  ];
}

/**
 * `buildings-3d-layer`'s colour: a building's roof colour sampled from the
 * aerial photo when AerialBuildingColours has set one, the scheme's otherwise.
 */
export function buildingColour(scheme: MapScheme): ExpressionSpecification {
  return [
    "coalesce",
    ["feature-state", ROOF_COLOUR_STATE],
    SCHEME_PAINT[scheme].buildings,
  ];
}

/** Feature-state key AerialBuildingColours writes on the building source layer. */
export const ROOF_COLOUR_STATE = "roofColour";

/** MUI's resolved colour scheme (undefined before it resolves) as a base map. */
export function mapSchemeFor(colorScheme: string | undefined): MapScheme {
  return colorScheme === "dark" ? "dark" : "light";
}
