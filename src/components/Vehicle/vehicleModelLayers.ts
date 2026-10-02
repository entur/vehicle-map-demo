import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import type { Material } from "@deck.gl/core";
import { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import {
  dimensionsFor,
  normaliseBearing,
} from "../../domain/vehicleFootprint.ts";
import {
  modelFor,
  unknownHeadingMeshUnit,
} from "../../domain/vehicleMeshes.ts";
import { paintFor } from "../../domain/vehiclePaint.ts";
import { signGroups } from "../../domain/destinationSign.ts";
import { signTexture } from "./signTexture.ts";
import type { MapScheme } from "../basemap/basemap.ts";

/** Models draw under the icon layer, so line labels and delay lights stay on top. */
export const MODEL_BEFORE_LAYER = "vehicle-layer";

/** Untinted: deck.gl multiplies this into the vertex colours, and its default is black. */
const UNTINTED: [number, number, number] = [255, 255, 255];

/**
 * The lamps' material per scheme. In light mode they are shaded like any other
 * detail. In dark mode they take ambient light only, so they are the same
 * from every side, and at more than full strength: the taillights' own colour
 * is darker than a red body, so at their own colour they did not read as lit.
 * Channels clip at full, so the factor brightens a lamp and shifts its hue
 * towards the clipped channel — amber indicators turn more yellow.
 */
export const LAMP_MATERIAL: Record<MapScheme, Material> = {
  light: true,
  dark: { ambient: 1.6, diffuse: 0, shininess: 1, specularColor: [0, 0, 0] },
};

export type ModelLayerOptions = {
  /** Prefixed to every layer id, so two sets of models can coexist. */
  idPrefix: string;
  visible: boolean;
  opacity: number;
  /** The colour scheme in force, which decides how the lamps are lit. */
  scheme: MapScheme;
  getPosition: (vehicle: VehicleUpdate) => [number, number, number];
  /** Changes whenever `getPosition` would return something different. */
  positionTrigger: unknown;
};

/**
 * The deck.gl layers drawing `vehicles` as models: split by mode, since each
 * mode is its own mesh, with a vehicle lacking a usable bearing drawn as the
 * directionless column instead.
 */
export function vehicleModelLayers(
  vehicles: VehicleUpdate[],
  {
    idPrefix,
    visible,
    opacity,
    scheme,
    getPosition,
    positionTrigger,
  }: ModelLayerOptions,
) {
  // Nothing while the models are hidden. Zoomed out, every vehicle in the feed
  // is in the subscription, and the signs alone came to over 1,600 layers,
  // each with a texture to draw and upload — measured, 1.9 fps.
  if (!visible) return [];

  const byMode = new Map<VehicleModeEnumeration, VehicleUpdate[]>();
  const unknownHeading: VehicleUpdate[] = [];
  for (const vehicle of vehicles) {
    if (normaliseBearing(vehicle.bearing) === null) {
      unknownHeading.push(vehicle);
      continue;
    }
    const list = byMode.get(vehicle.mode) ?? [];
    list.push(vehicle);
    byMode.set(vehicle.mode, list);
  }

  const shared = {
    beforeId: MODEL_BEFORE_LAYER,
    visible,
    opacity,
    getPosition,
    updateTriggers: { getPosition: positionTrigger },
  };

  // deck.gl yaw turns counter-clockwise; bearing is clockwise from north.
  const getOrientation = (vehicle: VehicleUpdate): [number, number, number] => [
    0,
    -(normaliseBearing(vehicle.bearing) ?? 0),
    0,
  ];

  // Layers per mode, sharing transforms: the white body coloured per vehicle,
  // the details and the lamps drawn in their own fixed colours — the lamps lit
  // by the scheme — and the signs, one layer per destination and sign colour,
  // since the texture carries both and a layer takes one. A ferry has no
  // sign, so no sign layers.
  const layers = [...byMode].flatMap(([mode, list]) => {
    const { body, sign, details, lamps } = modelFor(mode);
    return [
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: `${idPrefix}-${mode}-body`,
        data: list,
        mesh: body,
        getOrientation,
        getColor: paintFor,
      }),
      ...(sign.positions.value.length > 0
        ? signGroups(list).map(
            ({ key, text, colour, vehicles }) =>
              new SimpleMeshLayer<VehicleUpdate>({
                ...shared,
                id: `${idPrefix}-${mode}-sign-${key}`,
                data: vehicles,
                mesh: sign,
                texture: signTexture(text, colour),
                getOrientation,
                getColor: UNTINTED,
              }),
          )
        : []),
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: `${idPrefix}-${mode}-details`,
        data: list,
        mesh: details,
        getOrientation,
        getColor: UNTINTED,
      }),
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: `${idPrefix}-${mode}-lamps`,
        data: list,
        mesh: lamps,
        getOrientation,
        getColor: UNTINTED,
        material: LAMP_MATERIAL[scheme],
      }),
    ];
  });

  layers.push(
    new SimpleMeshLayer<VehicleUpdate>({
      ...shared,
      id: `${idPrefix}-unknown-heading`,
      data: unknownHeading,
      mesh: unknownHeadingMeshUnit(),
      getScale: (vehicle) => {
        const { width, height } = dimensionsFor(vehicle.mode);
        return [width * 0.75, width * 0.75, height];
      },
      getColor: paintFor,
    }),
  );

  return layers;
}
