import { SeverityEnumeration } from "../../types.ts";

export const SEVERITY_SEVERE = "#c0392b";
export const SEVERITY_MUTED = "#999999";
export const SEVERITY_NOTABLE = "#e07a1f";

/**
 * Colour for a situation's severity marker.
 *
 * `undefined` maps to the same orange as `normal` rather than to grey: it is by
 * far the most common value in the live feed and those records are real
 * incident messages. Greying them would hide most of the data.
 */
export function severityColour(
  severity: SeverityEnumeration | null | undefined,
): string {
  switch (severity) {
    case "severe":
    case "verySevere":
      return SEVERITY_SEVERE;
    case "noImpact":
      return SEVERITY_MUTED;
    default:
      return SEVERITY_NOTABLE;
  }
}

const SEVERITY_RANK: Record<SeverityEnumeration, number> = {
  noImpact: 0,
  unknown: 1,
  undefined: 1,
  verySlight: 2,
  slight: 3,
  normal: 4,
  severe: 5,
  verySevere: 6,
};

// An absent severity ranks with `unknown`/`undefined` rather than lowest, so a
// null does not lose to noImpact. Derived from the table itself so retuning
// the table cannot let the two drift apart.
const UNRATED = SEVERITY_RANK.unknown;

function rank(severity: SeverityEnumeration | null): number {
  // The GraphQL enum is trusted, never validated, so a value arriving from
  // the wire outside the union looks up as `undefined` here — fall back to
  // UNRATED rather than letting it silently never win a comparison.
  return severity ? (SEVERITY_RANK[severity] ?? UNRATED) : UNRATED;
}

/**
 * The most serious severity in a group, so a stop row carrying several
 * situations is coloured by the worst of them rather than by the first.
 */
export function worstSeverity(
  situations: { severity: SeverityEnumeration | null }[],
): SeverityEnumeration | null {
  let worst: SeverityEnumeration | null = null;
  let worstRank = -1;

  for (const situation of situations) {
    const current = rank(situation.severity);
    if (current > worstRank) {
      worstRank = current;
      worst = situation.severity;
    }
  }

  return worst;
}
