import type { Call, EstimatedTimetableUpdate } from "../types.ts";
import { LngLat, distanceMetres } from "./chaseCamera.ts";

/** Moving less than this counts as standing still. */
export const STATIONARY_METRES = 25;
/** How many stops the kiosk band lists ahead. */
export const UPCOMING_STOPS = 5;

/** What the kiosk knows about its target on one tick. */
export type KioskWorld = {
  /** The target is in the live vehicle data. */
  targetInFeed: boolean;
  /** How long it has stayed within STATIONARY_METRES; 0 when unknown. */
  stillForMs: number;
  /** Its journey's last call has an actual arrival. */
  journeyEnded: boolean;
  /** The latest actual arrival on its journey, ms; null without one. */
  lastArrivalAt: number | null;
};

/** Where the vehicle was when it last moved, and since when it has not. */
export type Stillness = { anchor: LngLat; since: number };

export function trackStillness(
  prev: Stillness | null,
  position: LngLat,
  now: number,
): Stillness {
  if (prev && distanceMetres(prev.anchor, position) <= STATIONARY_METRES) {
    return prev;
  }
  return { anchor: position, since: now };
}

export function journeyEnded(calls: Call[]): boolean {
  const last = calls[calls.length - 1];
  return last !== undefined && last.actualArrivalTime !== null;
}

export function lastArrivalAt(calls: Call[]): number | null {
  let latest: number | null = null;
  for (const call of calls) {
    if (!call.actualArrivalTime) continue;
    const at = Date.parse(call.actualArrivalTime);
    if (Number.isNaN(at)) continue;
    if (latest === null || at > latest) latest = at;
  }
  return latest;
}

/**
 * The calls not yet departed from, nearest first. The first is the stop the
 * vehicle is at or heading for.
 */
export function upcomingCalls(calls: Call[], count = UPCOMING_STOPS): Call[] {
  return calls
    .filter((call) => call.actualDepartureTime === null)
    .slice(0, count);
}

/**
 * The timetable's calls if it is the target's journey. The subscription in
 * `MapView` follows the selection, so for a moment after a switch it still
 * holds the previous journey — whose last stop must not end the new chase.
 */
export function callsFor(
  timetable: EstimatedTimetableUpdate | null,
  serviceJourneyId: string,
): Call[] | null {
  return timetable?.serviceJourney.id === serviceJourneyId
    ? timetable.calls
    : null;
}

/** One tick's world, and the stillness to carry to the next tick. */
export function kioskWorld(
  position: LngLat | null,
  calls: Call[] | null,
  stillness: Stillness | null,
  now: number,
): { world: KioskWorld; stillness: Stillness | null } {
  const next = position ? trackStillness(stillness, position, now) : stillness;
  return {
    world: {
      targetInFeed: position !== null,
      stillForMs: position && next ? now - next.since : 0,
      journeyEnded: calls ? journeyEnded(calls) : false,
      lastArrivalAt: calls ? lastArrivalAt(calls) : null,
    },
    stillness: next,
  };
}
