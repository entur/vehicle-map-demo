import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControl, useMap } from "react-map-gl/maplibre";
import { MapLibreOverlay } from "@deck.gl/maplibre";
import { useColorScheme } from "@mui/material/styles";
import type { Layer } from "@deck.gl/core";
import { VehicleUpdate } from "../../types.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";
import { mapSchemeFor } from "../../domain/baseMapScheme.ts";
import { SCHEDULE_GHOST_OPACITY, VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";
import {
  MODEL_BEFORE_LAYER,
  ModelLayerOptions,
  vehicleModelLayers,
} from "./vehicleModelLayers.ts";
import { withLayerAsStyleLoaded } from "../../utils/withLayerAsStyleLoaded.ts";
import { ViewBounds, vehiclesInView } from "../../domain/vehiclesInView.ts";
import { VehicleStore } from "./chasedVehicleStore.ts";
import { VehicleGround, vehicleGround } from "../../domain/vehicleGround.ts";
import {
  dimensionsFor,
  normaliseBearing,
} from "../../domain/vehicleFootprint.ts";
import { LIGHT_POOL_REACH } from "../../domain/lightPool.ts";

const LEVEL: VehicleGround = {
  elevation: 0,
  pitch: 0,
  poolPitch: 0,
  complete: false,
};

/** Fades the models in over the same half zoom level the icons fade out. */
function modelOpacity(zoom: number) {
  const t = (zoom - VEHICLE_MODEL_MIN_ZOOM) / 0.5;
  // Rounded so a zoom gesture re-renders at most twenty times across the fade.
  return Math.round(Math.min(1, Math.max(0, t)) * 20) / 20;
}

type Props = {
  data: VehicleUpdate[];
  viewDimension: ViewDimension;
  /** Cache key of the vehicle the chase camera draws itself, if any. */
  chasedVehicleKey: string | null;
  chasedVehicleStore: VehicleStore;
  /** The selected vehicle's schedule ghost, written by ScheduleGhost. */
  ghostStore: VehicleStore;
};

/**
 * True-scale 3D vehicle models, rendered by deck.gl interleaved with the
 * MapLibre style so buildings and terrain can hide them. Selection is not
 * handled here: clicks hit the invisible `vehicle-model-layer` footprints in
 * the style, which VehicleMarkers already listens to.
 *
 * A chased vehicle is left out of the ordinary layers and drawn from
 * `chasedVehicleStore` instead, at the position the chase camera interpolated
 * — otherwise its model would sit at the newest report, seconds ahead of the
 * camera. The schedule ghost is drawn the same way, from `ghostStore`, faded.
 */
export function VehicleModels({
  data,
  viewDimension,
  chasedVehicleKey,
  chasedVehicleStore,
  ghostStore,
}: Props) {
  const overlay = useControl(
    () => new MapLibreOverlay({ interleaved: true, layers: [] }),
  );
  const { current: mapRef } = useMap();
  const scheme = mapSchemeFor(useColorScheme().colorScheme);
  const [opacity, setOpacity] = useState(0);
  const baseLayers = useRef<Layer[]>([]);
  const chasedLayers = useRef<Layer[]>([]);
  const ghostLayers = useRef<Layer[]>([]);
  const options = useRef<Omit<ModelLayerOptions, "idPrefix"> | null>(null);

  // Every handover of layers goes through here, so that deck.gl can add its
  // layer group to the style while vehicle frames keep the map "loading".
  const handOver = useCallback(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    withLayerAsStyleLoaded(map, MODEL_BEFORE_LAYER, () =>
      overlay.setProps({
        layers: [
          ...baseLayers.current,
          ...chasedLayers.current,
          ...ghostLayers.current,
        ],
      }),
    );
  }, [mapRef, overlay]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const update = () => setOpacity(modelOpacity(map.getZoom()));
    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapRef]);

  // The view the models are built for, read when a move ends. Not during a
  // chase: its camera moves every frame, and it keeps the data around the
  // vehicle itself.
  const chasing = chasedVehicleKey !== null;
  const [viewBounds, setViewBounds] = useState<ViewBounds | null>(null);
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || chasing) return;
    const update = () => {
      const bounds = map.getBounds();
      setViewBounds([
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()],
      ]);
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [mapRef, chasing]);

  // Only vehicles in view get models. The data normally matches the view
  // already, but straight after a jump from the whole country to one street
  // it is still the country until the next frame: over a thousand layers,
  // which froze the page for seconds.
  const unchased = useMemo(
    () =>
      chasing
        ? data.filter(
            (vehicle) =>
              vehicle.vehicleId + "_" + vehicle.serviceJourney.id !==
              chasedVehicleKey,
          )
        : viewBounds
          ? vehiclesInView(data, viewBounds)
          : data,
    [data, chasing, chasedVehicleKey, viewBounds],
  );

  // The ground under each vehicle report — its height and slope. The vehicle
  // cache replaces a report's object only when a new one arrives, so a vehicle
  // that has not reported since the last frame is not looked up again — and
  // each report is looked up once, not once per model layer. Started afresh
  // when terrain comes or goes.
  const grounds = useMemo(
    () => ({
      viewDimension,
      byReport: new WeakMap<VehicleUpdate, VehicleGround>(),
    }),
    [viewDimension],
  );

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    // The terrain under the vehicle, or level at sea level when there is no
    // terrain (2D) or its tiles have not loaded yet — the next vehicle frame
    // retries, since only a complete result is cached.
    const getGround = (vehicle: VehicleUpdate): VehicleGround => {
      const cached = grounds.byReport.get(vehicle);
      if (cached) return cached;
      const found = vehicleGround(
        (lngLat) => map.queryTerrainElevation(lngLat),
        [vehicle.location.longitude, vehicle.location.latitude],
        normaliseBearing(vehicle.bearing),
        dimensionsFor(vehicle.mode).length,
        LIGHT_POOL_REACH,
      );
      if (found?.complete) grounds.byReport.set(vehicle, found);
      return found ?? LEVEL;
    };
    options.current = {
      visible: opacity > 0,
      opacity,
      scheme,
      getPosition: (vehicle) => [
        vehicle.location.longitude,
        vehicle.location.latitude,
        getGround(vehicle).elevation,
      ],
      getTilt: getGround,
      positionTrigger: viewDimension,
    };
    baseLayers.current = vehicleModelLayers(unchased, {
      ...options.current,
      idPrefix: "vehicle-models",
    });
    handOver();
  }, [handOver, mapRef, unchased, opacity, scheme, viewDimension, grounds]);

  useEffect(() => {
    const publish = () => {
      const vehicle = chasedVehicleStore.get();
      // A new object every frame, so the cache never hits; look the ground up
      // once here rather than once per model layer.
      const position = vehicle && options.current?.getPosition(vehicle);
      const tilt = vehicle && options.current?.getTilt(vehicle);
      chasedLayers.current =
        vehicle && options.current && position && tilt
          ? vehicleModelLayers([vehicle], {
              ...options.current,
              idPrefix: "vehicle-models-chased",
              getPosition: () => position,
              getTilt: () => tilt,
              // A new position every frame, so a new trigger every frame.
              positionTrigger: position,
            })
          : [];
      handOver();
    };
    publish();
    const unsubscribe = chasedVehicleStore.subscribe(publish);
    return () => {
      unsubscribe();
      chasedLayers.current = [];
    };
  }, [handOver, chasedVehicleStore]);

  useEffect(() => {
    const publish = () => {
      const ghost = ghostStore.get();
      // Nothing to hand over while there was no ghost and still is none.
      if (!ghost && ghostLayers.current.length === 0) return;
      const position = ghost && options.current?.getPosition(ghost);
      const tilt = ghost && options.current?.getTilt(ghost);
      ghostLayers.current =
        ghost && options.current && position && tilt
          ? vehicleModelLayers([ghost], {
              ...options.current,
              idPrefix: "vehicle-models-ghost",
              opacity: options.current.opacity * SCHEDULE_GHOST_OPACITY,
              getPosition: () => position,
              getTilt: () => tilt,
              positionTrigger: position,
            })
          : [];
      handOver();
    };
    publish();
    const unsubscribe = ghostStore.subscribe(publish);
    return () => {
      unsubscribe();
      ghostLayers.current = [];
    };
  }, [handOver, ghostStore]);

  return null;
}
