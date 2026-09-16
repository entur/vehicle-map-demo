import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import { mapStyle } from "./mapStyle.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, MapViewOptions } from "../types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
// MapLibre 6 cannot locate its worker from inside a bundle. `?worker&url`
// rather than `?url`: the worker imports a sibling chunk that `?url` leaves
// out of production builds, so no tiles would load.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { SelectedVehicle, VehicleMarkers } from "./Vehicle/VehicleMarkers.tsx";
import { RegisterIcons } from "./RegisterIcons.tsx";
import { RightMenu } from "./RightMenu";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";
import { VehicleTraces } from "./Vehicle/VehicleTraces.tsx";
import { VehicleModels } from "./Vehicle/VehicleModels.tsx";
import { VehiclePopup } from "./Vehicle/VehiclePopup.tsx";
import { useFollowedVehicle } from "../hooks/useFollowedVehicle"; // adjust path as needed
import { SelectedVehiclePanel } from "./SelectedVehiclePanel";
import { RouteLayer } from "./RouteLayer.tsx";
import { SituationLayers } from "./SituationLayers.tsx";
import { SituationDetailPanel } from "./SituationsPanel/SituationDetailPanel.tsx";
import { AppMode } from "../domain/appMode.ts";
import { ModeLayers } from "./ModeLayers.tsx";
import { ViewDimension } from "../domain/viewDimension.ts";
import { RotateControl } from "./RotateControl.tsx";
import { ViewDimensionControl } from "./ViewDimensionControl.tsx";
import { ViewDimensionLayers } from "./ViewDimensionLayers.tsx";
import { ChaseCamera } from "./Vehicle/ChaseCamera.tsx";
import {
  ChasedVehicle,
  ChasedVehicleStore,
} from "./Vehicle/chasedVehicleStore.ts";

setWorkerUrl(workerUrl);

type MapViewProps = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  viewDimension: ViewDimension;
  setViewDimension: (viewDimension: ViewDimension) => void;
  data: VehicleData[];
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  currentFilter: Filter | null;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
};

export function MapView({
  mode,
  setMode,
  viewDimension,
  setViewDimension,
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

  const handleMapLoad = (event: any) => {
    mapRef.current = event.target;
  };

  const { followedVehicle, handleFollowToggle, clearFollowedVehicle } =
    useFollowedVehicle(data, selectedVehicle, mapRef);

  // Chasing and following both move the camera, so starting one stops the other.
  const [chasedVehicle, setChasedVehicle] = useState<ChasedVehicle | null>(
    null,
  );
  const [chasedVehicleStore] = useState(() => new ChasedVehicleStore());
  const chasedVehicleKey = chasedVehicle
    ? chasedVehicle.vehicleId + "_" + chasedVehicle.serviceJourneyId
    : null;

  // Set when starting a chase is what switched the map to 3D, so stopping it
  // can switch back. Cleared if the user leaves 3D during the chase: from then
  // on the dimension is theirs, even if they return to 3D before stopping.
  const chaseSwitchedTo3d = useRef(false);
  useEffect(() => {
    if (viewDimension !== "3d") chaseSwitchedTo3d.current = false;
  }, [viewDimension]);

  // Every way a chase ends goes through here. Both updates land in one render,
  // so the chase's exit ease and the 2D ease run in the same commit and the
  // camera goes straight to 2D rather than via the 3D pitch.
  const stopChase = useCallback(() => {
    setChasedVehicle(null);
    if (chaseSwitchedTo3d.current) {
      chaseSwitchedTo3d.current = false;
      setViewDimension("2d");
    }
  }, [setViewDimension]);

  const handleChaseToggle = () => {
    if (!selectedVehicle) return;
    const { id, serviceJourneyId } = selectedVehicle.properties;
    if (
      chasedVehicle?.vehicleId === id &&
      chasedVehicle.serviceJourneyId === serviceJourneyId
    ) {
      stopChase();
      return;
    }
    clearFollowedVehicle();
    // A chase is a view from behind the vehicle, which only reads with terrain
    // and buildings. ViewDimensionLayers' pitch ease is superseded by the
    // chase's own fly-in, which starts on the next animation frame.
    if (viewDimension !== "3d") {
      chaseSwitchedTo3d.current = true;
      setViewDimension("3d");
    }
    setChasedVehicle({ vehicleId: id, serviceJourneyId });
  };

  const handleFollow = () => {
    stopChase();
    handleFollowToggle();
  };

  // A selection has no rendering in the other mode, and returning to a stale
  // one — pointing at a journey whose vehicle expired while away — is worse
  // than returning to none. The followed vehicle is cleared alongside it:
  // otherwise the first vehicle frame after returning to Vehicles mode would
  // flyTo a follow target with no popup and no on-screen sign a follow is
  // active.
  useEffect(() => {
    setSelectedVehicle(null);
    clearFollowedVehicle();
    stopChase();
  }, [mode, clearFollowedVehicle, stopChase]);

  return (
    <>
      <Map
        initialViewState={{ longitude: 10.0, latitude: 64.0, zoom: 4 }}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
      >
        <NavigationControl position="top-left" />
        <GeolocateControl position="top-left" />
        <ViewDimensionControl
          dimension={viewDimension}
          setDimension={setViewDimension}
        />
        {viewDimension === "3d" && <RotateControl />}
        <ViewDimensionLayers dimension={viewDimension} />
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
        <ModeLayers mode={mode} mapViewOptions={mapViewOptions} />
        <CaptureBoundingBox
          setCurrentFilter={setCurrentFilter}
          paused={chasedVehicle !== null}
        />
        {mode === "vehicles" && (
          <>
            <VehicleMarkers
              data={data.map((vehicle) => vehicle.vehicleUpdate)}
              setSelectedVehicle={setSelectedVehicle}
              followedVehicleId={
                followedVehicle ? followedVehicle.properties.id : null
              }
              hiddenVehicleKey={chasedVehicleKey}
            />
            {mapViewOptions.showVehicles && (
              <VehicleModels
                data={data.map((vehicle) => vehicle.vehicleUpdate)}
                viewDimension={viewDimension}
                chasedVehicleKey={chasedVehicleKey}
                chasedVehicleStore={chasedVehicleStore}
              />
            )}
            {chasedVehicle && (
              <ChaseCamera
                chased={chasedVehicle}
                data={data}
                viewDimension={viewDimension}
                store={chasedVehicleStore}
                setCurrentFilter={setCurrentFilter}
                onStop={stopChase}
              />
            )}
            {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}
            <RouteLayer
              serviceJourneyId={
                selectedVehicle?.properties.serviceJourneyId ?? null
              }
              cancelled={tripCancelled}
            />
            {/* The popup would sit at the newest report, ahead of the chased
                model, and over the road the camera is showing. */}
            {selectedVehicle && !chasedVehicle && (
              <VehiclePopup
                vehicle={selectedVehicle}
                onClose={() => setSelectedVehicle(null)}
                onFollow={handleFollow}
                followedVehicle={followedVehicle}
                onChase={handleChaseToggle}
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
      {mode === "situations" && <SituationDetailPanel />}
    </>
  );
}
