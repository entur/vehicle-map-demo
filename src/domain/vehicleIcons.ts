import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { VehicleModeEnumeration } from "../types.ts";

/** Drawn for any mode without its own icon, so it reads as unknown, not as a bus. */
export const UNKNOWN_VEHICLE_ICON = "vehicle-unknown";

/** The arrowhead drawn around a vehicle icon, rotated to its bearing. */
export const BEARING_ARROW_ICON = "vehicle-bearing-arrow";

/** The badge on a followed vehicle's icon, carrying the Follow button's glyph. */
export const FOLLOW_BADGE_ICON = "vehicle-follow-badge";

/** The map image each mode is drawn with. Modes absent here get the generic icon. */
export const VEHICLE_ICON_BY_MODE: Partial<
  Record<VehicleModeEnumeration, string>
> = {
  BUS: "vehicle-bus",
  COACH: "vehicle-coach",
  TRAM: "vehicle-tram",
  METRO: "vehicle-metro",
  RAIL: "vehicle-rail",
  FERRY: "vehicle-water",
};

export function vehicleIconName(mode: string): string {
  // hasOwnProperty, not Object.hasOwn: tsconfig's lib is ES2020.
  return Object.prototype.hasOwnProperty.call(VEHICLE_ICON_BY_MODE, mode)
    ? VEHICLE_ICON_BY_MODE[mode as VehicleModeEnumeration]!
    : UNKNOWN_VEHICLE_ICON;
}

/** The generic icon's fill, and the dot colour of any mode without its own. */
export const UNKNOWN_VEHICLE_COLOUR = "#5b6272";

/**
 * Each icon's fill, as the SVGs in src/static/images/vehicles/ have it, so a
 * vehicle's dot zoomed out is the colour of its icon zoomed in. Bus and coach
 * share a colour, as do tram and metro, because their icons do.
 */
export const VEHICLE_COLOUR_BY_MODE: Partial<
  Record<VehicleModeEnumeration, string>
> = {
  BUS: "#3B46AB",
  COACH: "#3B46AB",
  TRAM: "#78469A",
  METRO: "#78469A",
  RAIL: "#0D827E",
  FERRY: "#046690",
};

/** `vehicle-dot-layer`'s circle-color, from VEHICLE_COLOUR_BY_MODE. */
export const VEHICLE_DOT_COLOUR_MATCH = [
  "match",
  ["get", "mode"],
  ...Object.entries(VEHICLE_COLOUR_BY_MODE).flat(),
  UNKNOWN_VEHICLE_COLOUR,
] as unknown as ExpressionSpecification;

/**
 * `vehicle-dot-layer`'s circle-sort-key: buses and coaches, by far the most
 * numerous, drawn first, so the few trains, trams and boats among them are
 * not buried — and an unknown mode last of all, on top, since an unexpected
 * mode is exactly what a look at the feed should not miss.
 */
export const VEHICLE_DOT_SORT_KEY = [
  "match",
  ["get", "mode"],
  ["BUS", "COACH"],
  0,
  [...Object.keys(VEHICLE_COLOUR_BY_MODE)].filter(
    (mode) => mode !== "BUS" && mode !== "COACH",
  ),
  1,
  2,
] as unknown as ExpressionSpecification;

/** `vehicle-layer`'s icon-image, built from the same table as vehicleIconName. */
export const VEHICLE_ICON_MATCH = [
  "match",
  ["get", "mode"],
  ...Object.entries(VEHICLE_ICON_BY_MODE).flat(),
  UNKNOWN_VEHICLE_ICON,
] as unknown as ExpressionSpecification;
