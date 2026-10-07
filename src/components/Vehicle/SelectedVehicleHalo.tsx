import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { FilterSpecification } from "@maplibre/maplibre-gl-style-spec";
import { whenLayerExists } from "../../utils/whenLayerExists.ts";
import {
  VehicleSelection,
  selectedVehicleFilter,
} from "../../domain/vehicleSelection.ts";

/**
 * The circle around a dot or icon, then the footprint outline under a model.
 * The first is the one `whenLayerExists` waits for; all are in the one style.
 */
const HALO_LAYERS = [
  "vehicle-selected-halo-layer",
  "vehicle-selected-outline-layer",
  "vehicle-selected-outline-fill-layer",
];

/**
 * Rings the selected vehicle on the map. With no popup at the vehicle, this
 * is what ties the detail panel to one of many look-alike icons. Sets the
 * halo layers' filter and draws nothing itself; the cleanup clears it, so
 * leaving vehicles mode leaves no ring behind.
 */
export function SelectedVehicleHalo({
  selection,
}: {
  selection: VehicleSelection | null;
}) {
  const { current: mapRef } = useMap();
  const vehicleId = selection?.vehicleId ?? null;
  const serviceJourneyId = selection?.serviceJourneyId ?? null;

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const filter = selectedVehicleFilter(
      vehicleId !== null && serviceJourneyId !== null
        ? { vehicleId, serviceJourneyId }
        : null,
    );
    const apply = (filter: FilterSpecification) => {
      for (const id of HALO_LAYERS) {
        if (map.getLayer(id)) map.setFilter(id, filter);
      }
    };
    const cancel = whenLayerExists(map, HALO_LAYERS[0], () => apply(filter));
    return () => {
      cancel();
      apply(selectedVehicleFilter(null));
    };
  }, [mapRef, vehicleId, serviceJourneyId]);

  return null;
}
