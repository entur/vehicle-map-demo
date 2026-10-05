import { NationalSituation, TranslatedString } from "../types.ts";

export type CountEntry = { value: string; count: number };

/** The bucket label `countBy` uses for a null key — also selectable as a facet value. */
export const NONE = "(none)";

/** Fixed order, so a shape string is comparable across situations. */
const AFFECTS_KINDS = [
  "affectedLines",
  "vehicleJourneys",
  "stopPoints",
  "stopPlaces",
  "operators",
] as const;

/**
 * Counts by a key, descending, ties broken alphabetically so the tables do not
 * reshuffle between frames. A null key becomes an explicit `(none)` bucket
 * rather than being dropped, so every table reconciles with the total.
 */
export function countBy<T>(
  items: T[],
  key: (item: T) => string | null,
): CountEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item) ?? NONE;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Counts by a key over `subset`, but offering every value present in `all` —
 * so a value the subset lacks stays listed at zero rather than vanishing. That
 * absence is itself information: "this codespace publishes nothing severe" is
 * only visible if the chip survives.
 *
 * Order comes from `compare`, applied to the values, defaulting to
 * alphabetical. Deliberately not by count: these entries label filter chips,
 * and chips that reshuffle whenever a count changes are hard to aim at. `NONE`
 * always sorts last — it is the absence of a value rather than one of them.
 */
export function countByWithin<T>(
  all: T[],
  subset: T[],
  key: (item: T) => string | null,
  compare: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
): CountEntry[] {
  const counts = new Map<string, number>();
  for (const item of all) counts.set(key(item) ?? NONE, 0);
  for (const item of subset) {
    const value = key(item) ?? NONE;
    // Guard rather than assume: a subset that is not a subset would otherwise
    // introduce a value `all` never had.
    if (counts.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.value === NONE) return b.value === NONE ? 0 : 1;
      if (b.value === NONE) return -1;
      return compare(a.value, b.value);
    });
}

/** Which affects kinds a situation populates, e.g. `affectedLines+vehicleJourneys`. */
export function affectsShape(situation: NationalSituation): string {
  const affects = situation.affects;
  if (!affects) return "(empty)";
  const present = AFFECTS_KINDS.filter(
    (kind) => (affects[kind] ?? []).length > 0,
  );
  return present.length ? present.join("+") : "(empty)";
}

/**
 * The set of language tags on a text, as a single sortable label. `untagged`
 * covers the very common single-variant case where the feed omits `language`
 * entirely — legitimate, but worth counting.
 */
function languageLabel(strings: TranslatedString[] | null): string {
  const entries = strings ?? [];
  if (entries.length === 0) return "(absent)";
  const tags = entries.map(
    (entry) => entry.language?.toUpperCase() ?? "untagged",
  );
  return [...new Set(tags)].sort().join("+");
}

export type SituationStats = {
  bySeverity: CountEntry[];
  byReportType: CountEntry[];
  byCodespace: CountEntry[];
  byAffectsShape: CountEntry[];
  summaryLanguages: CountEntry[];
  descriptionLanguages: CountEntry[];
};

/** Always computed over the unfiltered set, so the readouts do not move as the user narrows. */
export function situationStats(
  situations: NationalSituation[],
): SituationStats {
  return {
    bySeverity: countBy(situations, (s) => s.severity),
    byReportType: countBy(situations, (s) => s.reportType),
    byCodespace: countBy(situations, (s) => s.codespace?.codespaceId ?? null),
    byAffectsShape: countBy(situations, affectsShape),
    summaryLanguages: countBy(situations, (s) => languageLabel(s.summary)),
    descriptionLanguages: countBy(situations, (s) =>
      languageLabel(s.description),
    ),
  };
}
