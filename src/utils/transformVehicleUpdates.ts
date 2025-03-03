import { DataItem, VehicleUpdateComplete } from "../types.ts";

function hasData(value: unknown): boolean {
  if (value == null) return false; // catches null or undefined
  if (typeof value === "string" && value.trim().length === 0) {
    return false; // empty string
  }
  return true;
}

function getValueByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

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

  { path: "line.lineRef", label: "Line Ref" },
  { path: "line.lineName", label: "Line Name" },
  { path: "line.publicCode", label: "Line Public Code" },

  { path: "operator.operatorRef", label: "Operator Ref" },

  { path: "codespace.codespaceId", label: "Codespace ID" },

  { path: "serviceJourney.id", label: "Service Journey ID" },
  { path: "serviceJourney.date", label: "Service Journey Date" },

  { path: "datedServiceJourney.id", label: "Dated Service Journey ID" },
  {
    path: "datedServiceJourney.serviceJourney.id",
    label: "Dated -> ServiceJourney ID",
  },
  {
    path: "datedServiceJourney.serviceJourney.date",
    label: "Dated -> ServiceJourney Date",
  },

  { path: "location.latitude", label: "Latitude" },
  { path: "location.longitude", label: "Longitude" },

  {
    path: "progressBetweenStops.linkDistance",
    label: "Link Distance",
  },
  {
    path: "progressBetweenStops.percentage",
    label: "Progress Percentage",
  },

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

  return items.sort((a, b) => a.category.localeCompare(b.category));
}
