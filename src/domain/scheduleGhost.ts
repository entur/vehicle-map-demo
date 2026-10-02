import { Call } from "../types.ts";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";

/**
 * The schedule ghost: where the selected vehicle would be now if it ran
 * exactly to its aimed times. It moves along the journey's own route at
 * constant speed from one stop's aimed departure to the next stop's aimed
 * arrival, and waits at each stop in between.
 *
 * Only the route's real geometry is used. Without a route there is no ghost —
 * never a straight line between stops.
 */

/** A stop further than this from the route is left out rather than guessed at. */
export const MAX_STOP_OFFSET_METRES = 150;

/** The fields of a timetable call the ghost reads. */
export type GhostCall = {
  stopPoint: { location: Call["stopPoint"]["location"] };
  aimedArrivalTime: string | null;
  aimedDepartureTime: string | null;
};

/** A route polyline with the distance along it to each vertex, in metres. */
export type GhostRoute = {
  coordinates: number[][];
  cumulative: number[];
};

/** A stop placed on the route, with its aimed times in epoch milliseconds. */
export type ScheduledCall = {
  distance: number;
  arrival: number;
  departure: number;
};

const metresPerDegreeLon = (latitude: number) =>
  METRES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);

/** East and north offset of `to` from `from`, in metres. Exact enough at segment length. */
function offset(from: number[], to: number[]): [number, number] {
  const midLat = (from[1] + to[1]) / 2;
  return [
    (to[0] - from[0]) * metresPerDegreeLon(midLat),
    (to[1] - from[1]) * METRES_PER_DEGREE_LAT,
  ];
}

export function measureRoute(coordinates: number[][]): GhostRoute {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [east, north] = offset(coordinates[i - 1], coordinates[i]);
    cumulative.push(cumulative[i - 1] + Math.hypot(east, north));
  }
  return { coordinates, cumulative };
}

/** The nearest point of segment `i` to `point`: how far off it is, and how far along the route. */
function project(route: GhostRoute, i: number, point: number[]) {
  const a = route.coordinates[i];
  const [ax, ay] = offset(point, a);
  const [dx, dy] = offset(a, route.coordinates[i + 1]);
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared));
  return {
    offset: Math.hypot(ax + t * dx, ay + t * dy),
    distance:
      route.cumulative[i] + t * (route.cumulative[i + 1] - route.cumulative[i]),
  };
}

const parseTime = (time: string | null) =>
  time === null ? null : Date.parse(time);

/**
 * Places each call on the route, in order. Each stop is searched for from where
 * the previous one was found, and taken at the first stretch of route that
 * passes close enough, so a route that doubles back finds a stop on the right
 * leg. A call is left out when it has no aimed time, lies too far from the
 * route, or is timed before the call before it.
 */
export function locateCalls(
  route: GhostRoute,
  calls: GhostCall[],
  maxOffsetMetres = MAX_STOP_OFFSET_METRES,
): ScheduledCall[] {
  const located: ScheduledCall[] = [];
  let fromSegment = 0;

  for (const call of calls) {
    const aimedArrival = parseTime(call.aimedArrivalTime);
    const aimedDeparture = parseTime(call.aimedDepartureTime);
    const arrival = aimedArrival ?? aimedDeparture;
    const departure = aimedDeparture ?? aimedArrival;
    if (arrival === null || departure === null) continue;

    const previous = located[located.length - 1];
    if (previous && arrival < previous.departure) continue;

    const { longitude, latitude } = call.stopPoint.location;
    const point = [longitude, latitude];
    let best: { offset: number; distance: number; segment: number } | null =
      null;
    for (let i = fromSegment; i < route.coordinates.length - 1; i++) {
      const projected = project(route, i, point);
      if (projected.offset <= maxOffsetMetres) {
        if (!best || projected.offset < best.offset) {
          best = { ...projected, segment: i };
        }
      } else if (best) {
        // The first close stretch has ended.
        break;
      }
    }
    if (!best) continue;

    fromSegment = best.segment;
    located.push({
      distance: Math.max(best.distance, previous?.distance ?? 0),
      arrival,
      departure,
    });
  }

  return located;
}

/** How far along the route the schedule puts the vehicle at `now`, or null with under two stops. */
export function scheduledDistance(
  calls: ScheduledCall[],
  now: number,
): number | null {
  if (calls.length < 2) return null;

  for (let i = 0; i < calls.length - 1; i++) {
    const from = calls[i];
    const to = calls[i + 1];
    // Before the first departure, or dwelling at this stop.
    if (now <= from.departure) return from.distance;
    // Past from.departure, so to.arrival > from.departure: no division by zero.
    if (now < to.arrival) {
      const fraction = (now - from.departure) / (to.arrival - from.departure);
      return from.distance + fraction * (to.distance - from.distance);
    }
  }
  return calls[calls.length - 1].distance;
}

function segmentBearing(route: GhostRoute, i: number): number | null {
  const [east, north] = offset(route.coordinates[i], route.coordinates[i + 1]);
  if (east === 0 && north === 0) return null;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Bearing of segment `i`, or of the nearest segment with a length when it has none. */
function bearingNear(route: GhostRoute, i: number): number | null {
  const segments = route.coordinates.length - 1;
  for (let step = 0; step < segments; step++) {
    for (const j of [i + step, i - step]) {
      if (j < 0 || j >= segments) continue;
      const bearing = segmentBearing(route, j);
      if (bearing !== null) return bearing;
    }
  }
  return null;
}

/** The point `distance` metres along the route, clamped to its ends, and the route's heading there. */
export function pointAlong(
  route: GhostRoute,
  distance: number,
): { coordinates: [number, number]; bearing: number | null } {
  const { coordinates, cumulative } = route;
  const last = coordinates.length - 1;
  const asPair = (c: number[]): [number, number] => [c[0], c[1]];

  if (last < 1) return { coordinates: asPair(coordinates[0]), bearing: null };
  if (distance <= 0) {
    return {
      coordinates: asPair(coordinates[0]),
      bearing: bearingNear(route, 0),
    };
  }
  if (distance >= cumulative[last]) {
    return {
      coordinates: asPair(coordinates[last]),
      bearing: bearingNear(route, last - 1),
    };
  }

  let i = 0;
  while (i < last - 1 && cumulative[i + 1] <= distance) i++;
  const length = cumulative[i + 1] - cumulative[i];
  const t = length === 0 ? 0 : (distance - cumulative[i]) / length;
  const a = coordinates[i];
  const b = coordinates[i + 1];
  return {
    coordinates: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
    bearing: bearingNear(route, i),
  };
}
