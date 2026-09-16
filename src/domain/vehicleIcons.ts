import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { VehicleModeEnumeration } from "../types.ts";

/** Drawn for any mode without its own icon, so it reads as unknown, not as a bus. */
export const UNKNOWN_VEHICLE_ICON = "vehicle-unknown";

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

/** `vehicle-layer`'s icon-image, built from the same table as vehicleIconName. */
export const VEHICLE_ICON_MATCH = [
  "match",
  ["get", "mode"],
  ...Object.entries(VEHICLE_ICON_BY_MODE).flat(),
  UNKNOWN_VEHICLE_ICON,
] as unknown as ExpressionSpecification;
