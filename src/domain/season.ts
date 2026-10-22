/** A season that decorates the map. */
export type Season = "halloween" | "christmas" | "17mai" | "pride";

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
  {
    id: "17mai",
    isOn: (_year, month, day) => month === 5 && day <= 17,
  },
  {
    id: "pride",
    isOn: (_year, month) => month === 6,
  },
];

/** The flags the vehicles can fly: Norway's, or the six-stripe rainbow. */
export type FlagDesign = "norway" | "rainbow";

const FLAG_DESIGNS: Partial<Record<Season, FlagDesign>> = {
  "17mai": "norway",
  pride: "rainbow",
};

/** The flag the vehicles fly in `season`, or null when they fly none. */
export function flagDesignFor(season: Season | null): FlagDesign | null {
  return season === null ? null : (FLAG_DESIGNS[season] ?? null);
}

const OSLO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const isSeason = (value: string | null): value is Season =>
  SEASONS.some(({ id }) => id === value);

const FORCED_NEW_YEAR = "newyear";

/** The year, month and day in Oslo at `now`. */
function osloDate(now: Date): { year: number; month: number; day: number } {
  const parts = OSLO_DATE.formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/**
 * The season on `now`, judged by the date in Oslo. `?season=<id>` forces
 * that season on any date and `?season=none` forces none, for trying it out
 * and for tests; any other value is ignored. `?season=newyear` forces the
 * fireworks (see `fireworksOn`), which stand over the Christmas trees, so it
 * answers `"christmas"`.
 */
export function seasonOn(now: Date, search: string): Season | null {
  const forced = new URLSearchParams(search).get("season");
  if (forced === "none") return null;
  if (forced === FORCED_NEW_YEAR) return "christmas";
  if (isSeason(forced)) return forced;

  const { year, month, day } = osloDate(now);
  return SEASONS.find(({ isOn }) => isOn(year, month, day))?.id ?? null;
}

const OSLO_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** Oslo's wall clock at `ms`, read as if it were UTC. */
function osloWallMs(ms: number): number {
  const parts = OSLO_TIME.formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return (
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    ) +
    (ms % 1000)
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Milliseconds from `now` to the next midnight in Oslo, when `seasonOn` and
 * `fireworksOn` can next change their answer. Exact across a daylight saving
 * change: the clocks go forward or back at night, never at midnight, so the
 * offset at the first guess is the offset at midnight.
 */
export function msUntilNextOsloDay(now: Date): number {
  const nowMs = now.getTime();
  const wall = osloWallMs(nowMs);
  const offset = wall - nowMs;
  const guess = wall - (((wall % DAY_MS) + DAY_MS) % DAY_MS) + DAY_MS - offset;
  return guess + offset - (osloWallMs(guess) - guess) - nowMs;
}

/**
 * Whether the New Year's fireworks are on at `now`: 27 December to 1 January
 * inclusive by the date in Oslo. They are an addition on top of the season,
 * not one of `SEASONS`, because they overlap Christmas and the trees stay up
 * under them. `?season=newyear` forces them on, `?season=none` and any other
 * forced season force them off, and any other value is ignored.
 */
export function fireworksOn(now: Date, search: string): boolean {
  const forced = new URLSearchParams(search).get("season");
  if (forced === FORCED_NEW_YEAR) return true;
  if (forced === "none" || isSeason(forced)) return false;

  const { month, day } = osloDate(now);
  return (month === 12 && day >= 27) || (month === 1 && day === 1);
}
