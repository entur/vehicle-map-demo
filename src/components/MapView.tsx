import { Map, Popup, NavigationControl } from "react-map-gl/maplibre";
import { mapStyle } from "./mapStyle.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, MapViewOptions } from "../types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { SelectedVehicle, VehicleMarkers } from "./VehicleMarkers.tsx";
import { useState } from "react";
import { RegisterIcons } from "./RegisterIcons.tsx";
import { UserPositionDetector } from "./UserPositionDetector.tsx";
import { RightMenu } from "./RightMenu";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";
import { VehicleTraces } from "./VehicleTraces.tsx";

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

  return (
    <Map
      initialViewState={{
        longitude: 10.0,
        latitude: 64.0,
        zoom: 4,
      }}
      mapStyle={mapStyle}
    >
      <NavigationControl position="top-left" />
      <RightMenu
        data={data.map((vehicle) => vehicle.vehicleUpdate)}
        setCurrentFilter={setCurrentFilter}
        currentFilter={currentFilter}
        mapViewOptions={mapViewOptions}
        setMapViewOptions={setMapViewOptions}
      />
      <RegisterIcons />
      <UserPositionDetector />
      <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
      <VehicleMarkers
        data={data.map((vehicle) => vehicle.vehicleUpdate)}
        setSelectedVehicle={setSelectedVehicle}
      />
      {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}
      {selectedVehicle && (
        <Popup
          longitude={selectedVehicle.coordinates[0]}
          latitude={selectedVehicle.coordinates[1]}
          anchor="top"
          onClose={() => setSelectedVehicle(null)}
        >
          <div>
            <h4>Vehicle Info</h4>
            <p>ID: {selectedVehicle.properties.id as string}</p>
            <p>Mode: {selectedVehicle.properties.mode as string}</p>
            <p>Line number: {selectedVehicle.properties.lineCode as string}</p>
            <p>Delay: {selectedVehicle.properties.delay as number}</p>
            <p>Codespace: {selectedVehicle.properties.codespaceId}</p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
