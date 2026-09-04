import { FormattedExecutionResult } from "graphql-ws";
import { useEffect, useRef, useState } from "react";
import { NationalSituation } from "../types.ts";
import {
  SITUATION_FIELDS_FRAGMENT,
  SITUATION_QA_FIELDS_FRAGMENT,
} from "./situationFragments.ts";
import { useSubscriptionClient } from "./useSubscriptionClient.ts";

type SubscriptionData = {
  situations: NationalSituation[];
};

const subscriptionQuery = `
  ${SITUATION_FIELDS_FRAGMENT}
  ${SITUATION_QA_FIELDS_FRAGMENT}

  subscription {
    situations {
      ...SituationFields
      ...SituationQaFields
    }
  }
`;

/**
 * How long to wait for the opening snapshot before concluding the environment
 * simply has no situations. The live feed delivers its first frame in well
 * under a second; staging and prod deliver nothing at all.
 */
const EMPTY_AFTER_MS = 5000;

export type SituationsStatus = "connecting" | "live" | "empty" | "error";

export type SituationsFeed = {
  situations: NationalSituation[];
  status: SituationsStatus;
  /** Epoch ms of the most recent frame, or null before the first one. */
  lastUpdated: number | null;
};

/**
 * The national situations feed.
 *
 * The subscription is opened unfiltered — the whole set is under 600 items, and
 * the stats and facet counts have to be computed over all of it. Each frame
 * carries up to `bufferSize` situations; entries are keyed by `situationNumber`
 * and the latest one wins.
 *
 * There is deliberately no TTL and no CacheMap. Unlike vehicles, situations do
 * not go stale by age: the server retires them, and everything it serves has
 * `progress: open`.
 */
export function useSituationsSubscription(enabled: boolean): SituationsFeed {
  const [feed, setFeed] = useState<SituationsFeed>({
    situations: [],
    status: "connecting",
    lastUpdated: null,
  });

  const byNumber = useRef<Map<string, NationalSituation>>(new Map());
  const subscription = useRef<AsyncIterableIterator<
    FormattedExecutionResult<SubscriptionData, unknown>
  > | null>(null);

  const subscriptionClient = useSubscriptionClient();

  useEffect(() => {
    if (!enabled) {
      // Reset rather than freeze: the feed has no TTL, so keeping the last
      // frames would present a stale snapshot as live on returning.
      byNumber.current = new Map();
      setFeed({ situations: [], status: "connecting", lastUpdated: null });
      return;
    }

    byNumber.current = new Map();

    // A frame already resolved in the iterator's queue when `.return()` is
    // called in the cleanup below can still run one more loop iteration;
    // `cancelled` closes that hole so no data reaches state after disable.
    let cancelled = false;

    const emptyTimer = setTimeout(() => {
      setFeed((previous) =>
        previous.status === "connecting"
          ? { ...previous, status: "empty" }
          : previous,
      );
    }, EMPTY_AFTER_MS);

    subscription.current = subscriptionClient.iterate<SubscriptionData>({
      query: subscriptionQuery,
    });

    const subscribe = async () => {
      if (!subscription.current) return;
      for await (const event of subscription.current) {
        if (cancelled) break;
        const incoming = event?.data?.situations ?? [];
        if (incoming.length === 0) continue;

        clearTimeout(emptyTimer);
        for (const situation of incoming) {
          byNumber.current.set(situation.situationNumber, situation);
        }

        setFeed({
          situations: [...byNumber.current.values()].sort((a, b) =>
            a.situationNumber.localeCompare(b.situationNumber),
          ),
          status: "live",
          lastUpdated: Date.now(),
        });
      }
    };

    subscribe().catch((err) => {
      console.error("Situations subscription error:", err);
      // Keep whatever arrived — a dropped stream should not blank the panel.
      setFeed((previous) => ({ ...previous, status: "error" }));
    });

    return () => {
      cancelled = true;
      clearTimeout(emptyTimer);
      subscription.current?.return?.();
    };
  }, [subscriptionClient, enabled]);

  return feed;
}
