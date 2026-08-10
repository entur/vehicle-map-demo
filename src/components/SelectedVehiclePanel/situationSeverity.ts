import { SeverityEnumeration } from "../../types.ts";

const SEVERE = "#c0392b";
const NOTABLE = "#e07a1f";
const MUTED = "#999999";

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
      return SEVERE;
    case "noImpact":
      return MUTED;
    default:
      return NOTABLE;
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
// null does not lose to noImpact.
const UNRATED = 1;

function rank(severity: SeverityEnumeration | null): number {
  return severity ? SEVERITY_RANK[severity] : UNRATED;
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
