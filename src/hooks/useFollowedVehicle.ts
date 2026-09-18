import { useState, useEffect, useCallback, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { VehicleData } from "./useVehiclePositionsData.ts";
import { SelectedVehicle } from "../components/Vehicle/VehicleMarkers.tsx";

export function useFollowedVehicle(
  data: VehicleData[],
  selectedVehicle: SelectedVehicle | null,
  mapRef: React.RefObject<MapLibreMap | null>,
) {
  const [followedVehicle, setFollowedVehicle] =
    useState<SelectedVehicle | null>(null);

  // Where the camera was last sent, so a frame that did not move the vehicle
  // does not restart the flight. A ref, not state: nothing renders from it.
  const flownTo = useRef<number[] | null>(null);
  useEffect(() => {
    flownTo.current = followedVehicle?.coordinates ?? null;
  }, [followedVehicle]);

  useEffect(() => {
    if (followedVehicle && flownTo.current && mapRef.current) {
      const updatedVehicleData = data.find(
        (vehicle) =>
          vehicle.vehicleUpdate.vehicleId === followedVehicle.properties.id,
      );
      if (updatedVehicleData) {
        const newCoords = [
          updatedVehicleData.vehicleUpdate.location.longitude,
          updatedVehicleData.vehicleUpdate.location.latitude,
        ];

        if (
          newCoords[0] !== flownTo.current[0] ||
          newCoords[1] !== flownTo.current[1]
        ) {
          flownTo.current = newCoords;
          mapRef.current.flyTo({
            center: newCoords as [number, number],
            essential: true,
          });
        }
      }
    }
  }, [data, followedVehicle, mapRef]);

  const handleFollowToggle = () => {
    if (
      followedVehicle?.properties.id === selectedVehicle?.properties.id &&
      followedVehicle?.properties.serviceJourneyId ===
        selectedVehicle?.properties.serviceJourneyId
    ) {
      setFollowedVehicle(null);
    } else if (selectedVehicle) {
      setFollowedVehicle(selectedVehicle);
    }
  };

  const clearFollowedVehicle = useCallback(() => setFollowedVehicle(null), []);

  return { followedVehicle, handleFollowToggle, clearFollowedVehicle };
}
