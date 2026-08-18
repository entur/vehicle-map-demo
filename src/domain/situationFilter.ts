import { NationalSituation } from "../types.ts";
import { CountEntry, NONE, countBy } from "./situationStats.ts";
import { FLAG_LEVEL, SituationFlag } from "./situationFlags.ts";

export type SituationFilter = {
  severities: string[];
  reportTypes: string[];
  flags: SituationFlag[];
};

export const EMPTY_SITUATION_FILTER: SituationFilter = {
  severities: [],
  reportTypes: [],
  flags: [],
};

/**
 * An empty facet means "unconstrained". Within a facet the selected values are
 * ORed; across facets they are ANDed. `facetCounts` surfaces a `(none)` row for
 * situations whose value is absent, and that row is selectable like any other:
 * checking it asks for exactly the situations with a null value for this facet
 * — the anomalous ones a feed-debugging tool exists to find.
 */
function matches(value: string | null, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (value === null) return selected.includes(NONE);
  return selected.includes(value);
}

/**
 * `codespaceId` is the map's global codespace filter, not a panel facet: it
 * arrives from `Filter.codespaceId` rather than from `filter`, and it is a
 * single value because the control that sets it is a single-select. An empty
 * string is what the dropdown holds when nothing is chosen, so it means
 * unconstrained just as `null` does.
 *
 * The match is strict — a situation carrying no codespace at all drops out
 * whenever one is selected, rather than surviving as an unattributed match.
 * Those situations stay reachable by clearing the filter, and their count
 * remains visible in the stats table, which is computed over the whole feed.
 */
export function applySituationFilter(
  situations: NationalSituation[],
  filter: SituationFilter,
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
  codespaceId: string | null,
): NationalSituation[] {
  return situations.filter((situation) => {
    if (codespaceId && situation.codespace?.codespaceId !== codespaceId)
      return false;
    if (!matches(situation.severity, filter.severities)) return false;
    if (!matches(situation.reportType, filter.reportTypes)) return false;

    const flags = flagsBySituation.get(situation.situationNumber) ?? [];
    // Selected flags are ANDed: each one narrows further, so "stale AND
    // not-yet-active" asks for the intersection rather than the union.
    return filter.flags.every((flag) => flags.includes(flag));
  });
}

export type FacetCounts = {
  severities: CountEntry[];
  reportTypes: CountEntry[];
  flags: CountEntry[];
};

const ALL_FLAGS = Object.keys(FLAG_LEVEL) as SituationFlag[];

/**
 * Counts for the filter controls. Call this with the **unfiltered** set: the
 * counts are there to describe the data, and would be useless if they collapsed
 * to match whatever the user had already selected.
 *
 * Flags with a zero count are still listed, so a flag that should stay at zero
 * remains visible as a regression detector rather than silently disappearing.
 */
export function facetCounts(
  situations: NationalSituation[],
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
): FacetCounts {
  const flagCounts = new Map<SituationFlag, number>(
    ALL_FLAGS.map((flag) => [flag, 0]),
  );
  for (const situation of situations) {
    for (const flag of flagsBySituation.get(situation.situationNumber) ?? []) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  return {
    severities: countBy(situations, (s) => s.severity),
    reportTypes: countBy(situations, (s) => s.reportType),
    flags: ALL_FLAGS.map((flag) => ({
      value: flag,
      count: flagCounts.get(flag) ?? 0,
    })),
  };
}
