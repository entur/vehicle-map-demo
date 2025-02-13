import { Map, Popup } from "react-map-gl/maplibre";
import { mapStyle } from "./mapStyle.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, VehicleUpdate } from "./types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { SelectedVehicle, VehicleMarkers } from "./VehicleMarkers.tsx";
import { useState } from "react";
import { RegisterIcons } from "./RegisterIcons.tsx";

type MapViewProps = {
  data: VehicleUpdate[];
  setCurrentFilter: (filter: Filter) => void;
};

export function MapView({ data, setCurrentFilter }: MapViewProps) {
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
      <RegisterIcons />
      <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
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
          </div>
        </Popup>
      )}
    </Map>
  );
}
