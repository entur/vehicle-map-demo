import { Call } from "../../types.ts";

export type ResolvedCallTimes = {
  /** Scheduled time for the side (departure or arrival) being displayed. */
  aimed: string | null;
  /** Best available realtime time for that same side: actual, else expected. */
  realtime: string | null;
  /** realtime - aimed, in seconds. 0 when either side is missing. */
  delaySeconds: number;
};

type Side = { aimed: string | null; realtime: string | null };

function side(
  aimed: string | null,
  expected: string | null,
  actual: string | null,
): Side {
  // A RecordedCall carries either expected or actual times, so an actual time
  // supersedes expected entirely and expected is only a fallback for calls that
  // omit it. An EstimatedCall has no actual times and always uses expected.
  return { aimed, realtime: actual ?? expected };
}

function secondsBetween(aimed: string | null, realtime: string | null): number {
  if (!aimed || !realtime) return 0;
  const a = Date.parse(aimed);
  const r = Date.parse(realtime);
  if (Number.isNaN(a) || Number.isNaN(r)) return 0;
  return Math.round((r - a) / 1000);
}

/**
 * Picks the aimed/realtime pair to display for a call.
 *
 * Departure is preferred, because that is what matters for a stop you have not
 * reached yet; the final stop has no departure and falls back to arrival. Both
 * values are always taken from the same side, so the delay describes one real
 * event rather than an arrival measured against a scheduled departure.
 */
export function resolveCallTimes(call: Call): ResolvedCallTimes {
  const departure = side(
    call.aimedDepartureTime,
    call.expectedDepartureTime,
    call.actualDepartureTime,
  );
  const arrival = side(
    call.aimedArrivalTime,
    call.expectedArrivalTime,
    call.actualArrivalTime,
  );

  const candidates = [departure, arrival].filter((s) => s.aimed !== null);
  const chosen =
    candidates.find((s) => s.realtime !== null) ?? candidates[0] ?? arrival;

  return {
    aimed: chosen.aimed,
    realtime: chosen.realtime,
    delaySeconds: secondsBetween(chosen.aimed, chosen.realtime),
  };
}
