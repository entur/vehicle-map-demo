import { NationalSituation } from "../types.ts";
import { CountEntry, countBy } from "./situationStats.ts";
import { FLAG_LEVEL, SituationFlag } from "./situationFlags.ts";

export type SituationFilter = {
  codespaces: string[];
  severities: string[];
  reportTypes: string[];
  flags: SituationFlag[];
};

export const EMPTY_SITUATION_FILTER: SituationFilter = {
  codespaces: [],
  severities: [],
  reportTypes: [],
  flags: [],
};

/**
 * An empty facet means "unconstrained". Within a facet the selected values are
 * ORed; across facets they are ANDed. A situation whose value for a constrained
 * facet is absent never matches — there is no selectable `(none)` facet, so a
 * null cannot be asked for.
 */
function matches(value: string | null, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return value !== null && selected.includes(value);
}

export function applySituationFilter(
  situations: NationalSituation[],
  filter: SituationFilter,
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
): NationalSituation[] {
  return situations.filter((situation) => {
    if (!matches(situation.codespace?.codespaceId ?? null, filter.codespaces))
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
  codespaces: CountEntry[];
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
    codespaces: countBy(situations, (s) => s.codespace?.codespaceId ?? null),
    severities: countBy(situations, (s) => s.severity),
    reportTypes: countBy(situations, (s) => s.reportType),
    flags: ALL_FLAGS.map((flag) => ({
      value: flag,
      count: flagCounts.get(flag) ?? 0,
    })),
  };
}
