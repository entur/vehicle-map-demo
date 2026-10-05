import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/**
 * The transit network drawn from the base map's own `openmaptiles` tiles:
 * rail and ferry lines, stations and stops, and their names. Positron and
 * Fiord leave all of it out except railways from zoom 13, but the tiles carry
 * it, so no request is added.
 *
 * This is OpenStreetMap data, not the national stop register: names and
 * positions can differ from NSR, and nothing here carries an `NSR:` id. It is
 * context for the feeds, never something to check them against.
 *
 * These layers belong to no mode — both feeds are read against the same
 * network — and are shown or hidden together by one switch
 * (`TransitNetworkLayers`), not by a `MapViewOptions` key.
 */

export const TRANSIT_LINE_LAYER = "transit-rail-line-layer";
export const FERRY_LINE_LAYER = "transit-ferry-line-layer";
export const FERRY_LABEL_LAYER = "transit-ferry-label-layer";
export const STOP_LAYER = "transit-stop-layer";
export const STATION_LAYER = "transit-station-layer";
export const STOP_LABEL_LAYER = "transit-stop-label-layer";
export const STATION_LABEL_LAYER = "transit-station-label-layer";

/** Drawn among the base map's lines, beneath hillshade and 3D buildings. */
export const TRANSIT_NETWORK_LINE_LAYERS = [
  TRANSIT_LINE_LAYER,
  FERRY_LINE_LAYER,
];

/**
 * Drawn between hillshade and 3D buildings: never shaded, but hidden behind a
 * building in 3D like the street the stop is on.
 */
export const TRANSIT_NETWORK_POINT_LAYERS = [STOP_LAYER, STATION_LAYER];

/**
 * Drawn above the base map's labels, so a stop's name wins over a street's.
 * Later layers are placed first where labels collide: stations before stops.
 */
export const TRANSIT_NETWORK_LABEL_LAYERS = [
  FERRY_LABEL_LAYER,
  STOP_LABEL_LAYER,
  STATION_LABEL_LAYER,
];

export const TRANSIT_NETWORK_LAYERS = [
  ...TRANSIT_NETWORK_LINE_LAYERS,
  ...TRANSIT_NETWORK_POINT_LAYERS,
  ...TRANSIT_NETWORK_LABEL_LAYERS,
];

/** How a `poi` feature is drawn: a large named circle, a small one, or not. */
export type TransitPlaceKind = "station" | "stop";

/**
 * OpenMapTiles `poi` class/subclass pairs, as found in the tiles. A station is
 * where lines meet or a journey starts — worth a name from zoom 12. A stop is
 * one of thousands along a street and is only drawn close in.
 */
const PLACE_KINDS: Record<string, Record<string, TransitPlaceKind>> = {
  railway: {
    station: "station",
    halt: "station",
    subway: "station",
    tram_stop: "stop",
  },
  bus: { bus_station: "station", bus_stop: "stop" },
  ferry_terminal: { ferry_terminal: "station" },
  aerialway: { station: "station" },
};

/** The same rule as the layer filters, in plain TypeScript; the tests hold them together. */
export function transitPlaceKind(properties: {
  class?: unknown;
  subclass?: unknown;
}): TransitPlaceKind | null {
  if (typeof properties.class !== "string") return null;
  if (typeof properties.subclass !== "string") return null;
  return PLACE_KINDS[properties.class]?.[properties.subclass] ?? null;
}

function placeKindFilter(kind: TransitPlaceKind): ExpressionSpecification {
  return [
    "any",
    ...Object.entries(PLACE_KINDS).map(
      ([cls, subclasses]): ExpressionSpecification => [
        "all",
        ["==", ["get", "class"], cls],
        [
          "in",
          ["get", "subclass"],
          [
            "literal",
            Object.entries(subclasses)
              .filter(([, k]) => k === kind)
              .map(([subclass]) => subclass),
          ],
        ],
      ],
    ),
  ];
}

export const STATION_FILTER: ExpressionSpecification =
  placeKindFilter("station");
export const STOP_FILTER: ExpressionSpecification = placeKindFilter("stop");

/** `transportation` classes: mainline rail, and metro, tram and light rail. */
export const TRANSIT_LINE_FILTER: FilterSpecification = [
  "in",
  ["get", "class"],
  ["literal", ["rail", "transit"]],
];

export const FERRY_FILTER: FilterSpecification = [
  "==",
  ["get", "class"],
  "ferry",
];

/** Zoom from which ordinary stops, and their names, are drawn. */
export const STOP_MIN_ZOOM = 15;
