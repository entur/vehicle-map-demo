import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import type { Decoration } from "../../domain/decorationPlacement.ts";
import { pumpkinModel } from "../../domain/vehicleMeshes.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  UNTINTED,
} from "../Vehicle/vehicleModelLayers.ts";

export type PumpkinLayerOptions = {
  visible: boolean;
  opacity: number;
  scheme: MapScheme;
  /** The terrain's height under the pumpkin, or 0 in 2D. */
  getElevation: (pumpkin: Decoration) => number;
  /** Changes whenever `getElevation` would return something different. */
  positionTrigger: unknown;
};

/**
 * The deck.gl layers drawing the seasonal pumpkins, lit like the vehicle
 * models: every pumpkin is an instance of one mesh, so there are three layers
 * however many pumpkins are in view — body, stems and, in dark mode only, the
 * glowing face. In light mode the face is not drawn and they are plain
 * pumpkins.
 */
export function pumpkinLayers(
  pumpkins: Decoration[],
  {
    visible,
    opacity,
    scheme,
    getElevation,
    positionTrigger,
  }: PumpkinLayerOptions,
): SimpleMeshLayer<Decoration>[] {
  // Nothing while hidden, as for the vehicle models.
  if (!visible || pumpkins.length === 0) return [];

  const { body, details, lamps } = pumpkinModel();
  const materials = MODEL_MATERIALS[scheme];
  const shared = {
    beforeId: MODEL_BEFORE_LAYER,
    data: pumpkins,
    visible,
    opacity,
    getPosition: (pumpkin: Decoration): [number, number, number] => [
      ...pumpkin.position,
      getElevation(pumpkin),
    ],
    // deck.gl yaw turns counter-clockwise; yaw is clockwise from north.
    getOrientation: (pumpkin: Decoration): [number, number, number] => [
      0,
      -pumpkin.yaw,
      0,
    ],
    getScale: (pumpkin: Decoration): [number, number, number] => [
      pumpkin.height,
      pumpkin.height,
      pumpkin.height,
    ],
    updateTriggers: { getPosition: positionTrigger },
  };

  return [
    new SimpleMeshLayer<Decoration>({
      ...shared,
      id: "seasonal-pumpkins-body",
      mesh: body,
      getColor: (pumpkin) => pumpkin.tint,
      material: materials.shaded,
    }),
    new SimpleMeshLayer<Decoration>({
      ...shared,
      id: "seasonal-pumpkins-stems",
      mesh: details,
      getColor: UNTINTED,
      material: materials.shaded,
    }),
    ...(scheme === "dark"
      ? [
          new SimpleMeshLayer<Decoration>({
            ...shared,
            id: "seasonal-pumpkins-faces",
            mesh: lamps,
            getColor: UNTINTED,
            material: materials.lamps,
          }),
        ]
      : []),
  ];
}
