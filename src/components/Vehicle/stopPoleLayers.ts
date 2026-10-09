import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { StopPole } from "../../domain/journeyStops.ts";
import { stopPoleModel } from "../../domain/vehicleMeshes.ts";
import { hexToRgb } from "../../domain/vehiclePaint.ts";
import {
  EDGE_INK,
  EDGE_WHITE,
  ROUTE,
  SEVERITY_SEVERE,
} from "../../domain/dataColours.ts";
import { mostLegibleOn } from "../../domain/contrast.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  UNTINTED,
} from "./vehicleModelLayers.ts";
import { signTexture } from "./signTexture.ts";
import { JOURNEY_STOP_PASSED_OPACITY } from "../mapStyle.ts";

/**
 * How much larger than life a stop is drawn. At true scale (`STOP_POLE`) a
 * pole is a few pixels at the chase camera's zoom, beside a bus forty pixels
 * long; three times over, the board is about a bus's height.
 */
export const STOP_POLE_EXAGGERATION = 3;

/** The board's colour: the route's, or the cancellation colour, as the 2D dot. */
const boardColour = (pole: StopPole) =>
  pole.cancelled ? SEVERITY_SEVERE : ROUTE;

/**
 * The name's colour on a board: ink or white, whichever reads better. White
 * on the route colour was about 2.6:1, too faint at a distance; ink is 6:1.
 */
const nameColour = (pole: StopPole) =>
  hexToRgb(mostLegibleOn(boardColour(pole), [EDGE_INK, EDGE_WHITE])) ??
  UNTINTED;

export type StopPoleLayerOptions = {
  visible: boolean;
  opacity: number;
  scheme: MapScheme;
  /** The pole's foot: the stop's position at the terrain's height. */
  getPosition: (pole: StopPole) => [number, number, number];
  /** Changes whenever `getPosition` would return something different. */
  positionTrigger: unknown;
};

/**
 * The deck.gl layers drawing the selected journey's stops as poles with name
 * boards, lit like the vehicle models, `STOP_POLE_EXAGGERATION` times life
 * size. Poles stand upright whatever the slope.
 * Each stop's name is a texture, and a layer takes one, so each board face is
 * a layer of its own; the poles and board edges are one layer each for the
 * stops still ahead and one for those passed, which are faded.
 */
export function stopPoleLayers(
  poles: StopPole[],
  {
    visible,
    opacity,
    scheme,
    getPosition,
    positionTrigger,
  }: StopPoleLayerOptions,
) {
  // Nothing while hidden, as for the vehicle models.
  if (!visible || poles.length === 0) return [];

  const { body, sign, details } = stopPoleModel();
  const materials = MODEL_MATERIALS[scheme];
  const shared = {
    beforeId: MODEL_BEFORE_LAYER,
    visible,
    getPosition,
    // deck.gl yaw turns counter-clockwise; bearing is clockwise from north.
    getOrientation: (pole: StopPole): [number, number, number] => [
      0,
      -pole.bearing,
      0,
    ],
    getScale: [
      STOP_POLE_EXAGGERATION,
      STOP_POLE_EXAGGERATION,
      STOP_POLE_EXAGGERATION,
    ] as [number, number, number],
    updateTriggers: { getPosition: positionTrigger },
  };

  const groups = [
    { id: "ahead", list: poles.filter((pole) => !pole.passed), fade: 1 },
    {
      id: "passed",
      list: poles.filter((pole) => pole.passed),
      fade: JOURNEY_STOP_PASSED_OPACITY,
    },
  ].filter(({ list }) => list.length > 0);

  return [
    ...groups.flatMap(({ id, list, fade }) => [
      new SimpleMeshLayer<StopPole>({
        ...shared,
        id: `journey-stop-poles-${id}`,
        data: list,
        mesh: details,
        opacity: opacity * fade,
        getColor: UNTINTED,
        material: materials.shaded,
      }),
      new SimpleMeshLayer<StopPole>({
        ...shared,
        id: `journey-stop-boards-${id}`,
        data: list,
        mesh: body,
        opacity: opacity * fade,
        getColor: (pole) => hexToRgb(boardColour(pole)) ?? UNTINTED,
        material: materials.shaded,
      }),
    ]),
    ...poles.map(
      (pole) =>
        new SimpleMeshLayer<StopPole>({
          ...shared,
          // By call, not stop: a stop visited twice is two poles.
          id: `journey-stop-name-${pole.key}`,
          data: [pole],
          mesh: sign,
          opacity: opacity * (pole.passed ? JOURNEY_STOP_PASSED_OPACITY : 1),
          texture: signTexture(pole.name, nameColour(pole), boardColour(pole)),
          getColor: UNTINTED,
          material: materials.signs,
        }),
    ),
  ];
}
