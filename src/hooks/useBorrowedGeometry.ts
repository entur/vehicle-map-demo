import { useEffect, useRef, useState } from "react";
import { useConfig } from "../config/ConfigContext.ts";
import { LineGeometryCache } from "../domain/situationFeatures.ts";
import { useRequestHeaders } from "./useRequestHeaders.ts";

/** Resolves one batch of refs to encoded polylines; a missing key or null means "none available". */
export type BatchResolver = (
  refs: string[],
  context: {
    url: string;
    requestHeaders: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Map<string, string | null>>;

/**
 * Session cache of decoded geometry per ref, filled by `resolve` in batches.
 *
 * A ref that yields nothing is cached as an empty array — "asked, none
 * available" — and is not retried for the rest of the session. For lines that
 * trades a line whose first vehicle appears later for not re-requesting 80-odd
 * refs on every frame; for journeys the answer is static planned data, so
 * there is nothing to retry for.
 */
export function useBorrowedGeometry(
  refs: string[],
  resolve: BatchResolver,
  batchSize: number,
  decode: (points: string) => number[][],
): LineGeometryCache {
  const cache = useRef<Map<string, number[][]>>(new Map());
  // eslint-disable-next-line react-hooks/refs
  const [geometry, setGeometry] = useState<LineGeometryCache>(cache.current);

  const config = useConfig();
  const requestHeaders = useRequestHeaders();

  // Depend on the content, not the array identity: callers rebuild this array
  // on every frame and an identity dependency would refetch endlessly.
  const key = refs.join(",");

  useEffect(() => {
    const pending = refs.filter((ref) => !cache.current.has(ref));
    if (pending.length === 0) return;

    const controller = new AbortController();
    const url = config["vehicle-positions-graphql-endpoint"];

    const fetchBatches = async () => {
      for (let start = 0; start < pending.length; start += batchSize) {
        const batch = pending.slice(start, start + batchSize);
        try {
          const resolved = await resolve(batch, {
            url,
            requestHeaders,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;

          for (const ref of batch) {
            const points = resolved.get(ref) ?? null;
            cache.current.set(ref, points ? decode(points) : []);
          }
          setGeometry(new Map(cache.current));
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error(
            `Failed to fetch situation geometry batch starting at index ${start}:`,
            err,
          );
        }
      }
    };

    fetchBatches().catch((err) => {
      if (controller.signal.aborted) return;
      console.error("Unexpected error in situation geometry fetch:", err);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, config, requestHeaders, resolve, batchSize, decode]);

  return geometry;
}
