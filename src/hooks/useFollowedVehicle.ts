import { useState, useEffect } from "react";
import { VehicleData } from "./useVehiclePositionsData.ts"; // adjust import as needed
import { SelectedVehicle } from "../components/Vehicle/VehicleMarkers.tsx";

export function useFollowedVehicle(
  data: VehicleData[],
  selectedVehicle: SelectedVehicle | null,
  mapRef: React.RefObject<any>,
) {
  const [followedVehicle, setFollowedVehicle] =
    useState<SelectedVehicle | null>(null);

  // This effect updates the followed vehicle's coordinates and flies the map if necessary.
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

  // Toggle the followed vehicle based on the currently selected vehicle.
  const handleFollowToggle = () => {
    if (followedVehicle?.properties.id === selectedVehicle?.properties.id) {
      setFollowedVehicle(null);
    } else if (selectedVehicle) {
      setFollowedVehicle(selectedVehicle);
    }
  };

  return { followedVehicle, handleFollowToggle };
}
