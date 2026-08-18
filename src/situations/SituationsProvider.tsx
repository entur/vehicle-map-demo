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
import { SituationsContext } from "./SituationsContext.ts";

export function SituationsProvider({
  children,
  codespaceId,
}: {
  children: ReactNode;
  codespaceId?: string;
}) {
  const feed = useSituationsSubscription();
  const [filter, setFilter] = useState<SituationFilter>(EMPTY_SITUATION_FILTER);
  const [selected, setSelected] = useState<string | null>(null);

  const flagsBySituation = useMemo(() => {
    // `Date.now()` here is genuinely impure — `react-hooks/purity` is right
    // that this memo body is not idempotent for a given render. Accepted
    // deliberately rather than routed through an effect+state pair: the
    // flags computed below (`noEndTime`, `staleOpenEnded`, `notYetActive`)
    // are defined relative to "the current instant", so there is no pure
    // value to substitute for `now` — the impurity is the point, not a
    // side effect to be moved elsewhere. Its consequence is bounded to
    // nothing a user could observe: this memo only re-runs when
    // `feed.situations` changes, and the thresholds it compares against
    // are day-scale (`STALE_OPEN_ENDED_DAYS` = 90) or at least
    // minutes-to-hours away (validity-period start times), so a
    // millisecond-scale difference in "now" between two recomputes (e.g.
    // a Strict Mode double-invoke) can never flip a flag. An effect that
    // reads the clock and stores it via `useState` would satisfy the rule
    // but would change actual behavior: `feed.situations` changing would
    // first re-render with the *previous* `now` (computed on a prior,
    // unrelated frame) before the effect fires and triggers a second
    // render with a fresh one — trading a harmless lint violation for a
    // real extra render on every situations update, for no behavioral
    // benefit.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return new Map<string, SituationFlag[]>(
      feed.situations.map((situation) => [
        situation.situationNumber,
        situationFlags(situation, now),
      ]),
    );
  }, [feed.situations]);

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
    () =>
      applySituationFilter(
        feed.situations,
        filter,
        flagsBySituation,
        codespaceId ?? null,
      ),
    [feed.situations, filter, flagsBySituation, codespaceId],
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
