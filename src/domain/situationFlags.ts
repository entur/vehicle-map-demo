import { NationalSituation } from "../types.ts";

export type SituationFlag = "noEndTime" | "staleOpenEnded" | "notYetActive";

export type FlagLevel = "info" | "warning";

/**
 * A single time-related field is never a warning on its own — an open-ended or
 * not-yet-started validity period is a normal state for a served situation.
 * `staleOpenEnded` is a warning precisely because it is a conjunction: published
 * without an end, and then never retired.
 */
export const FLAG_LEVEL: Record<SituationFlag, FlagLevel> = {
  noEndTime: "info",
  staleOpenEnded: "warning",
  notYetActive: "info",
};

/**
 * The flags offered as filter facets. `notYetActive` is deliberately absent: a
 * situation that has not started yet is still relevant to someone planning
 * ahead, so the panel should not invite you to slice it away. It stays in
 * `FLAG_LEVEL` because rows and the detail view still badge it — "starts later"
 * is worth seeing, just not worth filtering on.
 */
export const FILTERABLE_FLAGS: SituationFlag[] = [
  "noEndTime",
  "staleOpenEnded",
];

export const STALE_OPEN_ENDED_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function timestamp(iso: string | null): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

/**
 * The three lifecycle flags, computed for one situation against a caller-supplied
 * `now` so the result is deterministic and testable.
 *
 * `noEndTime` fires when *any* period lacks an end time. On the live feed no
 * situation carries more than one period, so this currently coincides exactly
 * with the server's own `openEnded` field — but the two are computed
 * independently and a multi-period situation would separate them.
 */
export function situationFlags(
  situation: NationalSituation,
  now: number,
): SituationFlag[] {
  const periods = situation.validityPeriods ?? [];
  if (periods.length === 0) return [];

  const flags: SituationFlag[] = [];

  const noEndTime = periods.some((period) => !period.endTime);
  if (noEndTime) flags.push("noEndTime");

  const created = timestamp(situation.creationTime);
  if (
    noEndTime &&
    created !== null &&
    now - created > STALE_OPEN_ENDED_DAYS * DAY_MS
  ) {
    flags.push("staleOpenEnded");
  }

  const starts = periods.map((period) => timestamp(period.startTime));
  if (starts.every((start) => start !== null && start > now)) {
    flags.push("notYetActive");
  }

  return flags;
}
