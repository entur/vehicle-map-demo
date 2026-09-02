import { request } from "graphql-request";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";
import {
  JourneyBatchResponse,
  journeyPolylines,
  splitJourneyIds,
} from "./journeyBatch.ts";
import { BatchResolver, useBorrowedGeometry } from "./useBorrowedGeometry.ts";

/**
 * Journey ids per request. Both roots take the whole batch as a list, so this
 * is bounded by taste rather than by aliasing; the whole dev feed's resolvable
 * ids (33) fit in one request today.
 */
const BATCH_SIZE = 100;

/**
 * One request, two roots — see journeyBatch.ts for why the batch is split.
 * `pointsOnLink` is hidden from introspection on `ServiceJourney`, exactly
 * like the `situations` root; it validates and resolves normally.
 */
const BATCH_QUERY = `query($dated: [String!]!, $undated: [String!]!) {
  datedServiceJourneys(ids: $dated) { id serviceJourney { pointsOnLink { points } } }
  serviceJourneys(ids: $undated) { id pointsOnLink { points } }
}`;

const resolveJourneys: BatchResolver = async (
  ids,
  { url, requestHeaders, signal },
) => {
  const response = await request<JourneyBatchResponse>({
    url,
    document: BATCH_QUERY,
    variables: splitJourneyIds(ids),
    requestHeaders,
    signal,
  });
  return journeyPolylines(response);
};

/**
 * Resolves each affected dated service journey to its planned shape. Unlike
 * lines, this is static planned data: no vehicle needs to be running the
 * journey. Both id forms the feed publishes resolve — `ATB:ServiceJourney:…`
 * and `VYG:DatedServiceJourney:…_26-09-02` — as long as the journey's day is
 * not already past; callers pre-filter with `mayResolveJourney` so the
 * thousands of stale ids never become requests.
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
