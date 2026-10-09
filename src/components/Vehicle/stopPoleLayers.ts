import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { StopPole } from "../../domain/journeyStops.ts";
import { stopPoleModel } from "../../domain/vehicleMeshes.ts";
import { hexToRgb } from "../../domain/vehiclePaint.ts";
import { ROUTE, SEVERITY_SEVERE } from "../../domain/dataColours.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  UNTINTED,
} from "./vehicleModelLayers.ts";
import { signTexture } from "./signTexture.ts";

const NAME_COLOUR: [number, number, number] = [255, 255, 255];

/**
 * How much larger than life a stop is drawn. At true scale (`STOP_POLE`) a
 * pole is a few pixels at the chase camera's zoom, beside a bus forty pixels
 * long; three times over, the board is about a bus's height.
 */
export const STOP_POLE_EXAGGERATION = 3;

/** Faded as the 2D dot of a call already made is. */
const PASSED_OPACITY = 0.55;

/** The board's colour: the route's, or the cancellation colour, as the 2D dot. */
const boardColour = (pole: StopPole) =>
  pole.cancelled ? SEVERITY_SEVERE : ROUTE;

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
      fade: PASSED_OPACITY,
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
          id: `journey-stop-name-${pole.order}-${pole.stopId}`,
          data: [pole],
          mesh: sign,
          opacity: opacity * (pole.passed ? PASSED_OPACITY : 1),
          texture: signTexture(pole.name, NAME_COLOUR, boardColour(pole)),
          getColor: UNTINTED,
          material: materials.signs,
        }),
    ),
  ];
}
