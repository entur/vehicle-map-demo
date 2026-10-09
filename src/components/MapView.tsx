import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import { buildMapStyle } from "./mapStyle.ts";
import { useColorScheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import { mapSchemeFor } from "../domain/baseMapScheme.ts";
import { CaptureBoundingBox } from "./CaptureBoundingBox.tsx";
import { MapAttribution } from "./MapAttribution.tsx";
import { Filter, MapViewOptions } from "../types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import type {
  Map as MapLibreMap,
  MapLibreEvent,
  MapStyleDataEvent,
} from "maplibre-gl";
// MapLibre 6 cannot locate its worker from inside a bundle. `?worker&url`
// rather than `?url`: the worker imports a sibling chunk that `?url` leaves
// out of production builds, so no tiles would load.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { SelectedVehicle, VehicleMarkers } from "./Vehicle/VehicleMarkers.tsx";
import { RegisterIcons } from "./RegisterIcons.tsx";
import { VehicleLabelPlacement } from "./Vehicle/VehicleLabelPlacement.tsx";
import { RightMenu } from "./RightMenu";
import { KioskTool } from "./RightMenu/types.ts";
import { VehicleData } from "../hooks/useVehiclePositionsData.ts";
import { VehicleTraces } from "./Vehicle/VehicleTraces.tsx";
import { VehicleModels } from "./Vehicle/VehicleModels.tsx";
import { useFollowedVehicle } from "../hooks/useFollowedVehicle"; // adjust path as needed
import { SelectedVehiclePanel } from "./SelectedVehiclePanel";
import { RouteLayer } from "./RouteLayer.tsx";
import { ScheduleGhost } from "./Vehicle/ScheduleGhost.tsx";
import { SelectedVehicleHalo } from "./Vehicle/SelectedVehicleHalo.tsx";
import { useTimetableSubscription } from "../hooks/useTimetableSubscription.ts";
import { useServiceJourneyRoute } from "../hooks/useServiceJourneyRoute.ts";
import { buildSchedule } from "../domain/scheduleGhost.ts";
import {
  journeyStopFeatures,
  routeBearings,
  sameStopPoles,
  stopPoles,
} from "../domain/journeyStops.ts";
import { KioskActions, useKiosk } from "../hooks/useKiosk.ts";
import { useKioskSession } from "../hooks/useKioskSession.ts";
import {
  parseKioskSettings,
  restoredFilter,
  targetOf,
} from "../domain/kioskSchedule.ts";
import { FixedViewKioskOverlay, KioskOverlay } from "./KioskOverlay.tsx";
import { useFixedViewKiosk } from "../hooks/useFixedViewKiosk.ts";
import { roundCamera } from "../domain/fixedCamera.ts";
import { vehicleKey } from "../domain/kioskCandidates.ts";
import { callsFor } from "../domain/kioskJourney.ts";
import { selectedVehicleFrom } from "./Vehicle/vehicleFeature.ts";
import { SituationLayers } from "./SituationLayers.tsx";
import { SituationDetailPanel } from "./SituationsPanel/SituationDetailPanel.tsx";
import { AppMode } from "../domain/appMode.ts";
import { ModeLayers } from "./ModeLayers.tsx";
import { ViewDimension } from "../domain/viewDimension.ts";
import { RotateControl } from "./RotateControl.tsx";
import { ViewDimensionControl } from "./ViewDimensionControl.tsx";
import { ViewDimensionLayers } from "./ViewDimensionLayers.tsx";
import { BaseMapScheme } from "./BaseMapScheme.tsx";
import { TransitNetworkLayers } from "./TransitNetworkLayers.tsx";
import { ChaseCamera } from "./Vehicle/ChaseCamera.tsx";
import { ChasedVehicle, VehicleStore } from "./Vehicle/chasedVehicleStore.ts";
import { MapBottomPadding } from "./MapBottomPadding.tsx";
import { DETAIL_SHEET_MEDIA_QUERY } from "./detailDrawer.ts";
import { SURFACE_INSET } from "./theme.ts";
import {
  DetailLayout,
  SheetSnap,
  clampSnap,
  maxSnapFor,
  sheetBottom,
  sheetMapInset,
} from "../domain/bottomSheet.ts";
import { useViewportHeight } from "../hooks/useViewportHeight.ts";
import { useSituations } from "../situations/SituationsContext.ts";

