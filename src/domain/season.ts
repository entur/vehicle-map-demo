/** A season that decorates the map. */
export type Season = "halloween" | "christmas";

export type MonthDay = [month: number, day: number];

/**
 * The first Sunday of Advent in `year`: the fourth Sunday before 25 December
 * (21 days before the Sunday that falls on or before 24 December).
 */
export function firstAdventSunday(year: number): MonthDay {
  const weekday = new Date(Date.UTC(year, 11, 25)).getUTCDay();
  const first = new Date(
    Date.UTC(year, 11, 25 - (weekday === 0 ? 7 : weekday) - 21),
  );
  return [first.getUTCMonth() + 1, first.getUTCDate()];
}

const key = (month: number, day: number) => month * 100 + day;

/**
 * When each season is on, as a test of the date in Oslo. A window may wrap
 * the new year: Christmas runs from the first Sunday of Advent through
 * 6 January, so it is judged on the month and day alone.
 */
export const SEASONS: {
  id: Season;
  isOn: (year: number, month: number, day: number) => boolean;
}[] = [
  {
    id: "halloween",
    isOn: (_year, month, day) =>
      key(10, 24) <= key(month, day) && key(month, day) <= key(11, 1),
  },
  {
    id: "christmas",
    isOn: (year, month, day) =>
      key(month, day) >= key(...firstAdventSunday(year)) ||
      (month === 1 && day <= 6),
  },
];

const OSLO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
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
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return SEASONS.find(({ isOn }) => isOn(year, month, day))?.id ?? null;
}
