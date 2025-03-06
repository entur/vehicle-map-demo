import { useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import { mapStyle } from "./mapStyle.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, MapViewOptions } from "../types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { SelectedVehicle, VehicleMarkers } from "./Vehicle/VehicleMarkers.tsx";
import { RegisterIcons } from "./RegisterIcons.tsx";
import { RightMenu } from "./RightMenu";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";
import { VehicleTraces } from "./Vehicle/VehicleTraces.tsx";
import { VehiclePopup } from "./Vehicle/VehiclePopup.tsx";
import { useFollowedVehicle } from "../hooks/useFollowedVehicle"; // adjust path as needed

type MapViewProps = {
  data: VehicleData[];
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  currentFilter: Filter | null;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function MapView({
  data,
  setCurrentFilter,
  currentFilter,
  mapViewOptions,
  setMapViewOptions,
}: MapViewProps) {
  const [selectedVehicle, setSelectedVehicle] =
    useState<SelectedVehicle | null>(null);
  const mapRef = useRef<any>(null);

  const handleMapLoad = (event: any) => {
    mapRef.current = event.target;
  };

  const { followedVehicle, handleFollowToggle } = useFollowedVehicle(
    data,
    selectedVehicle,
    mapRef,
  );

  return (
    <Map
      initialViewState={{ longitude: 10.0, latitude: 64.0, zoom: 4 }}
      mapStyle={mapStyle}
      onLoad={handleMapLoad}
    >
      <NavigationControl position="top-left" />
      <GeolocateControl position="top-left" />
      <RightMenu
        data={data.map((vehicle) => vehicle.vehicleUpdate)}
        setCurrentFilter={setCurrentFilter}
        currentFilter={currentFilter}
        mapViewOptions={mapViewOptions}
        setMapViewOptions={setMapViewOptions}
      />
      <RegisterIcons />
      <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
      <VehicleMarkers
        data={data.map((vehicle) => vehicle.vehicleUpdate)}
        setSelectedVehicle={setSelectedVehicle}
        followedVehicleId={
          followedVehicle ? followedVehicle.properties.id : null
        }
      />
      {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}

      {selectedVehicle && (
        <VehiclePopup
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onFollow={handleFollowToggle}
          followedVehicle={followedVehicle}
        />
      )}
    </Map>
  );
}
