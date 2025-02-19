import { Map, Popup, NavigationControl } from "react-map-gl/maplibre";
import { mapStyle } from "./mapStyle.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, VehicleUpdate } from "./types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { SelectedVehicle, VehicleMarkers } from "./VehicleMarkers.tsx";
import { useState } from "react";
import { RegisterIcons } from "./RegisterIcons.tsx";
import { UserPositionDetector } from "./UserPositionDetector.tsx";
import RightMenu from "./RightMenu.tsx";

type MapViewProps = {
  data: VehicleUpdate[];
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null;
};

export function MapView({
  data,
  setCurrentFilter,
  currentFilter,
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
        data={data}
        setCurrentFilter={setCurrentFilter}
        currentFilter={currentFilter}
      ></RightMenu>
      <RegisterIcons />
      <UserPositionDetector />
      <CaptureBoundingBox
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
      />
      <VehicleMarkers data={data} setSelectedVehicle={setSelectedVehicle} />
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
