import { NationalSituation, SeverityEnumeration } from "../types.ts";
import { SEVERITY_RANK } from "../components/SelectedVehiclePanel/situationSeverity.ts";
import { CountEntry, NONE, countByWithin } from "./situationStats.ts";
import { FILTERABLE_FLAGS, SituationFlag } from "./situationFlags.ts";

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
export function matchesCodespace(
  situation: NationalSituation,
  codespaceId: string | null,
): boolean {
  if (!codespaceId) return true;
  return situation.codespace?.codespaceId === codespaceId;
}

export function applySituationFilter(
  situations: NationalSituation[],
  filter: SituationFilter,
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
  codespaceId: string | null,
): NationalSituation[] {
  return situations.filter((situation) => {
    if (!matchesCodespace(situation, codespaceId)) return false;
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

/**
 * Counts for the filter controls.
 *
 * `all` is the whole feed and supplies the *set of values* offered, so a chip
 * never disappears as you narrow. `withinCodespace` is the feed narrowed by the
 * map's codespace filter and supplies the *counts*.
 *
 * The split matters. Scoping to codespace is not circular — codespace is a
 * separate control, so severity counts within it stay meaningful. Scoping to
 * the panel's own facets would be: selecting "severe" would recompute severity
 * counts to `severe: N, everything else 0`, describing nothing but the click
 * that was just made. Never pass a set narrowed by `filter` here.
 *
 * Flags with a zero count are still listed, so a flag that should stay at zero
 * remains visible as a regression detector rather than silently disappearing.
 * Only `FILTERABLE_FLAGS` are offered — see that constant for why `notYetActive`
 * is not among them.
 */
const UNRATED = SEVERITY_RANK.unknown;

/**
 * Least to most serious. A value arriving from the wire outside the enum ranks
 * with `unknown` rather than sorting arbitrarily, matching `worstSeverity`.
 */
function compareSeverity(a: string, b: string): number {
  const rankA = SEVERITY_RANK[a as SeverityEnumeration] ?? UNRATED;
  const rankB = SEVERITY_RANK[b as SeverityEnumeration] ?? UNRATED;
  return rankA - rankB || a.localeCompare(b);
}

export function facetCounts(
  all: NationalSituation[],
  withinCodespace: NationalSituation[],
  flagsBySituation: ReadonlyMap<string, SituationFlag[]>,
): FacetCounts {
  const flagCounts = new Map<SituationFlag, number>(
    FILTERABLE_FLAGS.map((flag) => [flag, 0]),
  );
  for (const situation of withinCodespace) {
    for (const flag of flagsBySituation.get(situation.situationNumber) ?? []) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  return {
    severities: countByWithin(
      all,
      withinCodespace,
      (s) => s.severity,
      compareSeverity,
    ),
    reportTypes: countByWithin(all, withinCodespace, (s) => s.reportType),
    flags: FILTERABLE_FLAGS.map((flag) => ({
      value: flag,
      count: flagCounts.get(flag) ?? 0,
    })),
  };
}
