import { useState, useEffect } from "react";
import { VehicleData } from "./useVehiclePositionsData.ts";
import { SelectedVehicle } from "../components/Vehicle/VehicleMarkers.tsx";

export function useFollowedVehicle(
  data: VehicleData[],
  selectedVehicle: SelectedVehicle | null,
  mapRef: React.RefObject<any>,
) {
  const [followedVehicle, setFollowedVehicle] =
    useState<SelectedVehicle | null>(null);

  useEffect(() => {
    if (followedVehicle && mapRef.current) {
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
          newCoords[0] !== followedVehicle.coordinates[0] ||
          newCoords[1] !== followedVehicle.coordinates[1]
        ) {
          const updatedFollowVehicle = {
            ...followedVehicle,
            coordinates: newCoords,
          };
          setFollowedVehicle(updatedFollowVehicle);
          mapRef.current.flyTo({
            center: newCoords,
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

  return { followedVehicle, handleFollowToggle };
}