setWorkerUrl(workerUrl);

type MapViewProps = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  viewDimension: ViewDimension;
  setViewDimension: (viewDimension: ViewDimension) => void;
  showTransitNetwork: boolean;
  setShowTransitNetwork: (show: boolean) => void;
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
  showTransitNetwork,
  setShowTransitNetwork,
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
  const [builtScheme] = useState(() => mapSchemeFor(colorScheme));
  const [mapStyle] = useState(() => buildMapStyle(builtScheme));

  // A fixed-view kiosk link loaded cold opens on its camera, so the first
  // frame is already the wall screen's view.
  const [initialViewState] = useState(() => {
    const settings = parseKioskSettings(window.location.search);
    return settings?.kind === "fixed"
      ? { ...settings.camera }
      : { longitude: 10.0, latitude: 64.0, zoom: 4 };
  });

  const [selectedVehicle, setSelectedVehicle] =
    useState<SelectedVehicle | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const handleMapLoad = (event: MapLibreEvent) => {
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
  const [chasedVehicleStore] = useState(() => new VehicleStore());
  const [ghostStore] = useState(() => new VehicleStore());
  // The "Ghost vehicle" switch in the Layers panel. Off by default: it is
  // something to switch on and look for, not a mark to explain unasked.
  const [showScheduleGhost, setShowScheduleGhost] = useState(false);
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

  // A chase is a view from behind the vehicle, which only reads with terrain
  // and buildings. ViewDimensionLayers' pitch ease is superseded by the
  // chase's own fly-in, which starts on the next animation frame.
  const startChase = useCallback(
    (vehicle: ChasedVehicle) => {
      clearFollowedVehicle();
      if (viewDimension !== "3d") {
        chaseSwitchedTo3d.current = true;
        setViewDimension("3d");
      }
      setChasedVehicle(vehicle);
    },
    [clearFollowedVehicle, viewDimension, setViewDimension],
  );

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
    startChase({ vehicleId: id, serviceJourneyId });
  };

  const handleFollow = () => {
    stopChase();
    handleFollowToggle();
  };

  // A selection has no rendering in the other mode, and returning to a stale
  // one — pointing at a journey whose vehicle expired while away — is worse
  // than returning to none. The followed vehicle is cleared alongside it:
  // otherwise the first vehicle frame after returning to Vehicles mode would
  // flyTo a follow target with no panel and no on-screen sign a follow is
  // active. Done where the mode is switched rather than in an effect on
  // `mode`, so the reset lands in the same render as the switch. The mode
  // read from `?mode=` on load needs no reset: nothing is selected yet. A
  // callback so it stays stable between mode changes, and the memoised mode
  // pill in RightMenu skips the vehicle frames.
  const switchMode = useCallback(
    (next: AppMode) => {
      if (next !== mode) {
        setSelectedVehicle(null);
        clearFollowedVehicle();
        stopChase();
      }
      setMode(next);
    },
    [mode, clearFollowedVehicle, stopChase, setMode],
  );

  // The selected journey's timetable and route, here rather than in the panel
  // and the route layer because the schedule ghost reads both. A selection
  // never outlives vehicles mode (switchMode clears it).
  const selectedJourneyId =
    selectedVehicle?.properties.serviceJourneyId ?? null;
  const timetable = useTimetableSubscription(
    selectedJourneyId,
    selectedVehicle?.properties.date ?? null,
  );
  const route = useServiceJourneyRoute(selectedJourneyId);
  // The journey's stops, once for both the 2D dots and the 3D poles. The
  // poles keep their list while a timetable frame changes nothing they show,
  // so their layers are not rebuilt every few seconds.
  const journeyStops = useMemo(
    () => journeyStopFeatures(timetable?.calls ?? null),
    [timetable],
  );
  const stopBearingAt = useMemo(
    () => routeBearings(route?.coordinates ?? null),
    [route],
  );
  const nextStopPoles = useMemo(
    () => stopPoles(journeyStops, stopBearingAt),
    [journeyStops, stopBearingAt],
  );
  const [journeyStopPoles, setJourneyStopPoles] = useState(nextStopPoles);
  if (!sameStopPoles(journeyStopPoles, nextStopPoles)) {
    setJourneyStopPoles(nextStopPoles);
  }
  const ghostSchedule = useMemo(
    () =>
      showScheduleGhost
        ? buildSchedule(route?.coordinates ?? null, timetable)
        : null,
    [showScheduleGhost, route, timetable],
  );

  // Kiosk mode (`?kiosk=<seconds>`, `?kioskView=<camera>`, or Start in the
  // Kiosk tool): the kiosk drives the same selection and chase a person does,
  // through these, so everything that follows a chase — 3D, padding, route,
  // timetable — behaves as it does for a person.
  const kioskSession = useKioskSession();
  const { start: startSession, stop: endSession } = kioskSession;
  const chaseSession =
    kioskSession.session?.kind === "chase" ? kioskSession.session : null;
  const fixedSession =
    kioskSession.session?.kind === "fixed" ? kioskSession.session : null;
  const beginChaseSession = useCallback(
    (dwellMs: number, idleMs: number) =>
      startSession({ kind: "chase", dwellMs, idleMs }),
    [startSession],
  );
  const kioskActions: KioskActions = {
    leave: () => {
      switchMode("vehicles");
      setSelectedVehicle(null);
      clearFollowedVehicle();
      stopChase();
    },
    chase: (vehicle) => {
      setSelectedVehicle(selectedVehicleFrom(vehicle));
      startChase({
        vehicleId: vehicle.vehicleId,
        serviceJourneyId: vehicle.serviceJourney.id,
      });
    },
    watchArea: (boundingBox) =>
      setCurrentFilter((prev) => ({ ...prev, boundingBox })),
    restore: (setup) => {
      switchMode("vehicles");
      setCurrentFilter((prev) => restoredFilter(prev, setup.filter));
      setMapViewOptions(setup.mapViewOptions);
      setShowTransitNetwork(setup.showTransitNetwork);
      setSheetSnap("peek");
    },
  };
  const kiosk = useKiosk({
    session: chaseSession,
    beginSession: beginChaseSession,
    endSession,
    mapRef,
    data,
    timetable,
    actions: kioskActions,
    currentSetup: { mapViewOptions, showTransitNetwork },
  });
  const fixedView = useFixedViewKiosk({
    session: fixedSession,
    beginSession: startSession,
    endSession,
    mapRef,
    actions: {
      leave: kioskActions.leave,
      restore: kioskActions.restore,
      setDimension: setViewDimension,
    },
    currentSetup: { mapViewOptions, showTransitNetwork },
  });
  // What the Kiosk tool shows and does. Memoised, so the memoised tool panel
  // skips the vehicle frames.
  const kioskRun = kioskSession.session;
  const {
    setupFilter: kioskFilter,
    start: startKiosk,
    stop: stopKiosk,
  } = kiosk;
  const {
    setupFilter: fixedViewFilter,
    start: startFixedView,
    stop: stopFixedView,
  } = fixedView;
  const kioskTool = useMemo<KioskTool>(
    () => ({
      session: kioskRun,
      // While a run exists, what it shows is its own setup, which a
      // visitor's filter change while it is paused does not alter.
      filter: !kioskRun
        ? currentFilter
        : kioskRun.kind === "fixed"
          ? fixedViewFilter
          : kioskFilter,
      onStart: (settings) =>
        settings.kind === "fixed"
          ? startFixedView(settings.camera, settings.dimension, settings.idleMs)
          : startKiosk(settings.dwellMs, settings.idleMs),
      // Each ignores a run that is not its own.
      onStop: () => {
        stopKiosk();
        stopFixedView();
      },
      readCamera: () => {
        const map = mapRef.current;
        if (!map) return null;
        const { lat, lng } = map.getCenter();
        return roundCamera({
          latitude: lat,
          longitude: lng,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
      },
      dimension: viewDimension,
    }),
    [
      kioskRun,
      kioskFilter,
      fixedViewFilter,
      currentFilter,
      startKiosk,
      stopKiosk,
      startFixedView,
      stopFixedView,
      viewDimension,
    ],
  );
  // The kiosk's flight owns the bounding box, as a chase does: it set the box
  // to where the flight lands, and the moves on the way would replace it.
  // Unpausing on arrival captures the view the flight landed on.
  const kioskFlying = kiosk.state?.phase.kind === "arriving";
  // A fixed view running and not paused holds its camera: see
  // ViewDimensionLayers.
  const fixedViewRunning = fixedView.state?.lastInputAt === null;
  // Running and not paused: the app's own controls are hidden.
  const kioskRunning =
    (kiosk.state !== null && kiosk.state.phase.kind !== "paused") ||
    fixedViewRunning;
  // The band is the chasing kiosk's; a fixed view leaves the map whole.
  const chaseKioskRunning = kioskRunning && !fixedViewRunning;

  // On a phone the detail panels are a bottom sheet. Its snap lives here rather
  // than in the sheet because the map is padded by its height too, and the
  // two must agree on it in the same render. Kept across selections: someone
  // who opened the sheet to read timetables wants the next one open as well.
  const narrow = useMediaQuery(DETAIL_SHEET_MEDIA_QUERY, { noSsr: true });
  const viewportHeight = useViewportHeight();
  const [chosenSheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  // Capped rather than overwritten, so the user's choice returns when the
  // chase ends.
  const maxSheetSnap = maxSnapFor(chasedVehicle !== null);
  const sheetSnap = clampSnap(chosenSheetSnap, maxSheetSnap);
  // The sheet stands clear above the attribution strip in the corner, which
  // wraps onto more lines as layers add their credits.
  const [attributionHeight, setAttributionHeight] = useState(0);
  const sheetBottomEdge = sheetBottom(SURFACE_INSET, attributionHeight);
  const detailLayout: DetailLayout = narrow
    ? {
        kind: "sheet",
        snap: sheetSnap,
        maxSnap: maxSheetSnap,
        setSnap: setSheetSnap,
        bottom: sheetBottomEdge,
      }
    : { kind: "card" };
  const { selected: selectedSituation } = useSituations();
  const detailOpen =
    mode === "vehicles" ? selectedVehicle !== null : selectedSituation !== null;
  const sheetBottomInset =
    narrow && detailOpen
      ? sheetMapInset(sheetSnap, viewportHeight, sheetBottomEdge)
      : 0;
  // During a chase the HUD sits above the sheet (or near the bottom edge when
  // there is none) and hides more of the map than the sheet alone. Read only
  // while chasing, so the value the HUD last reported cannot outlive it.
  const [chaseHudCovered, setChaseHudCovered] = useState(0);
  const chaseBottomInset = chasedVehicle
    ? Math.max(sheetBottomInset, chaseHudCovered)
    : sheetBottomInset;
  // The kiosk's band hides the bottom of the map on a wide screen. Read only
  // while it is drawn, like the HUD's value.
  const [kioskBandCovered, setKioskBandCovered] = useState(0);
  const kioskBand = chaseKioskRunning && !narrow;
  const mapBottomInset = kioskBand
    ? Math.max(chaseBottomInset, kioskBandCovered)
    : chaseBottomInset;
  // The chase places the camera itself every frame, and a fully open sheet
  // leaves too thin a strip of map to bring anything into.
  const keepInView =
    narrow &&
    mode === "vehicles" &&
    sheetSnap !== "full" &&
    selectedVehicle &&
    !chasedVehicle
      ? (selectedVehicle.coordinates as [number, number])
      : null;

  const vehicleUpdates = useMemo(
    () => data.map((vehicle) => vehicle.vehicleUpdate),
    [data],
  );

  const kioskTarget = kiosk.state ? targetOf(kiosk.state.phase) : null;
  const kioskVehicle = kioskTarget
    ? (data.find(
        ({ vehicleUpdate: v }) =>
          vehicleKey(v.vehicleId, v.serviceJourney.id) === kioskTarget.key,
      )?.vehicleUpdate ?? null)
    : null;
  const kioskCalls = kioskTarget
    ? callsFor(timetable, kioskTarget.serviceJourneyId)
    : null;
  return (
    <>
      <Map
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        onStyleData={handleStyleData}
        attributionControl={false}
      >
        {!kioskRunning && (
          <>
            <NavigationControl position="top-left" />
            <GeolocateControl position="top-left" />
            <ViewDimensionControl
              dimension={viewDimension}
              setDimension={setViewDimension}
            />
            {viewDimension === "3d" && <RotateControl />}
          </>
        )}
        <MapAttribution onHeightChange={setAttributionHeight} />
        <ViewDimensionLayers
          dimension={viewDimension}
          camera={fixedViewRunning ? fixedSession?.camera : undefined}
        />
        <BaseMapScheme builtFor={builtScheme} />
        <TransitNetworkLayers visible={showTransitNetwork} />
        {!kioskRunning && (
          <RightMenu
            mode={mode}
            setMode={switchMode}
            data={vehicleUpdates}
            setCurrentFilter={setCurrentFilter}
            currentFilter={currentFilter}
            mapViewOptions={mapViewOptions}
            setMapViewOptions={setMapViewOptions}
            showTransitNetwork={showTransitNetwork}
            setShowTransitNetwork={setShowTransitNetwork}
            showScheduleGhost={showScheduleGhost}
            setShowScheduleGhost={setShowScheduleGhost}
            kiosk={kioskTool}
          />
        )}
        <MapBottomPadding bottom={mapBottomInset} keepInView={keepInView} />
        <RegisterIcons />
        <VehicleLabelPlacement chasing={chasedVehicle !== null} />
        <ModeLayers mode={mode} mapViewOptions={mapViewOptions} />
        <CaptureBoundingBox
          setCurrentFilter={setCurrentFilter}
          paused={chasedVehicle !== null || kioskFlying}
        />
        {mode === "vehicles" && (
          <>
            <VehicleMarkers
              data={vehicleUpdates}
              setSelectedVehicle={setSelectedVehicle}
              followedVehicleId={
                followedVehicle ? followedVehicle.properties.id : null
              }
              hiddenVehicleKey={chasedVehicleKey}
            />
            <VehicleModels
              showVehicles={mapViewOptions.showVehicles}
              data={vehicleUpdates}
              viewDimension={viewDimension}
              chasedVehicleKey={chasedVehicleKey}
              chasedVehicleStore={chasedVehicleStore}
              ghostStore={ghostStore}
              stopPoles={journeyStopPoles}
            />
            {chasedVehicle && (
              <ChaseCamera
                key={chasedVehicleKey}
                chased={chasedVehicle}
                data={data}
                viewDimension={viewDimension}
                store={chasedVehicleStore}
                setCurrentFilter={setCurrentFilter}
                onStop={stopChase}
                bottomInset={sheetBottomInset}
                onCoveredChange={setChaseHudCovered}
                hudHidden={kioskRunning}
              />
            )}
            {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}
            <RouteLayer
              route={route}
              stops={journeyStops}
              cancelled={timetable?.cancellation === true}
            />
            <SelectedVehicleHalo
              selection={
                selectedVehicle && {
                  vehicleId: selectedVehicle.properties.id,
                  serviceJourneyId: selectedVehicle.properties.serviceJourneyId,
                }
              }
            />
            <ScheduleGhost
              selectedVehicle={selectedVehicle}
              schedule={ghostSchedule}
              data={vehicleUpdates}
              chasedVehicleStore={chasedVehicleStore}
              ghostStore={ghostStore}
            />
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
      {mode === "vehicles" && !kioskBand && (
        <SelectedVehiclePanel
          selectedVehicle={selectedVehicle}
          timetable={timetable}
          onClose={() => setSelectedVehicle(null)}
          layout={detailLayout}
          actions={{
            isFollowing:
              followedVehicle !== null &&
              followedVehicle.properties.id === selectedVehicle?.properties.id,
            onFollow: handleFollow,
            onChase: handleChaseToggle,
          }}
        />
      )}
      {mode === "situations" && <SituationDetailPanel layout={detailLayout} />}
      {fixedView.state && (
        <FixedViewKioskOverlay
          state={fixedView.state}
          idleMs={fixedView.idleMs}
          onResume={fixedView.resume}
        />
      )}
      {kiosk.state && (
        <KioskOverlay
          state={kiosk.state}
          config={kiosk.config}
          vehicle={kioskVehicle}
          calls={kioskCalls}
          narrow={narrow}
          bottom={sheetBottomEdge}
          onCoveredChange={setKioskBandCovered}
          onResume={kiosk.resume}
        />
      )}
    </>
  );
}
