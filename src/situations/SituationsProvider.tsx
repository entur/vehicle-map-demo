import { ReactNode, useMemo, useState } from "react";
import {
  buildSituationFeatures,
  collectLineRefs,
} from "../domain/situationFeatures.ts";
import {
  EMPTY_SITUATION_FILTER,
  SituationFilter,
  applySituationFilter,
  facetCounts,
} from "../domain/situationFilter.ts";
import { SituationFlag, situationFlags } from "../domain/situationFlags.ts";
import { situationStats } from "../domain/situationStats.ts";
import { useSituationLineGeometry } from "../hooks/useSituationLineGeometry.ts";
import { useSituationsSubscription } from "../hooks/useSituationsSubscription.ts";
import { NationalSituation } from "../types.ts";
import { SituationsContext } from "./SituationsContext.ts";

/**
 * `Date.now()` lives here, outside the `useMemo` callback that calls this: the
 * `react-hooks/purity` rule flags an impure call written directly in a memo
 * body, even though re-reading the clock on every recompute is exactly the
 * intent (flags like `staleOpenEnded` are relative to "now"). Matches the
 * existing pattern in InfoBox's `getUpdateFrequencyCounts`.
 */
function buildFlagsBySituation(
  situations: NationalSituation[],
): Map<string, SituationFlag[]> {
  const now = Date.now();
  return new Map<string, SituationFlag[]>(
    situations.map((situation) => [
      situation.situationNumber,
      situationFlags(situation, now),
    ]),
  );
}

export function SituationsProvider({ children }: { children: ReactNode }) {
  const feed = useSituationsSubscription();
  const [filter, setFilter] = useState<SituationFilter>(EMPTY_SITUATION_FILTER);
  const [selected, setSelected] = useState<string | null>(null);

  const flagsBySituation = useMemo(
    () => buildFlagsBySituation(feed.situations),
    [feed.situations],
  );

  const lineRefs = useMemo(
    () => collectLineRefs(feed.situations),
    [feed.situations],
  );
  const lineGeometry = useSituationLineGeometry(lineRefs);

  // Built twice, over different sets and for different consumers: once over
  // everything, only to learn which situations have no map presence at all;
  // once over the filtered set, to feed the map layers.
  const allFeatures = useMemo(
    () => buildSituationFeatures(feed.situations, lineGeometry),
    [feed.situations, lineGeometry],
  );

  const filtered = useMemo(
    () => applySituationFilter(feed.situations, filter, flagsBySituation),
    [feed.situations, filter, flagsBySituation],
  );

  const features = useMemo(
    () => buildSituationFeatures(filtered, lineGeometry),
    [filtered, lineGeometry],
  );

  const stats = useMemo(
    () => situationStats(feed.situations),
    [feed.situations],
  );

  const facets = useMemo(
    () => facetCounts(feed.situations, flagsBySituation),
    [feed.situations, flagsBySituation],
  );

  const value = useMemo(
    () => ({
      feed,
      flagsBySituation,
      filter,
      setFilter,
      filtered,
      features,
      unmappable: allFeatures.unmappable,
      stats,
      facets,
      selected,
      setSelected,
    }),
    [
      feed,
      flagsBySituation,
      filter,
      filtered,
      features,
      allFeatures,
      stats,
      facets,
      selected,
    ],
  );

  return (
    <SituationsContext.Provider value={value}>
      {children}
    </SituationsContext.Provider>
  );
}
