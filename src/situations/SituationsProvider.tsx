import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  buildSituationFeatures,
  collectDatedServiceJourneyRefs,
  collectLineRefs,
} from "../domain/situationFeatures.ts";
import {
  EMPTY_SITUATION_FILTER,
  SituationFilter,
  applySituationFilter,
  facetCounts,
  matchesCodespace,
} from "../domain/situationFilter.ts";
import { SituationFlag, situationFlags } from "../domain/situationFlags.ts";
import { countBy, situationStats } from "../domain/situationStats.ts";
import { useSituationJourneyGeometry } from "../hooks/useSituationJourneyGeometry.ts";
import { useSituationLineGeometry } from "../hooks/useSituationLineGeometry.ts";
import { mayResolveJourney } from "../domain/journeyDate.ts";
import { useSituationsSubscription } from "../hooks/useSituationsSubscription.ts";
import { SituationsContext } from "./SituationsContext.ts";

export function SituationsProvider({
  children,
  codespaceId,
  enabled,
}: {
  children: ReactNode;
  codespaceId?: string;
  enabled: boolean;
}) {
  const feed = useSituationsSubscription(enabled);
  const [filter, setFilter] = useState<SituationFilter>(EMPTY_SITUATION_FILTER);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) setSelected(null);
  }, [enabled]);

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

  // Only the journeys the API can still resolve. "Today" is the UTC date: at
  // worst that runs a little behind local time, which keeps an id rather than
  // dropping one, and a journey the API turns out not to know is cached as
  // unavailable like any other miss.
  const journeyIds = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return collectDatedServiceJourneyRefs(feed.situations).filter((id) =>
      mayResolveJourney(id, today),
    );
  }, [feed.situations]);
  const journeyGeometry = useSituationJourneyGeometry(journeyIds);

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
    () => buildSituationFeatures(filtered, lineGeometry, journeyGeometry),
    [filtered, lineGeometry, journeyGeometry],
  );

  // The map's codespace filter alone — deliberately not `filtered`, which also
  // carries the panel's own facets. Counting within the codespace keeps the
  // readouts meaningful; counting within the facets would make each one
  // describe only the click that produced it.
  const withinCodespace = useMemo(
    () =>
      feed.situations.filter((situation) =>
        matchesCodespace(situation, codespaceId ?? null),
      ),
    [feed.situations, codespaceId],
  );

  // Scoped to the map's codespace filter, like the facet counts and like the
  // vehicles-mode Data report, which fetches its snapshot for one codespace.
  // Deliberately not narrowed by the panel's own facets: selecting `severe`
  // must not make the severity table read "severe: N, everything else 0".
  const stats = useMemo(
    () => situationStats(withinCodespace),
    [withinCodespace],
  );

  // The dropdown's own options, over the WHOLE feed and never scoped. Separate
  // from `stats.byCodespace`, which is scoped to the current codespace: deriving
  // the options from that collapsed the dropdown to the one codespace already
  // selected, leaving no way to switch to another.
  const feedCodespaceCounts = useMemo(
    () => countBy(feed.situations, (s) => s.codespace?.codespaceId ?? null),
    [feed.situations],
  );

  const facets = useMemo(
    () => facetCounts(feed.situations, withinCodespace, flagsBySituation),
    [feed.situations, withinCodespace, flagsBySituation],
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
      feedCodespaceCounts,
      statsScope: {
        codespaceId: codespaceId ?? null,
        count: withinCodespace.length,
        total: feed.situations.length,
      },
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
      feedCodespaceCounts,
      codespaceId,
      withinCodespace,
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
