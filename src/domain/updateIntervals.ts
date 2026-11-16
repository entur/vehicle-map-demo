import { Filter, VehicleUpdate } from "../types.ts";

/**
 * How often vehicles actually report, measured on the client as the gap
 * between consecutive `lastUpdated` values received for one vehicle on one
 * journey (the cache key's identity).
 *
 * Deliberately not data age (`now - lastUpdated`): that is capped by
 * `maxDataAge`, so a vehicle reporting every 60 s is evicted after 30 s by
 * default and was never counted as slow. Records here outlive the vehicle
 * cache, so such a vehicle reappearing yields its true interval.
 */
export type IntervalRecord = {
  lastReportMs: number;
  /** Most recent intervals in seconds, oldest first, at most `KEEP`. */
  intervals: number[];
  codespaceId: string | null;
  operatorRef: string | null;
  /** Position at the last report, [longitude, latitude]. */
  location: [number, number] | null;
};

export type IntervalRecords = Map<string, IntervalRecord>;

const KEEP = 5;
/** A vehicle silent for this long is forgotten. */
export const FORGET_AFTER_MS = 10 * 60 * 1000;
/**
 * A gap this long is a vehicle that left the view (or the subscription was
 * closed) and came back, not a reporting interval.
 */
export const MAX_INTERVAL_S = FORGET_AFTER_MS / 1000;

export function recordReports(
  records: IntervalRecords,
  vehicles: readonly VehicleUpdate[],
  nowMs: number,
): void {
  for (const vehicle of vehicles) {
    const reportMs = Date.parse(vehicle.lastUpdated);
    if (Number.isNaN(reportMs)) continue;
    const key = vehicle.vehicleId + "_" + vehicle.serviceJourney.id;
    const record = records.get(key);
    if (!record) {
      records.set(key, {
        lastReportMs: reportMs,
        intervals: [],
        codespaceId: null,
        operatorRef: null,
        location: null,
      });
      describe(records.get(key)!, vehicle);
      continue;
    }
    // Every frame carries every cached vehicle, and a re-opened subscription
    // resends what it has: the same report again is not an interval.
    if (reportMs <= record.lastReportMs) continue;
    const seconds = (reportMs - record.lastReportMs) / 1000;
    record.lastReportMs = reportMs;
    describe(record, vehicle);
    if (seconds > MAX_INTERVAL_S) continue;
    record.intervals.push(seconds);
    if (record.intervals.length > KEEP) record.intervals.shift();
  }
  for (const [key, record] of records) {
    if (nowMs - record.lastReportMs > FORGET_AFTER_MS) records.delete(key);
  }
}

function describe(record: IntervalRecord, vehicle: VehicleUpdate): void {
  record.codespaceId = vehicle.codespace?.codespaceId ?? null;
  record.operatorRef = vehicle.operator?.operatorRef ?? null;
  const { latitude, longitude } = vehicle.location ?? {};
  record.location =
    latitude != null && longitude != null ? [longitude, latitude] : null;
}

/**
 * The records the map's filter would show, by the same rule as the vehicle
 * hook's client-side filter: codespace, operator and bounding box (by the
 * position at the last report). Records outlive the cache, so without this a
 * codespace selected or a pan made in the last ten minutes would still count
 * vehicles the map no longer shows.
 */
export function recordsMatching(
  records: IntervalRecords,
  filter: Filter | null | undefined,
): IntervalRecord[] {
  const all = [...records.values()];
  if (!filter) return all;
  const box = filter.boundingBox;
  return all.filter((record) => {
    if (filter.codespaceId && record.codespaceId !== filter.codespaceId)
      return false;
    if (filter.operatorRef && record.operatorRef !== filter.operatorRef)
      return false;
    if (box) {
      if (!record.location) return false;
      const [lon, lat] = record.location;
      if (!(
        lat > box[0][1] &&
        lat < box[1][1] &&
        lon > box[0][0] &&
        lon < box[1][0]
      ))
        return false;
    }
    return true;
  });
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A vehicle's interval is the median of its recent ones, so one gap from
 * leaving and re-entering the view does not move it to another bucket.
 * Null until the vehicle has reported twice.
 */
export function typicalInterval(record: IntervalRecord): number | null {
  return record.intervals.length ? median(record.intervals) : null;
}

export type IntervalBucket = { label: string; min: number; max: number };

/** Edges chosen around the cadences the feed is known to use: a few
 * seconds, about 20 s and about 60 s. */
export const INTERVAL_BUCKETS: readonly IntervalBucket[] = [
  { label: "< 2 s", min: 0, max: 2 },
  { label: "2–5 s", min: 2, max: 5 },
  { label: "5–10 s", min: 5, max: 10 },
  { label: "10–20 s", min: 10, max: 20 },
  { label: "20–40 s", min: 20, max: 40 },
  { label: "40–70 s", min: 40, max: 70 },
  { label: "≥ 70 s", min: 70, max: Infinity },
];

export function bucketIndex(seconds: number): number {
  return INTERVAL_BUCKETS.findIndex((b) => seconds >= b.min && seconds < b.max);
}

export type IntervalHistogram = {
  counts: number[];
  /** Vehicles seen once so far, so without an interval. */
  pending: number;
};

export function intervalHistogram(
  records: Iterable<IntervalRecord>,
): IntervalHistogram {
  const counts = INTERVAL_BUCKETS.map(() => 0);
  let pending = 0;
  for (const record of records) {
    const interval = typicalInterval(record);
    if (interval === null) pending++;
    else counts[bucketIndex(interval)]++;
  }
  return { counts, pending };
}

export type CodespaceIntervalRow = {
  codespaceId: string;
  vehicles: number;
  medianSeconds: number;
};

/** Median of the vehicles' typical intervals, per codespace, largest first.
 * Vehicles without an interval yet are left out. */
export function intervalsByCodespace(
  records: Iterable<IntervalRecord>,
): CodespaceIntervalRow[] {
  const groups = new Map<string, number[]>();
  for (const record of records) {
    const interval = typicalInterval(record);
    if (interval === null) continue;
    const id = record.codespaceId ?? "(none)";
    const group = groups.get(id) ?? [];
    group.push(interval);
    groups.set(id, group);
  }
  return [...groups]
    .map(([codespaceId, intervals]) => ({
      codespaceId,
      vehicles: intervals.length,
      medianSeconds: median(intervals),
    }))
    .sort(
      (a, b) =>
        b.vehicles - a.vehicles || a.codespaceId.localeCompare(b.codespaceId),
    );
}
