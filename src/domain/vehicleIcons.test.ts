import { describe, expect, it } from "vitest";
import type { VehicleModeEnumeration } from "../types.ts";
import {
  UNKNOWN_VEHICLE_ICON,
  VEHICLE_ICON_MATCH,
  vehicleIconName,
} from "./vehicleIcons.ts";

// Exhaustive by type: adding a mode to VehicleModeEnumeration fails to compile
// here until someone decides which icon it gets.
const EXPECTED: Record<VehicleModeEnumeration, string> = {
  AIR: UNKNOWN_VEHICLE_ICON,
  BUS: "vehicle-bus",
  COACH: "vehicle-coach",
  FERRY: "vehicle-water",
  METRO: "vehicle-metro",
  RAIL: "vehicle-rail",
  TAXI: UNKNOWN_VEHICLE_ICON,
  TRAM: "vehicle-tram",
};

/** Evaluates `["match", ["get", "mode"], k1, v1, …, fallback]` for one mode. */
function evaluateMatch(mode: string): unknown {
  const [, , ...rest] = VEHICLE_ICON_MATCH as unknown[];
  const fallback = rest[rest.length - 1];
  for (let i = 0; i < rest.length - 1; i += 2) {
    if (rest[i] === mode) return rest[i + 1];
  }
  return fallback;
}

describe("vehicleIconName", () => {
  it.each(Object.entries(EXPECTED))("maps %s to %s", (mode, icon) => {
    expect(vehicleIconName(mode)).toBe(icon);
  });

  it("gives an unexpected mode the generic icon", () => {
    expect(vehicleIconName("HOVERCRAFT")).toBe(UNKNOWN_VEHICLE_ICON);
    expect(vehicleIconName("")).toBe(UNKNOWN_VEHICLE_ICON);
    // Not fooled by inherited object keys.
    expect(vehicleIconName("toString")).toBe(UNKNOWN_VEHICLE_ICON);
  });
});

describe("VEHICLE_ICON_MATCH", () => {
  it("reads the mode property", () => {
    expect((VEHICLE_ICON_MATCH as unknown[]).slice(0, 2)).toEqual([
      "match",
      ["get", "mode"],
    ]);
  });

  it("agrees with vehicleIconName for every mode and an unknown one", () => {
    for (const mode of [...Object.keys(EXPECTED), "HOVERCRAFT"]) {
      expect([mode, evaluateMatch(mode)]).toEqual([
        mode,
        vehicleIconName(mode),
      ]);
    }
  });
});
