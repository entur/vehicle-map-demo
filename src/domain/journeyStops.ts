import type { FeatureCollection, Point } from "geojson";
import { Call } from "../types.ts";
import { METRES_PER_DEGREE_LAT } from "./vehicleFootprint.ts";
import { ViewBounds, vehiclesInView } from "./vehiclesInView.ts";

/** What the stop markers read from a call. */
export type JourneyStopCall = Pick<
  Call,
  "stopPoint" | "order" | "callType" | "cancellation"
>;

export type JourneyStopProperties = {
  stopId: string;
  name: string;
  order: number;
  /** A recorded call: the vehicle has been there. */
  passed: boolean;
  cancelled: boolean;
};

/**
 * The stops the selected journey calls at, one point per call in timetable
 * order. A stop visited twice is two calls and two points, as the timetable
 * lists it. A call whose stop carries no usable location is left out rather
 * than drawn anywhere else.
 */
export function journeyStopFeatures(
  calls: JourneyStopCall[] | null,
): FeatureCollection<Point, JourneyStopProperties> {
  return {
    type: "FeatureCollection",
    features: (calls ?? []).flatMap((call) => {
      const location = call.stopPoint.location;
      if (
        !location ||
        !Number.isFinite(location.longitude) ||
        !Number.isFinite(location.latitude)
      ) {
        return [];
      }
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [location.longitude, location.latitude],
          },
          properties: {
            stopId: call.stopPoint.id,
            name: call.stopPoint.name,
            order: call.order,
            passed: call.callType === "RECORDED",
            cancelled: call.cancellation,
          },
        },
      ];
    }),
  };
}

/**
 * The route's bearing (clockwise from north) at the segment nearest `point`,
 * in the route's own direction — which way a stop's board faces. Null with no
 * segment to measure.
 */
export function routeBearingAt(
  coordinates: number[][] | null,
  [longitude, latitude]: [number, number],
): number | null {
  if (!coordinates || coordinates.length < 2) return null;
  // Metres east and north of `point`: flat is close enough over one segment.
  const east = METRES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
  const local = ([lon, lat]: number[]): [number, number] => [
    (lon - longitude) * east,
    (lat - latitude) * METRES_PER_DEGREE_LAT,
  ];

  let best: { distance: number; bearing: number } | null = null;
  for (let i = 1; i < coordinates.length; i++) {
    const [ax, ay] = local(coordinates[i - 1]);
    const [bx, by] = local(coordinates[i]);
    const [dx, dy] = [bx - ax, by - ay];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const t = Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || distance < best.distance) {
      const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
      best = { distance, bearing: (bearing + 360) % 360 };
    }
  }
  return best?.bearing ?? null;
}

/** A stop of the selected journey as its 3D pole draws it. */
export type StopPole = JourneyStopProperties & {
  /**
   * Unique within the journey: the call's place in the timetable as well as
   * its order and stop, so two calls the feed numbers alike stay apart.
   */
  key: string;
  position: [number, number];
  /**
   * The route's bearing at the stop, which the board's faces look along.
   * Only the axis matters — both faces carry the name — so a route passing
   * the stop the other way faces it just as well. North with no route.
   */
  bearing: number;
};

/**
 * The route's bearing at a stop, remembered per position: the timetable
 * delivers a new frame every few seconds, and each one would otherwise scan
 * the whole route again for every stop, though neither has moved.
 */
export function routeBearings(
  route: number[][] | null,
): (position: [number, number]) => number {
  const known = new Map<string, number>();
  return (position) => {
    const id = position.join(",");
    let bearing = known.get(id);
    if (bearing === undefined) {
      bearing = routeBearingAt(route, position) ?? 0;
      known.set(id, bearing);
    }
    return bearing;
  };
}

/** The poles for `stops`, each turned to `bearingAt` its position. */
export function stopPoles(
  stops: FeatureCollection<Point, JourneyStopProperties>,
  bearingAt: (position: [number, number]) => number,
): StopPole[] {
  return stops.features.map(({ geometry, properties }, index) => {
    const position: [number, number] = [
      geometry.coordinates[0],
      geometry.coordinates[1],
    ];
    return {
      ...properties,
      key: `${index}-${properties.order}-${properties.stopId}`,
      position,
      bearing: bearingAt(position),
    };
  });
}

/**
 * Whether two lists of poles draw the same. Most timetable frames change
 * nothing a pole shows; keeping the old list then keeps every layer built
 * from it.
 */
export function sameStopPoles(a: StopPole[], b: StopPole[]): boolean {
  return (
    a.length === b.length &&
    a.every((pole, i) => {
      const other = b[i];
      return (
        pole.key === other.key &&
        pole.name === other.name &&
        pole.passed === other.passed &&
        pole.cancelled === other.cancelled &&
        pole.bearing === other.bearing &&
        pole.position[0] === other.position[0] &&
        pole.position[1] === other.position[1]
      );
    })
  );
}

/**
 * The poles in or near the view, as `vehiclesInView` widens it. A long
 * journey has dozens of stops and each name board is a layer and a texture,
 * shared with the vehicles' destination signs in one cache.
 */
export function polesInView(poles: StopPole[], bounds: ViewBounds): StopPole[] {
  return vehiclesInView(
    poles.map((pole) => ({
      pole,
      location: { longitude: pole.position[0], latitude: pole.position[1] },
    })),
    bounds,
  ).map(({ pole }) => pole);
}
