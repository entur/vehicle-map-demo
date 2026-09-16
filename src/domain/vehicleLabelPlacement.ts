import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

/**
 * Where `vehicle-layer`'s line-code label goes: behind the vehicle, on the
 * side of the icon opposite the bearing arrow, so the two never collide.
 *
 * The side is one of four, not eight, so a bus turning at a junction does not
 * swing its label round with every few degrees of heading. A vehicle without
 * a usable bearing keeps the label's original spot above the icon.
 */

type Placement = {
  /** The label's own anchor point — the opposite of the side it sits on. */
  anchor: "top" | "right" | "bottom" | "left" | "top-left";
  /** Ems from the icon's centre, screen axes (+y down). */
  offset: [number, number];
};

/** Clears the icon's circle plus the label's 6px halo at text-size 14. */
const GAP = 1.8;

/** Label below, left, above, right: behind a vehicle heading up, right, down, left on screen. */
const BEHIND: Placement[] = [
  { anchor: "top", offset: [0, GAP] },
  { anchor: "right", offset: [-GAP, 0] },
  { anchor: "bottom", offset: [0, -GAP] },
  { anchor: "left", offset: [GAP, 0] },
];

/** The placement before bearings were drawn, kept for vehicles without one. */
const NO_BEARING: Placement = { anchor: "top-left", offset: [0, -2.8] };

/**
 * Map rotation is applied in steps this size. Every change to the label
 * expressions re-lays out the whole vehicle layer, and the chase camera turns
 * the map continuously; a label a few degrees off the ideal side is invisible.
 */
export const MAP_BEARING_STEP = 15;

export function quantiseMapBearing(mapBearing: number): number {
  const stepped = Math.round(mapBearing / MAP_BEARING_STEP) * MAP_BEARING_STEP;
  return ((stepped % 360) + 360) % 360;
}

/** The side a heading on screen puts the label on: quarters centred on up, right, down, left. */
export function placementFor(
  bearing: number | null,
  mapBearing: number,
): Placement {
  if (bearing === null || !Number.isFinite(bearing)) return NO_BEARING;
  const onScreen = (((bearing - mapBearing + 45) % 360) + 360) % 360;
  return BEHIND[Math.floor(onScreen / 90)];
}

/**
 * The same rule as `placementFor`, as a style expression over the feature's
 * `bearing` property. MapLibre expressions cannot read the map's bearing, so
 * it is baked in and the expression rebuilt when the map turns.
 */
function placementExpression(
  mapBearing: number,
  pick: (placement: Placement) => unknown,
): ExpressionSpecification {
  const onScreen = [
    "%",
    ["+", ["%", ["+", ["-", ["get", "bearing"], mapBearing], 45], 360], 360],
    360,
  ];
  const literal = (p: Placement) => {
    const value = pick(p);
    return Array.isArray(value) ? ["literal", value] : value;
  };
  return [
    "case",
    ["==", ["typeof", ["get", "bearing"]], "number"],
    [
      "step",
      onScreen,
      literal(BEHIND[0]),
      90,
      literal(BEHIND[1]),
      180,
      literal(BEHIND[2]),
      270,
      literal(BEHIND[3]),
    ],
    literal(NO_BEARING),
  ] as unknown as ExpressionSpecification;
}

export function vehicleLabelAnchor(
  mapBearing: number,
): ExpressionSpecification {
  return placementExpression(mapBearing, (p) => p.anchor);
}

export function vehicleLabelOffset(
  mapBearing: number,
): ExpressionSpecification {
  return placementExpression(mapBearing, (p) => p.offset);
}
