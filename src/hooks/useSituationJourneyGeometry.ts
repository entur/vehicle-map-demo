import { request } from "graphql-request";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";
import { BatchResolver, useBorrowedGeometry } from "./useBorrowedGeometry.ts";

/** Journey ids per request. Aliases keep this to one round trip per batch. */
const BATCH_SIZE = 25;

type JourneyRow = {
  pointsOnLink: { points: string | null } | null;
} | null;
type BatchResponse = Record<string, JourneyRow>;

/**
 * Ids contain colons, which are not valid in a GraphQL alias, so the aliases
 * are positional (`j0`, `j1`, …) and mapped back by index. This and
 * `resolveJourneys` are the only two places to change once the API gains a
 * `serviceJourneys(ids:)` root that takes the whole batch.
 *
 * `pointsOnLink` is hidden from introspection on `ServiceJourney`, exactly
 * like the `situations` root; it validates and resolves normally.
 */
function buildBatchQuery(ids: string[]): string {
  const variables = ids.map((_, index) => `$j${index}: String!`).join(", ");
  const fields = ids
    .map(
      (_, index) =>
        `j${index}: serviceJourney(id: $j${index}) { pointsOnLink { points } }`,
    )
    .join("\n    ");
  return `query(${variables}) {\n    ${fields}\n  }`;
}

const resolveJourneys: BatchResolver = async (
  ids,
  { url, requestHeaders, signal },
) => {
  const variables = Object.fromEntries(
    ids.map((id, index) => [`j${index}`, id]),
  );
  const response = await request<BatchResponse>({
    url,
    document: buildBatchQuery(ids),
    variables,
    requestHeaders,
    signal,
  });
  return new Map(
    ids.map((id, index) => [
      id,
      response[`j${index}`]?.pointsOnLink?.points ?? null,
    ]),
  );
};

/**
 * Resolves each affected dated service journey to its planned shape via
 * `serviceJourney(id:)`. Unlike lines, this is static planned data: no vehicle
 * needs to be running the journey. Both id forms the feed publishes resolve —
 * `ATB:ServiceJourney:…` and `VYG:DatedServiceJourney:…_26-09-02` — as long
 * as the journey's day is not already past; callers pre-filter with
 * `mayResolveJourney` so the thousands of stale ids never become requests.
 */
export function useSituationJourneyGeometry(
  journeyIds: string[],
): LineGeometryCache {
  return useBorrowedGeometry(
    journeyIds,
    resolveJourneys,
    BATCH_SIZE,
    decodePolyline,
  );
}
