import { request } from "graphql-request";
import { useEffect, useRef, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";

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

/**
 * Resolves each affected line to a shape by borrowing it from a journey running
 * on that line right now. The API exposes no geometry on `Line` itself and the
 * situations' own service-journey IDs resolve to nothing, so this is the only
 * route available within this API.
 *
 * A ref that yields nothing is cached as an empty array — "asked, none
 * available" — and is not retried for the rest of the session. That trades a
 * line whose first vehicle appears later for not re-requesting 80-odd refs on
 * every frame; coverage on dev is 31% of vehicles, so most refs are in that
 * state and retrying them would dominate the request budget.
 */
export function useSituationLineGeometry(
  lineRefs: string[],
): LineGeometryCache {
  const cache = useRef<Map<string, number[][]>>(new Map());
  // eslint-disable-next-line react-hooks/refs
  const [geometry, setGeometry] = useState<LineGeometryCache>(cache.current);

  const config = useConfig();
  const requestHeaders = useRequestHeaders();

  // Depend on the content, not the array identity: the caller rebuilds this
  // array on every frame and an identity dependency would refetch endlessly.
  const key = lineRefs.join(",");

  useEffect(() => {
    const pending = lineRefs.filter((ref) => !cache.current.has(ref));
    if (pending.length === 0) return;

    const controller = new AbortController();

    const fetchBatches = async () => {
      for (let start = 0; start < pending.length; start += BATCH_SIZE) {
        try {
          const batch = pending.slice(start, start + BATCH_SIZE);
          const variables = Object.fromEntries(
            batch.map((ref, index) => [`l${index}`, ref]),
          );

          const response = await request<BatchResponse>({
            url: config["vehicle-positions-graphql-endpoint"],
            document: buildBatchQuery(batch),
            variables,
            requestHeaders,
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          batch.forEach((ref, index) => {
            const points = longestPolyline(response[`l${index}`] ?? null);
            cache.current.set(ref, points ? decodePolyline(points) : []);
          });

          setGeometry(new Map(cache.current));
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error(
            `Failed to fetch situation line geometry batch starting at index ${start}:`,
            err,
          );
          continue;
        }
      }
    };

    fetchBatches().catch((err) => {
      if (controller.signal.aborted) return;
      console.error("Unexpected error in situation line geometry fetch:", err);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, config, requestHeaders]);

  return geometry;
}
