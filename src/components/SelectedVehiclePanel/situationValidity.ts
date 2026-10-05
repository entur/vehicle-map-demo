import { Situation } from "../../types.ts";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * One formatted "start – end" line per validity period on the situation, so a
 * situation carrying multiple windows shows all of them rather than only the
 * first — this is a feed-debugging tool and every window the feed published
 * is relevant. Periods without a `startTime` are skipped (there is nothing
 * useful to render); `null` is returned when no period survives that filter.
 */
export function formatValidity(situation: Situation): string[] | null {
  const periods = situation.validityPeriods ?? [];

  const lines: string[] = [];
  for (const period of periods) {
    if (!period.startTime) continue;
    const end = period.endTime ? formatDateTime(period.endTime) : "open ended";
    lines.push(`${formatDateTime(period.startTime)} – ${end}`);
  }

  return lines.length ? lines : null;
}
