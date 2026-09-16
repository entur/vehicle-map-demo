import { useEffect, useMemo, useRef, useState } from "react";
import { useControl, useMap } from "react-map-gl/maplibre";
import { MapLibreOverlay } from "@deck.gl/maplibre";
import type { Layer } from "@deck.gl/core";
import { VehicleUpdate } from "../../types.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";
import { ModelLayerOptions, vehicleModelLayers } from "./vehicleModelLayers.ts";
import { ChasedVehicleStore } from "./chasedVehicleStore.ts";

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
  chasedVehicleStore: ChasedVehicleStore;
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
 * camera.
 */
export function VehicleModels({
  data,
  viewDimension,
  chasedVehicleKey,
  chasedVehicleStore,
}: Props) {
  const overlay = useControl(
    () => new MapLibreOverlay({ interleaved: true, layers: [] }),
  );
  const { current: mapRef } = useMap();
  const [opacity, setOpacity] = useState(0);
  const baseLayers = useRef<Layer[]>([]);
  const chasedLayers = useRef<Layer[]>([]);
  const options = useRef<Omit<ModelLayerOptions, "idPrefix"> | null>(null);

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

  const unchased = useMemo(
    () =>
      chasedVehicleKey === null
        ? data
        : data.filter(
            (vehicle) =>
              vehicle.vehicleId + "_" + vehicle.serviceJourney.id !==
              chasedVehicleKey,
          ),
    [data, chasedVehicleKey],
  );

  // Terrain heights, per vehicle report. The vehicle cache replaces a report's
  // object only when a new one arrives, so a vehicle that has not reported
  // since the last frame is not looked up again — and each report is looked up
  // once, not once per model layer. Started afresh when terrain comes or goes.
  const elevations = useMemo(
    () => ({ viewDimension, heights: new WeakMap<VehicleUpdate, number>() }),
    [viewDimension],
  );

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    // Terrain height at the vehicle, or sea level when there is no terrain
    // (2D) or its tiles have not loaded yet — the next vehicle frame retries,
    // since only a found height is cached.
    const getPosition = (vehicle: VehicleUpdate): [number, number, number] => {
      const { longitude, latitude } = vehicle.location;
      let elevation = elevations.heights.get(vehicle);
      if (elevation === undefined) {
        const found = map.queryTerrainElevation([longitude, latitude]);
        if (found !== null && found !== undefined) {
          elevation = found;
          elevations.heights.set(vehicle, found);
        }
      }
      return [longitude, latitude, elevation ?? 0];
    };
    options.current = {
      visible: opacity > 0,
      opacity,
      getPosition,
      positionTrigger: viewDimension,
    };
    baseLayers.current = vehicleModelLayers(unchased, {
      ...options.current,
      idPrefix: "vehicle-models",
    });
    overlay.setProps({
      layers: [...baseLayers.current, ...chasedLayers.current],
    });
  }, [overlay, mapRef, unchased, opacity, viewDimension, elevations]);

  useEffect(() => {
    const publish = () => {
      const vehicle = chasedVehicleStore.get();
      // A new object every frame, so the cache never hits; look the position up
      // once here rather than once per model layer.
      const position = vehicle && options.current?.getPosition(vehicle);
      chasedLayers.current =
        vehicle && options.current && position
          ? vehicleModelLayers([vehicle], {
              ...options.current,
              idPrefix: "vehicle-models-chased",
              getPosition: () => position,
              // A new position every frame, so a new trigger every frame.
              positionTrigger: position,
            })
          : [];
      overlay.setProps({
        layers: [...baseLayers.current, ...chasedLayers.current],
      });
    };
    publish();
    const unsubscribe = chasedVehicleStore.subscribe(publish);
    return () => {
      unsubscribe();
      chasedLayers.current = [];
    };
  }, [overlay, chasedVehicleStore]);

  return null;
}
