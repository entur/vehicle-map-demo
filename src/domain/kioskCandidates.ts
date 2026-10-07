import type { Filter, VehicleModeEnumeration } from "../types.ts";
import { distanceMetres } from "./chaseCamera.ts";

/** How often the kiosk refetches the vehicles it can pick from. */
export const SNAPSHOT_INTERVAL_MS = 60_000;
/** Moved at least this far since the previous snapshot to count as moving. */
export const MIN_MOVE_METRES = 100;
/**
 * Seen at most this long before the snapshot was fetched. A proxy for
 * reporting often: a vehicle that reports once a minute is usually seen with
 * an older timestamp. Sometimes wrong, and harmless when it is.
 */
export const FRESH_REPORT_MS = 10_000;
/** How many of the latest picks are skipped while anything else is eligible. */
export const RECENT_PICKS = 10;
/** The live subscription's own default when the filter sets no maxDataAge. */
export const DEFAULT_MAX_DATA_AGE_SECONDS = 30;

/** One vehicle as the kiosk sees it in a snapshot. */
export type KioskVehicle = {
  /** `vehicleId + "_" + serviceJourneyId`, the live cache's key. */
  key: string;
  vehicleId: string;
  serviceJourneyId: string;
  date: string;
  codespaceId: string | null;
  mode: VehicleModeEnumeration;
  lineCode: string;
  destinationName: string | null;
  lon: number;
  lat: number;
  /** ms since the epoch. */
  lastUpdated: number;
  monitored: boolean;
};

export type KioskSnapshot = { fetchedAt: number; vehicles: KioskVehicle[] };

/**
 * The two latest snapshots, so a vehicle can be compared with itself, and the
 * filter's maxDataAge, which the snapshot query does not take.
 */
export type CandidatePool = {
  current: KioskSnapshot | null;
  previous: KioskSnapshot | null;
  maxDataAgeSeconds: number;
};

/** A record from the kiosk's snapshot query (`useKioskCandidates`). */
export type SnapshotVehicle = {
  vehicleId: string;
  serviceJourney: { id: string; date: string };
  codespace: { codespaceId: string } | null;
  mode: VehicleModeEnumeration;
  /** Null for whole codespaces, despite the schema. */
  line: { publicCode: string | null } | null;
  destinationName: string | null;
  lastUpdated: string;
  monitored: boolean | null;
  location: { latitude: number; longitude: number } | null;
};

export function vehicleKey(vehicleId: string, serviceJourneyId: string) {
  return vehicleId + "_" + serviceJourneyId;
}

function isUsableLocation(lon: number, lat: number) {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lon === 0 && lat === 0)
  );
}

/** The record as a `KioskVehicle`, or null when it has nowhere to fly to. */
export function toKioskVehicle(raw: SnapshotVehicle): KioskVehicle | null {
  const lastUpdated = Date.parse(raw.lastUpdated);
  if (!raw.location || Number.isNaN(lastUpdated)) return null;
  const { longitude: lon, latitude: lat } = raw.location;
  if (!isUsableLocation(lon, lat)) return null;
  return {
    key: vehicleKey(raw.vehicleId, raw.serviceJourney.id),
    vehicleId: raw.vehicleId,
    serviceJourneyId: raw.serviceJourney.id,
    date: raw.serviceJourney.date,
    codespaceId: raw.codespace?.codespaceId ?? null,
    mode: raw.mode,
    lineCode: raw.line?.publicCode ?? "",
    destinationName: raw.destinationName,
    lon,
    lat,
    lastUpdated,
    monitored: raw.monitored === true,
  };
}

/**
 * The filter's maxDataAge in seconds. A filter read from the URL carries it
 * as a string, so it is converted rather than trusted.
 */
export function maxDataAgeSecondsOf(filter: Partial<Filter>): number {
  const value = Number(filter.maxDataAge);
  return value > 0 ? value : DEFAULT_MAX_DATA_AGE_SECONDS;
}

/** Worth watching: monitored, reporting often, and moving. */
export function isGoodCandidate(
  vehicle: KioskVehicle,
  previous: Map<string, KioskVehicle> | null,
  fetchedAt: number,
): boolean {
  if (!vehicle.monitored) return false;
  if (fetchedAt - vehicle.lastUpdated > FRESH_REPORT_MS) return false;
  const before = previous?.get(vehicle.key);
  if (!before) return false;
  return distanceMetres(before, vehicle) >= MIN_MOVE_METRES;
}

/**
 * Publishes a line code. About a third of the feed does not — whole
 * codespaces, which send no destination either — and the caption is then
 * only a codespace.
 */
export function hasLineCode(vehicle: KioskVehicle): boolean {
  return vehicle.lineCode !== "";
}

/**
 * The next vehicle to chase, at random from the first non-empty narrowing of
 * the eligible vehicles: not picked recently, then publishing a line code,
 * then good. Else null. A line code comes before moving because a caption
 * without one tells a passer-by nothing. `random` is in [0, 1), passed in so
 * tests are deterministic.
 *
 * Eligibility is maxDataAge measured at the snapshot's own fetch, not at the
 * pick: the snapshot is polled every 60 s and maxDataAge defaults to 30 s, so
 * measured against the pick's clock half of all picks would find nothing.
 */
export function pickCandidate(
  pool: CandidatePool,
  recent: readonly string[],
  random: number,
): KioskVehicle | null {
  const { current, previous, maxDataAgeSeconds } = pool;
  if (!current) return null;
  const eligible = current.vehicles.filter(
    (v) => current.fetchedAt - v.lastUpdated <= maxDataAgeSeconds * 1000,
  );
  const unseen = eligible.filter((v) => !recent.includes(v.key));
  const fresh = unseen.length > 0 ? unseen : eligible;
  const labelled = fresh.filter(hasLineCode);
  const captioned = labelled.length > 0 ? labelled : fresh;
  const before = previous
    ? new Map(previous.vehicles.map((v) => [v.key, v]))
    : null;
  const good = captioned.filter((v) =>
    isGoodCandidate(v, before, current.fetchedAt),
  );
  const from = good.length > 0 ? good : captioned;
  if (from.length === 0) return null;
  return from[Math.min(from.length - 1, Math.floor(random * from.length))];
}
