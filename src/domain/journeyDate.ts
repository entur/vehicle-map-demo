/**
 * Which dated service journey ids are worth asking the API about.
 *
 * `serviceJourney(id:)` resolves from planned data that covers today and
 * forward. Measured on dev: every id dated today or later resolved with
 * geometry, and none dated in the past did — including ids from a week
 * earlier — while past-dated ids were 3,793 of the 3,828 dated ids in the
 * feed. Skipping them is the difference between two requests and about 150.
 *
 * Ids without a date (`ATB:ServiceJourney:311_260106098642683_7010` — the
 * digits there are a dataset version, not a day) are always asked, since the
 * API resolves them regardless of day.
 */

const TRAILING_DATE = /_(\d\d)-(\d\d)-(\d\d)$/;

/** The `YY-MM-DD` suffix of a dated journey id as `YYYY-MM-DD`, or null if it has none. */
export function journeyDateOf(id: string): string | null {
  const match = TRAILING_DATE.exec(id);
  if (!match) return null;
  const [, year, month, day] = match;
  return `20${year}-${month}-${day}`;
}

/** Whether the API can still resolve this journey on `today` (`YYYY-MM-DD`). */
export function mayResolveJourney(id: string, today: string): boolean {
  const date = journeyDateOf(id);
  return date === null || date >= today;
}
