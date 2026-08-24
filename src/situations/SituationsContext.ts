import React, { useContext } from "react";
import { SituationsFeed } from "../hooks/useSituationsSubscription.ts";
import { SituationFeatures } from "../domain/situationFeatures.ts";
import { FacetCounts, SituationFilter } from "../domain/situationFilter.ts";
import { SituationFlag } from "../domain/situationFlags.ts";
import { SituationStats } from "../domain/situationStats.ts";
import { NationalSituation } from "../types.ts";

export type SituationsContextValue = {
  feed: SituationsFeed;
  /** Flags for every situation in the unfiltered set. */
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>;
  filter: SituationFilter;
  setFilter: (filter: SituationFilter) => void;
  /** The subset the user is currently looking at. */
  filtered: NationalSituation[];
  /**
   * Features built over `filtered` — what the map draws, plus the
   * `unmappable` remainder the "not on the map" list shows. Both follow the
   * filter, so the map and the panel can never disagree about which
   * situations are in play.
   */
  features: SituationFeatures;
  /** Computed over the unfiltered set, so the readouts stay still as the user narrows. */
  stats: SituationStats;
  facets: FacetCounts;
  selected: string | null;
  /**
   * The full `useState` setter rather than a narrowed `(value) => void`, so
   * consumers can toggle with a functional update and keep their callback
   * identity independent of `selected` — which is what lets the memoized rows
   * skip re-rendering when the selection moves.
   */
  setSelected: React.Dispatch<React.SetStateAction<string | null>>;
};

export const SituationsContext =
  React.createContext<SituationsContextValue | null>(null);

export const useSituations = (): SituationsContextValue => {
  const value = useContext(SituationsContext);
  if (!value) {
    throw new Error("useSituations must be used inside a SituationsProvider");
  }
  return value;
};
