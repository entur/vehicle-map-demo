import { request } from "graphql-request";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";
import { BatchResolver, useBorrowedGeometry } from "./useBorrowedGeometry.ts";

/** Line refs per request. Aliases keep this to one round trip per batch. */
const BATCH_SIZE = 10;

type PointsOnLink = { length: number | null; points: string | null } | null;
type VehicleRow = { serviceJourney: { pointsOnLink: PointsOnLink } | null };
type BatchResponse = Record<string, VehicleRow[] | null>;

/**
 * Line refs contain colons, which are not valid in a GraphQL alias, so the
 * aliases are positional (`l0`, `l1`, …) and mapped back by index.
 */
function buildBatchQuery(refs: string[]): string {
  const variables = refs.map((_, index) => `$l${index}: String!`).join(", ");
  const fields = refs
    .map(
      (_, index) =>
        `l${index}: vehicles(lineRef: $l${index}, includeInvalidLocations: true) { serviceJourney { pointsOnLink { length points } } }`,
    )
    .join("\n    ");
  return `query(${variables}) {\n    ${fields}\n  }`;
}

/** The longest polyline among the vehicles running this line, or null if none carry one. */
function longestPolyline(rows: VehicleRow[] | null): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const row of rows ?? []) {
    const points = row.serviceJourney?.pointsOnLink?.points;
    if (!points) continue;
    const length = row.serviceJourney?.pointsOnLink?.length ?? points.length;
    if (length > bestLength) {
      bestLength = length;
      best = points;
    }
  }
  return best;
}

const resolveLines: BatchResolver = async (
  refs,
  { url, requestHeaders, signal },
) => {
  const variables = Object.fromEntries(
    refs.map((ref, index) => [`l${index}`, ref]),
  );
  const response = await request<BatchResponse>({
    url,
    document: buildBatchQuery(refs),
    variables,
    requestHeaders,
    signal,
  });
  return new Map(
    refs.map((ref, index) => [
      ref,
      longestPolyline(response[`l${index}`] ?? null),
    ]),
  );
};

/**
 * Resolves each affected line to a shape by borrowing it from a journey running
 * on that line right now. The API exposes no geometry on `Line` itself, so this
 * is the route available for lines within this API. (Journeys are different —
 * see useSituationJourneyGeometry.)
 *
 * Coverage on dev is 31% of vehicles, so most refs end up cached as "asked,
 * none available"; see useBorrowedGeometry for why they are not retried.
 */
export function useSituationLineGeometry(
  lineRefs: string[],
): LineGeometryCache {
  return useBorrowedGeometry(
    lineRefs,
    resolveLines,
    BATCH_SIZE,
    decodePolyline,
  );
}
