import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { VehicleModeEnumeration } from "../types.ts";
import {
  UNKNOWN_VEHICLE_COLOUR,
  UNKNOWN_VEHICLE_ICON,
  VEHICLE_COLOUR_BY_MODE,
  VEHICLE_DOT_COLOUR_MATCH,
  VEHICLE_DOT_SORT_KEY,
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

/**
 * Evaluates `["match", ["get", "mode"], k1, v1, …, fallback]` for one mode,
 * where a key may also be an array of labels.
 */
function evaluateMatch(mode: string, match: unknown = VEHICLE_ICON_MATCH) {
  const [, , ...rest] = match as unknown[];
  const fallback = rest[rest.length - 1];
  for (let i = 0; i < rest.length - 1; i += 2) {
    const key = rest[i];
    if (Array.isArray(key) ? key.includes(mode) : key === mode) {
      return rest[i + 1];
    }
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

describe("vehicle dots", () => {
  it.each(
    Object.entries(EXPECTED).filter(
      ([, icon]) => icon !== UNKNOWN_VEHICLE_ICON,
    ),
  )("colours %s like the fill of its icon's SVG", (mode, icon) => {
    const file = icon.replace("vehicle-", "");
    const svg = readFileSync(
      new URL(`../static/images/vehicles/${file}.svg`, import.meta.url),
      "utf8",
    );
    const fill = svg.match(/fill="(#[0-9A-Fa-f]{6})"/)?.[1];
    expect(fill).toBe(VEHICLE_COLOUR_BY_MODE[mode as VehicleModeEnumeration]);
    expect(evaluateMatch(mode, VEHICLE_DOT_COLOUR_MATCH)).toBe(fill);
  });

  it("gives a mode without an icon the unknown colour", () => {
    for (const mode of ["AIR", "TAXI", "HOVERCRAFT"]) {
      expect(evaluateMatch(mode, VEHICLE_DOT_COLOUR_MATCH)).toBe(
        UNKNOWN_VEHICLE_COLOUR,
      );
    }
  });

  it("draws buses and coaches under the other modes, and unknown on top", () => {
    const key = (mode: string) => evaluateMatch(mode, VEHICLE_DOT_SORT_KEY);
    expect(key("BUS")).toBe(0);
    expect(key("COACH")).toBe(0);
    for (const mode of ["TRAM", "METRO", "RAIL", "FERRY"]) {
      expect(key(mode)).toBe(1);
    }
    expect(key("AIR")).toBe(2);
    expect(key("HOVERCRAFT")).toBe(2);
  });
});
