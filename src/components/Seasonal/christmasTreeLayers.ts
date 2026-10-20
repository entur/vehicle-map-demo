import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import type { Decoration } from "../../domain/decorationPlacement.ts";
import { TWINKLE_PERIOD_S } from "../../domain/twinkle.ts";
import { christmasTreeModel, TREE } from "../../domain/vehicleMeshes.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  UNTINTED,
} from "../Vehicle/vehicleModelLayers.ts";
import type { PumpkinLayerOptions } from "./pumpkinLayers.ts";
import type { TwinkleState } from "./twinkleClock.ts";
import {
  TwinkleExtension,
  type TwinkleExtensionProps,
} from "./twinkleExtension.ts";

export type TreeLayerOptions = PumpkinLayerOptions & {
  twinkle: TwinkleState;
};

/**
 * One instance for every build: deck.gl compares extensions, and a new one per
 * tick would count as a change to the layer's shaders.
 */
const TWINKLE = [new TwinkleExtension()];
const phaseOf = (tree: Decoration) => tree.phase;

/**
 * The deck.gl layers drawing the Christmas trees, lit like the vehicle models:
 * every tree is an instance of one mesh per part, so there are
 * `3 + TREE.bulbGroups` layers however many trees are in view — canopy, trunk,
 * star, and a layer per group of bulbs so each group can fade on its own. The
 * lights are drawn in both schemes and glow only in dark mode, where the lamp
 * material lights them. A twinkle tick changes the bulb layers' uniforms only.
 */
export function christmasTreeLayers(
  trees: Decoration[],
  {
    visible,
    opacity,
    scheme,
    getElevation,
    positionTrigger,
    twinkle,
  }: TreeLayerOptions,
): SimpleMeshLayer<Decoration>[] {
  if (!visible || trees.length === 0) return [];

  const { canopy, trunk, star, bulbs } = christmasTreeModel();
  // Wrapped here, in double precision: a wall screen runs for weeks, and as a
  // float32 uniform the raw seconds would step the fade visibly. The curve
  // repeats every period, so this is exactly the same brightness.
  const timeS = twinkle.timeS % TWINKLE_PERIOD_S;
  const materials = MODEL_MATERIALS[scheme];
  const shared = {
    beforeId: MODEL_BEFORE_LAYER,
    data: trees,
    visible,
    opacity,
    getPosition: (tree: Decoration): [number, number, number] => [
      ...tree.position,
      getElevation(tree),
    ],
    // deck.gl yaw turns counter-clockwise; yaw is clockwise from north.
    getOrientation: (tree: Decoration): [number, number, number] => [
      0,
      -tree.yaw,
      0,
    ],
    getScale: (tree: Decoration): [number, number, number] => [
      tree.height,
      tree.height,
      tree.height,
    ],
    updateTriggers: { getPosition: positionTrigger },
  };

  return [
    new SimpleMeshLayer<Decoration>({
      ...shared,
      id: "seasonal-trees-canopy",
      mesh: canopy,
      getColor: (tree) => tree.tint,
      material: materials.shaded,
    }),
    new SimpleMeshLayer<Decoration>({
      ...shared,
      id: "seasonal-trees-trunk",
      mesh: trunk,
      getColor: UNTINTED,
      material: materials.shaded,
    }),
    new SimpleMeshLayer<Decoration>({
      ...shared,
      id: "seasonal-trees-star",
      mesh: star,
      getColor: UNTINTED,
      material: materials.lamps,
    }),
    ...bulbs.map(
      (mesh, group) =>
        new SimpleMeshLayer<Decoration, TwinkleExtensionProps<Decoration>>({
          ...shared,
          id: `seasonal-trees-bulbs-${group}`,
          mesh,
          getColor: UNTINTED,
          material: materials.lamps,
          extensions: TWINKLE,
          getPhase: phaseOf,
          twinkleTimeS: timeS,
          twinkleAmount: twinkle.amount,
          twinkleGroup: group,
          twinkleGroups: TREE.bulbGroups,
        }),
    ),
  ];
}
