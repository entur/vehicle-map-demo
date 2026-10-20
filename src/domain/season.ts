/** A season that decorates the map. Christmas and Easter go here later. */
export type Season = "halloween";

type MonthDay = [month: number, day: number];

/**
 * When each season is on, both ends inclusive, as dates in Oslo. A window
 * that wraps the new year is not supported yet; none does.
 */
export const SEASONS: { id: Season; from: MonthDay; to: MonthDay }[] = [
  { id: "halloween", from: [10, 24], to: [11, 1] },
];

const OSLO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  month: "numeric",
  day: "numeric",
});

const isSeason = (value: string | null): value is Season =>
  SEASONS.some(({ id }) => id === value);

/**
 * The season on `now`, judged by the date in Oslo. `?season=<id>` forces
 * that season on any date and `?season=none` forces none, for trying it out
 * and for tests; any other value is ignored.
 */
export function seasonOn(now: Date, search: string): Season | null {
  const forced = new URLSearchParams(search).get("season");
  if (forced === "none") return null;
  if (isSeason(forced)) return forced;

  const parts = OSLO_DATE.formatToParts(now);
  const part = (type: "month" | "day") =>
    Number(parts.find((p) => p.type === type)?.value);
  const today = part("month") * 100 + part("day");
  const season = SEASONS.find(
    ({ from, to }) =>
      from[0] * 100 + from[1] <= today && today <= to[0] * 100 + to[1],
  );
  return season?.id ?? null;
}
