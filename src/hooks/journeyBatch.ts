/**
 * The pure halves of the journey resolver: how a batch of ids is split across
 * the API's two batch roots, and how their rows map back to the ids asked.
 *
 * Two roots because neither covers both id forms in a way that maps back.
 * `serviceJourneys(ids:)` resolves every form, but echoes the *service
 * journey* id — for `VYG:DatedServiceJourney:1013_ASR-HAG_26-09-03` it
 * returns `VYG:ServiceJourney:1013-ASR_585536-R` — and drops ids it cannot
 * resolve, so a dated request cannot be matched to its row by id or by
 * position. `datedServiceJourneys(ids:)` echoes the dated id as asked, but
 * returns nothing for ATB's undated `ATB:ServiceJourney:…` form.
 */

const DATED_MARKER = ":DatedServiceJourney:";

export type JourneyBatch = { dated: string[]; undated: string[] };

/** Ids in the dated form go to `datedServiceJourneys`, every other form to `serviceJourneys`. */
export function splitJourneyIds(ids: string[]): JourneyBatch {
  const dated: string[] = [];
  const undated: string[] = [];
  for (const id of ids) {
    (id.includes(DATED_MARKER) ? dated : undated).push(id);
  }
  return { dated, undated };
}

type PointsOnLink = { points: string | null } | null;

export type JourneyBatchResponse = {
  datedServiceJourneys:
    | { id: string; serviceJourney: { pointsOnLink: PointsOnLink } | null }[]
    | null;
  serviceJourneys: { id: string; pointsOnLink: PointsOnLink }[] | null;
};

/** Requested id → encoded polyline, for every row that carried one. */
export function journeyPolylines(
  response: JourneyBatchResponse,
): Map<string, string> {
  const polylines = new Map<string, string>();
  for (const row of response.datedServiceJourneys ?? []) {
    const points = row.serviceJourney?.pointsOnLink?.points;
    if (points) polylines.set(row.id, points);
  }
  for (const row of response.serviceJourneys ?? []) {
    const points = row.pointsOnLink?.points;
    if (points) polylines.set(row.id, points);
  }
  return polylines;
}
