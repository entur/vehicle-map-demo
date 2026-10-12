import type {
  ExpressionSpecification,
  SkySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { EDGE_INK, EDGE_WHITE } from "./dataColours.ts";
import type { CloudCover, Weather } from "./weather.ts";
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
  /**
   * The selected journey's stop names: the map's darkest or lightest tone,
   * on a halo of the other, so they stand out from the base map's own labels
   * the way the route stands out from its roads.
   */
  journeyStopText: string;
  journeyStopTextHalo: string;
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
    journeyStopText: EDGE_INK,
    journeyStopTextHalo: EDGE_WHITE,
  },
  dark: {
    buildings: "#3a4560",
    hillshadeShadow: "#1c2233",
    sky: {
      "sky-color": "#1f2638",
      "horizon-color": "#2c3550",
      // MapLibre's default is white, a glare over the dark map's distance.
      "fog-color": "#2c3550",
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
    journeyStopText: EDGE_WHITE,
    journeyStopTextHalo: EDGE_INK,
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

/** A sky's two colours: overhead and at the horizon. */
type SkyTone = { sky: string; horizon: string };

/**
 * The sky under cloud, per scheme. Greys rather than blues, and on the dark
 * map still dark: a pale overcast there would be the brightest thing on
 * screen.
 */
const COVER_TONE: Record<
  MapScheme,
  Record<Exclude<CloudCover, "clear">, SkyTone>
> = {
  light: {
    partly: { sky: "#c0d3e2", horizon: "#ecf0f3" },
    cloudy: { sky: "#c5cbd1", horizon: "#e1e4e7" },
    fog: { sky: "#d9dcde", horizon: "#e4e6e7" },
  },
  dark: {
    partly: { sky: "#222837", horizon: "#2e3649" },
    cloudy: { sky: "#2a2e38", horizon: "#343a47" },
    fog: { sky: "#3a3f4a", horizon: "#404652" },
  },
};

/**
 * The sky at full intensity, which an overcast one moves towards as the
 * precipitation grows: darker in rain, paler in snow.
 */
const HEAVY_TONE: Record<MapScheme, Record<"rain" | "snow", SkyTone>> = {
  light: {
    rain: { sky: "#8f98a3", horizon: "#b4bbc3" },
    snow: { sky: "#d8dcdf", horizon: "#eceeef" },
  },
  dark: {
    rain: { sky: "#1b1e25", horizon: "#282c35" },
    snow: { sky: "#3d424d", horizon: "#4a4f5a" },
  },
};

/**
 * How far the haze comes in over the terrain, as MapLibre's
 * `fog-ground-blend`: 1 is the horizon, 0 the map's centre.
 */
const HAZE_REACH = { cloud: 0.5, heaviest: 0.2, fog: 0.1 };

/** `from` moved `share` of the way to `to`; both `#rrggbb`. */
function mixColour(from: string, to: string, share: number): string {
  const channel = (colour: string, i: number) =>
    parseInt(colour.slice(1 + 2 * i, 3 + 2 * i), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(
          channel(from, i) + (channel(to, i) - channel(from, i)) * share,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * The sky for a scheme under `weather`: the scheme's own when the weather is
 * off, unknown or clear — the same object, so nothing is rewritten — and
 * otherwise a grey one, with haze the colour of its horizon over the far
 * terrain. Only the sky and that haze change: the map itself is never
 * tinted, which would dim the data colours. Both show from about 70° of
 * pitch, where the horizon comes on screen.
 */
export function skyFor(
  scheme: MapScheme,
  weather: Weather | null,
): SkySpecification {
  const own = SCHEME_PAINT[scheme].sky;
  if (!weather) return own;
  const { kind, intensity, cover } = weather;
  if (kind === "none" && cover === "clear") return own;

  const tones = COVER_TONE[scheme];
  let tone: SkyTone;
  let reach: number;
  if (kind === "none") {
    // Narrowed above: a dry sky here is partly, cloudy or fog.
    const dry = cover as Exclude<CloudCover, "clear">;
    tone = tones[dry];
    reach = dry === "fog" ? HAZE_REACH.fog : HAZE_REACH.cloud;
  } else {
    const heavy = HEAVY_TONE[scheme][kind];
    tone = {
      sky: mixColour(tones.cloudy.sky, heavy.sky, intensity),
      horizon: mixColour(tones.cloudy.horizon, heavy.horizon, intensity),
    };
    reach =
      HAZE_REACH.cloud + (HAZE_REACH.heaviest - HAZE_REACH.cloud) * intensity;
  }
  return {
    ...own,
    "sky-color": tone.sky,
    "horizon-color": tone.horizon,
    "fog-color": tone.horizon,
    "fog-ground-blend": reach,
  };
}
