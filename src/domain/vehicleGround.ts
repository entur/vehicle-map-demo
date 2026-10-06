import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";

/** The terrain's height at a point, or nothing where it is not known. */
export type ElevationAt = (
  lngLat: [number, number],
) => number | null | undefined;

/**
 * Where a vehicle's model stands and how far it leans. A flat model on a
 * slope buries one end in the hill and lifts the other off it, and its light
 * pool — sixteen metres of road ahead — disappears into an uphill street
 * entirely, which no lift kept clear.
 */
export type VehicleGround = {
  /** The terrain's height at the reported position. */
  elevation: number;
  /** The body's nose-up angle in degrees: the slope from its rear to its front. */
  pitch: number;
  /**
   * The light pool's nose-up angle in degrees: the slope from the vehicle's
   * position, where the pool's mesh pivots, to the pool's far end. Separate
   * from `pitch`, since the road ahead can rise more than the road under the
   * vehicle — at the foot of a hill most of all.
   */
  poolPitch: number;
  /**
   * Whether every sample was found. A slope sample missing (its tile not
   * loaded yet) leaves that angle flat; the caller should not keep such a
   * result, so the next frame tries again.
   */
  complete: boolean;
};

/** The point `metres` along `bearing` (clockwise from north) from a position. */
export function pointAlong(
  [longitude, latitude]: [number, number],
  bearing: number,
  metres: number,
): [number, number] {
  const radians = (bearing * Math.PI) / 180;
  const north = metres * Math.cos(radians);
  const east = metres * Math.sin(radians);
  return [
    longitude +
      east / (METRES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180)),
    latitude + north / METRES_PER_DEGREE_LAT,
  ];
}

const slope = (rise: number, run: number) =>
  (Math.atan2(rise, run) * 180) / Math.PI;

/**
 * The ground under a vehicle of `length` metres heading along `bearing`, whose
 * light reaches `poolReach` metres beyond its front: four height lookups, at
 * the position, the rear, the front and the far end of the pool. Nothing when
 * the position's own height is unknown; level when the bearing is.
 */
export function vehicleGround(
  elevationAt: ElevationAt,
  position: [number, number],
  bearing: number | null,
  length: number,
  poolReach: number,
): VehicleGround | null {
  const elevation = elevationAt(position);
  if (elevation === null || elevation === undefined) return null;
  if (bearing === null) {
    return { elevation, pitch: 0, poolPitch: 0, complete: true };
  }

  const at = (metres: number) =>
    elevationAt(pointAlong(position, bearing, metres)) ?? null;
  const rear = at(-length / 2);
  const front = at(length / 2);
  const far = length / 2 + poolReach;
  const poolEnd = at(far);
  return {
    elevation,
    pitch: rear !== null && front !== null ? slope(front - rear, length) : 0,
    poolPitch: poolEnd !== null ? slope(poolEnd - elevation, far) : 0,
    complete: rear !== null && front !== null && poolEnd !== null,
  };
}
