import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import { buildMapStyle } from "./mapStyle.ts";
import { useColorScheme } from "@mui/material/styles";
import { mapSchemeFor } from "../domain/baseMapScheme.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { Filter, MapViewOptions } from "../types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import type { MapStyleDataEvent } from "maplibre-gl";
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
import { BaseMapScheme } from "./BaseMapScheme.tsx";
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
  const { colorScheme } = useColorScheme();
  // Built once, for the scheme in force at mount, and never replaced: a new
  // style object makes react-map-gl call setStyle, which resets GeoJSON data,
  // layer visibility and registered images. Scheme changes after mount go
  // through BaseMapScheme.
  const [mapStyle] = useState(() => buildMapStyle(mapSchemeFor(colorScheme)));

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
    // Lets the Playwright smoke tests read layer state, which the canvas hides.
    // Development builds only.
    if (import.meta.env.DEV) {
      (window as unknown as { __vehicleMap?: unknown }).__vehicleMap =
        event.target;
    }
  };

  // `onStyleData` fires on the map instance's first 'styledata' — set up by
  // react-map-gl (@vis.gl/react-maplibre's Map component) while constructing
  // the underlying maplibregl.Map, strictly before any child of <Map>
  // (including BaseMapScheme) even mounts: the Map component only renders its
  // children once its own map-instance state is set, one render after the
  // instance — and this listener — are created. So this always observes the
  // style exactly as buildMapStyle baked it, before BaseMapScheme's own
  // 'styledata' listener (registered later, from its own effect) can correct
  // a wrongly-built scheme. Lets the Playwright dark-load smoke test detect a
  // flash of the wrong base map that a check at 'load' time would miss.
  const capturedInitialBaseVisibility = useRef(false);
  const handleStyleData = (event: MapStyleDataEvent) => {
    if (!import.meta.env.DEV || capturedInitialBaseVisibility.current) return;
    capturedInitialBaseVisibility.current = true;
    const map = event.target;
    (
      window as unknown as {
        __vehicleMapInitialBaseVisibility?: {
          light: unknown;
          dark: unknown;
        };
      }
    ).__vehicleMapInitialBaseVisibility = {
      light: map.getLayoutProperty("light/background", "visibility"),
      dark: map.getLayoutProperty("dark/background", "visibility"),
    };
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
        onStyleData={handleStyleData}
      >
        <NavigationControl position="top-left" />
        <GeolocateControl position="top-left" />
        <ViewDimensionControl
          dimension={viewDimension}
          setDimension={setViewDimension}
        />
        {viewDimension === "3d" && <RotateControl />}
        <ViewDimensionLayers dimension={viewDimension} />
        <BaseMapScheme />
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
