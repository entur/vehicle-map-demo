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

  // Built over the filtered set only. Both consumers want the same set: the
  // map layers draw these features, and the panel's "not on the map" list is
  // the leftover — the situations the user is currently looking at that the
  // map cannot show. Deriving that list from the whole feed instead would let
  // it contradict every other control in the panel, listing situations from
  // codespaces the map filter has excluded.
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
