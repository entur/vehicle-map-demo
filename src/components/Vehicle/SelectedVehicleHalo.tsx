import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { whenLayerExists } from "../../utils/whenLayerExists.ts";
import {
  VehicleSelection,
  selectedVehicleFilter,
} from "../../domain/vehicleSelection.ts";

const HALO_LAYER = "vehicle-selected-halo-layer";

/**
 * Rings the selected vehicle on the map. With no popup at the vehicle, this
 * is what ties the detail panel to one of many look-alike icons. Sets the
 * halo layer's filter and draws nothing itself; the cleanup clears it, so
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
    const cancel = whenLayerExists(map, HALO_LAYER, () =>
      map.setFilter(HALO_LAYER, filter),
    );
    return () => {
      cancel();
      if (map.getLayer(HALO_LAYER)) {
        map.setFilter(HALO_LAYER, selectedVehicleFilter(null));
      }
    };
  }, [mapRef, vehicleId, serviceJourneyId]);

  return null;
}
