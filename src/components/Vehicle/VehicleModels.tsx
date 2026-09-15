import { useEffect, useMemo, useState } from "react";
import { useControl, useMap } from "react-map-gl/maplibre";
import { MapLibreOverlay } from "@deck.gl/maplibre";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";
import {
  dimensionsFor,
  normaliseBearing,
} from "../../domain/vehicleFootprint.ts";
import {
  modelFor,
  unknownHeadingMeshUnit,
} from "../../domain/vehicleMeshes.ts";
import { paintFor, signColourFor } from "../../domain/vehiclePaint.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";

/** Models draw under the icon layer, so line labels and delay lights stay on top. */
const BEFORE_LAYER = "vehicle-layer";

/** Untinted: deck.gl multiplies this into the vertex colours, and its default is black. */
const UNTINTED: [number, number, number] = [255, 255, 255];

/** Fades the models in over the same half zoom level the icons fade out. */
function modelOpacity(zoom: number) {
  const t = (zoom - VEHICLE_MODEL_MIN_ZOOM) / 0.5;
  // Rounded so a zoom gesture re-renders at most twenty times across the fade.
  return Math.round(Math.min(1, Math.max(0, t)) * 20) / 20;
}

type Props = {
  data: VehicleUpdate[];
  viewDimension: ViewDimension;
};

/**
 * True-scale 3D vehicle models, rendered by deck.gl interleaved with the
 * MapLibre style so buildings and terrain can hide them. Selection is not
 * handled here: clicks hit the invisible `vehicle-model-layer` footprints in
 * the style, which VehicleMarkers already listens to.
 */
export function VehicleModels({ data, viewDimension }: Props) {
  const overlay = useControl(
    () => new MapLibreOverlay({ interleaved: true, layers: [] }),
  );
  const { current: mapRef } = useMap();
  const [opacity, setOpacity] = useState(0);

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

  // Split by mode, since each mode is its own mesh and so its own layer; a
  // vehicle without a usable bearing goes to the directionless column instead.
  const groups = useMemo(() => {
    const byMode = new Map<VehicleModeEnumeration, VehicleUpdate[]>();
    const unknownHeading: VehicleUpdate[] = [];
    for (const vehicle of data) {
      if (normaliseBearing(vehicle.bearing) === null) {
        unknownHeading.push(vehicle);
        continue;
      }
      const list = byMode.get(vehicle.mode) ?? [];
      list.push(vehicle);
      byMode.set(vehicle.mode, list);
    }
    return { byMode, unknownHeading };
  }, [data]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const visible = opacity > 0;
    // Terrain height at the vehicle, or sea level when there is no terrain
    // (2D) or its tiles have not loaded yet — the next vehicle frame retries.
    const getPosition = (vehicle: VehicleUpdate): [number, number, number] => {
      const { longitude, latitude } = vehicle.location;
      const elevation = map.queryTerrainElevation([longitude, latitude]);
      return [longitude, latitude, elevation ?? 0];
    };
    const shared = {
      beforeId: BEFORE_LAYER,
      visible,
      opacity,
      getPosition,
      updateTriggers: { getPosition: viewDimension },
    };

    // deck.gl yaw turns counter-clockwise; bearing is clockwise from north.
    const getOrientation = (
      vehicle: VehicleUpdate,
    ): [number, number, number] => [
      0,
      -(normaliseBearing(vehicle.bearing) ?? 0),
      0,
    ];

    // Up to three layers per mode, sharing data and transforms: the white body
    // and signs, each coloured per vehicle, and the details drawn in their own
    // fixed colours. A ferry has no sign, so no sign layer.
    const layers = [...groups.byMode].flatMap(([mode, vehicles]) => {
      const { body, sign, details } = modelFor(mode);
      return [
        new SimpleMeshLayer<VehicleUpdate>({
          ...shared,
          id: `vehicle-models-${mode}-body`,
          data: vehicles,
          mesh: body,
          getOrientation,
          getColor: paintFor,
        }),
        ...(sign.positions.value.length > 0
          ? [
              new SimpleMeshLayer<VehicleUpdate>({
                ...shared,
                id: `vehicle-models-${mode}-sign`,
                data: vehicles,
                mesh: sign,
                getOrientation,
                getColor: signColourFor,
              }),
            ]
          : []),
        new SimpleMeshLayer<VehicleUpdate>({
          ...shared,
          id: `vehicle-models-${mode}-details`,
          data: vehicles,
          mesh: details,
          getOrientation,
          getColor: UNTINTED,
        }),
      ];
    });

    layers.push(
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: "vehicle-models-unknown-heading",
        data: groups.unknownHeading,
        mesh: unknownHeadingMeshUnit(),
        getScale: (vehicle) => {
          const { width, height } = dimensionsFor(vehicle.mode);
          return [width * 0.75, width * 0.75, height];
        },
        getColor: paintFor,
      }),
    );

    overlay.setProps({ layers });
  }, [overlay, mapRef, groups, opacity, viewDimension]);

  return null;
}
