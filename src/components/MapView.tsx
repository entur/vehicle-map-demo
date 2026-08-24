import { useEffect, useRef, useState } from "react";
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
import { LeftMenu } from "./LeftMenu";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";
import { VehicleTraces } from "./Vehicle/VehicleTraces.tsx";
import { VehiclePopup } from "./Vehicle/VehiclePopup.tsx";
import { useFollowedVehicle } from "../hooks/useFollowedVehicle"; // adjust path as needed
import { SelectedVehiclePanel } from "./SelectedVehiclePanel";
import { RouteLayer } from "./RouteLayer.tsx";
import { SituationLayers } from "./SituationLayers.tsx";
import { AppMode } from "../domain/appMode.ts";

type MapViewProps = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  data: VehicleData[];
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  currentFilter: Filter | null;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function MapView({
  mode,
  setMode,
  data,
  setCurrentFilter,
  currentFilter,
  mapViewOptions,
  setMapViewOptions,
}: MapViewProps) {
  const [selectedVehicle, setSelectedVehicle] =
    useState<SelectedVehicle | null>(null);
  const [tripCancelled, setTripCancelled] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (selectedVehicle === null) {
      setTripCancelled(false);
    }
  }, [selectedVehicle]);

  // A selection has no rendering in the other mode, and returning to a stale
  // one — pointing at a journey whose vehicle expired while away — is worse
  // than returning to none.
  useEffect(() => {
    setSelectedVehicle(null);
  }, [mode]);

  const handleMapLoad = (event: any) => {
    mapRef.current = event.target;
  };

  const { followedVehicle, handleFollowToggle } = useFollowedVehicle(
    data,
    selectedVehicle,
    mapRef,
  );

  return (
    <>
      <Map
        initialViewState={{ longitude: 10.0, latitude: 64.0, zoom: 4 }}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
      >
        <NavigationControl position="top-left" />
        <GeolocateControl position="top-left" />
        <LeftMenu
          mode={mode}
          data={data.map((vehicle) => vehicle.vehicleUpdate)}
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
        <RightMenu
          mode={mode}
          setMode={setMode}
          data={data.map((vehicle) => vehicle.vehicleUpdate)}
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
          mapViewOptions={mapViewOptions}
          setMapViewOptions={setMapViewOptions}
        />
        <RegisterIcons />
        <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
        {mode === "vehicles" && (
          <>
            <VehicleMarkers
              data={data.map((vehicle) => vehicle.vehicleUpdate)}
              setSelectedVehicle={setSelectedVehicle}
              followedVehicleId={
                followedVehicle ? followedVehicle.properties.id : null
              }
            />
            {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}
            <RouteLayer
              serviceJourneyId={
                selectedVehicle?.properties.serviceJourneyId ?? null
              }
              cancelled={tripCancelled}
            />
            {selectedVehicle && (
              <VehiclePopup
                vehicle={selectedVehicle}
                onClose={() => setSelectedVehicle(null)}
                onFollow={handleFollowToggle}
                followedVehicle={followedVehicle}
              />
            )}
          </>
        )}
        {mode === "situations" && (
          <SituationLayers
            visible={
              mapViewOptions.showAffectedStops ||
              mapViewOptions.showAffectedLines
            }
          />
        )}
      </Map>
      {mode === "vehicles" && (
        <SelectedVehiclePanel
          selectedVehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onCancellationChange={setTripCancelled}
        />
      )}
    </>
  );
}
