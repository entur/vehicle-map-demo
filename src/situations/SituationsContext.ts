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
  /** Features built over `filtered` — this is what the map draws. */
  features: SituationFeatures;
  /** Situation numbers with no map presence, over the **unfiltered** set. */
  unmappable: string[];
  /** Computed over the unfiltered set, so the readouts stay still as the user narrows. */
  stats: SituationStats;
  facets: FacetCounts;
  selected: string | null;
  setSelected: (situationNumber: string | null) => void;
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
