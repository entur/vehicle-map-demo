import { DataItem, VehicleUpdateComplete } from "../types.ts";

/**
 * Decide if a value counts as having data.
 * Adjust this logic for your own requirements.
 */
function hasData(value: unknown): boolean {
  if (value == null) return false; // catches null or undefined
  if (typeof value === "string" && value.trim().length === 0) {
    return false; // empty string
  }
  // Otherwise, we consider it "has data" (numbers, booleans, objects, etc.)
  return true;
}

/**
 * Safely get a nested property using dot notation.
 * E.g. getValueByPath(vehicle, "line.lineRef") => vehicle?.line?.lineRef
 */
function getValueByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * A small helper to define each field you want to check.
 * - `path`: dot-notation path to the field in VehicleUpdateComplete
 * - `label`: a human-friendly name for the field
 */
const FIELDS_TO_CHECK = [
  // Top-level simple fields:
  { path: "direction", label: "Direction" },
  { path: "originRef", label: "Origin Ref" },
  { path: "originName", label: "Origin Name" },
  { path: "destinationRef", label: "Destination Ref" },
  { path: "destinationName", label: "Destination Name" },
  { path: "mode", label: "Mode" },
  { path: "vehicleId", label: "Vehicle ID" },
  { path: "occupancyStatus", label: "Occupancy Status" },
  { path: "lastUpdated", label: "Last Updated" },
  { path: "expiration", label: "Expiration" },
  { path: "speed", label: "Speed" },
  { path: "bearing", label: "Bearing" },
  { path: "monitored", label: "Monitored" },
  { path: "delay", label: "Delay" },
  { path: "inCongestion", label: "In Congestion" },
  { path: "vehicleStatus", label: "Vehicle Status" },

  // Nested fields for complex objects:

  // 1) Line
  { path: "line.lineRef", label: "Line Ref" },
  { path: "line.lineName", label: "Line Name" },
  { path: "line.publicCode", label: "Line Public Code" },

  // 2) Operator
  { path: "operator.operatorRef", label: "Operator Ref" },

  // 3) Codespace
  { path: "codespace.codespaceId", label: "Codespace ID" },

  // 4) ServiceJourney
  { path: "serviceJourney.id", label: "Service Journey ID" },
  { path: "serviceJourney.date", label: "Service Journey Date" },

  // 5) DatedServiceJourney
  { path: "datedServiceJourney.id", label: "Dated Service Journey ID" },
  {
    path: "datedServiceJourney.serviceJourney.id",
    label: "Dated -> ServiceJourney ID",
  },
  {
    path: "datedServiceJourney.serviceJourney.date",
    label: "Dated -> ServiceJourney Date",
  },

  // 6) Location
  { path: "location.latitude", label: "Latitude" },
  { path: "location.longitude", label: "Longitude" },

  // 7) ProgressBetweenStops
  {
    path: "progressBetweenStops.linkDistance",
    label: "Link Distance",
  },
  {
    path: "progressBetweenStops.percentage",
    label: "Progress Percentage",
  },

  // 8) MonitoredCall
  {
    path: "monitoredCall.stopPointRef",
    label: "Stop Point Ref",
  },
  { path: "monitoredCall.order", label: "Stop Order" },
  {
    path: "monitoredCall.vehicleAtStop",
    label: "Vehicle At Stop",
  },
];

export function transformVehicleUpdates(
  vehicles: VehicleUpdateComplete[],
): DataItem[] {
  const items = FIELDS_TO_CHECK.map(({ path, label }) => {
    let count = 0;
    for (const vehicle of vehicles) {
      const value = getValueByPath(vehicle, path);
      if (hasData(value)) {
        count++;
      }
    }
    return {
      category: label,
      itemsWithValue: count,
    };
  });

  // Sort alphabetically by category
  return items.sort((a, b) => a.category.localeCompare(b.category));
}
