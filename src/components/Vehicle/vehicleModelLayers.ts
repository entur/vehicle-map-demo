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
import { lightPoolTexture } from "./lightPoolTexture.ts";
import { hasLightPool, lightPoolMesh } from "../../domain/lightPool.ts";
import type { MapScheme } from "../basemap/basemap.ts";

/** Models draw under the icon layer, so line labels and delay lights stay on top. */
export const MODEL_BEFORE_LAYER = "vehicle-layer";

/** Untinted: deck.gl multiplies this into the vertex colours, and its default is black. */
const UNTINTED: [number, number, number] = [255, 255, 255];

/** How much less light the shaded parts of a model take in dark mode. */
export const DARK_SHADING = 0.7;

/** deck.gl's default Phong material, which `true` selects. */
const DEFAULT_MATERIAL = {
  ambient: 0.35,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [38.25, 38.25, 38.25] as [number, number, number],
};

/** Lit by ambient light alone, so the same from every side. */
const glowing = (strength: number): Material => ({
  ambient: strength,
  diffuse: 0,
  shininess: 1,
  specularColor: [0, 0, 0],
});

/**
 * The models' materials per scheme. In light mode everything is shaded
 * alike. In dark mode the **shaded** parts — body, details and the
 * directionless column — take less light, so the model reads as night, and
 * what gives light of its own does not: the **lamps** at more than full
 * strength, since the taillights' own colour is darker than a red body and at
 * their own colour did not read as lit (channels clip at full, so amber
 * indicators turn more yellow), and the destination **signs** at exactly full
 * strength, which keeps their text as drawn rather than washed out.
 */
export const MODEL_MATERIALS: Record<
  MapScheme,
  { shaded: Material; lamps: Material; signs: Material }
> = {
  light: { shaded: true, lamps: true, signs: true },
  dark: {
    shaded: {
      ...DEFAULT_MATERIAL,
      ambient: DEFAULT_MATERIAL.ambient * DARK_SHADING,
      diffuse: DEFAULT_MATERIAL.diffuse * DARK_SHADING,
    },
    lamps: glowing(1.6),
    signs: glowing(1),
  },
};

/**
 * How the light pools are blended: added to what is under them, so they
 * brighten the dark road rather than paint over it, and without writing depth,
 * so the models drawn after them are not hidden behind a transparent quad.
 */
const LIGHT_POOL_PARAMETERS = {
  depthWriteEnabled: false,
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "zero",
  blendAlphaDstFactor: "one",
} as const;

export type ModelLayerOptions = {
  /** Prefixed to every layer id, so two sets of models can coexist. */
  idPrefix: string;
  visible: boolean;
  opacity: number;
  /** The colour scheme in force, which decides how the models are lit. */
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

  const materials = MODEL_MATERIALS[scheme];
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
  // the details and the lamps drawn in their own fixed colours, and the signs,
  // one layer per destination and sign colour,
  // since the texture carries both and a layer takes one. A ferry has no
  // sign, so no sign layers.
  // In dark mode, a pool of headlight on the road ahead of every vehicle with
  // headlights. Drawn first, so the models are drawn over it.
  const pools =
    scheme === "dark"
      ? [...byMode]
          .filter(([mode]) => hasLightPool(mode))
          .map(
            ([mode, list]) =>
              new SimpleMeshLayer<VehicleUpdate>({
                ...shared,
                id: `${idPrefix}-${mode}-light-pool`,
                data: list,
                mesh: lightPoolMesh(mode),
                texture: lightPoolTexture(),
                getOrientation,
                getColor: UNTINTED,
                material: materials.signs,
                parameters: LIGHT_POOL_PARAMETERS,
              }),
          )
      : [];

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
        material: materials.shaded,
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
                material: materials.signs,
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
        material: materials.shaded,
      }),
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: `${idPrefix}-${mode}-lamps`,
        data: list,
        mesh: lamps,
        getOrientation,
        getColor: UNTINTED,
        material: materials.lamps,
      }),
    ];
  });

  layers.unshift(...pools);
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
      material: materials.shaded,
    }),
  );

  return layers;
}
