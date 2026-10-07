import type { FilterSpecification } from "@maplibre/maplibre-gl-style-spec";

/** Which vehicle is selected: the same pair the vehicle cache is keyed by. */
export type VehicleSelection = {
  vehicleId: string;
  serviceJourneyId: string;
};

/**
 * Filter for `vehicle-selected-halo-layer`: the selected vehicle's feature, or
 * nothing. Keyed on the journey as well as the vehicle, since one vehicle can
 * be in the feed on two journeys at once. Applied to the style rather than the
 * data, so a selection never rebuilds the vehicle features.
 */
export function selectedVehicleFilter(
  selection: VehicleSelection | null,
): FilterSpecification {
  return selection === null
    ? ["boolean", false]
    : [
        "all",
        ["==", ["get", "id"], selection.vehicleId],
        ["==", ["get", "serviceJourneyId"], selection.serviceJourneyId],
      ];
}
