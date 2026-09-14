import { NONE } from "./situationStats.ts";

/** A codespace the dropdown can offer. `count` is null when none is known. */
export type CodespaceOption = { value: string; count: number | null };

/**
 * The options for a codespace dropdown, given what the current mode's data
 * actually contains.
 *
 * Each mode's list is a tally of its own feed, because no catalogue matches
 * either. The two feeds are published by partly different sets of codespaces —
 * RUT and NSB, together about three quarters of the situations feed, publish no
 * vehicles on dev — and the API's `codespaces` root lists every codespace in
 * the planned data, most of which publish neither, while still missing some
 * that publish vehicles. Offering a list that is not the feed's own makes part
 * of the feed unreachable and fills the rest with empty options.
 *
 * Two rules beyond "list what the mode has":
 *
 * `NONE` is dropped. It is a real bucket in the stats — situations that carry
 * no codespace — but `matchesCodespace` compares against a real id, so an
 * option for it would be selectable and match nothing. Its count stays visible
 * in the stats table.
 *
 * A `selected` value the list does not offer is injected anyway. Codespace
 * deliberately survives a mode switch, so a situations-only codespace can still
 * be selected while the vehicles list is showing; without this the `Select`
 * holds a value with no matching item, renders blank and warns. It is injected
 * with a null count rather than a zero, because "this list does not know about
 * it" is not the same claim as "it has none".
 */
export function codespaceOptions(
  available: CodespaceOption[],
  selected: string | null,
): CodespaceOption[] {
  const options = available.filter((option) => option.value !== NONE);

  if (
    selected &&
    selected !== NONE &&
    !options.some((option) => option.value === selected)
  ) {
    options.push({ value: selected, count: null });
  }

  // Alphabetical rather than by count: a dropdown is for finding a codespace
  // you already have in mind, and the counts still say where the data is.
  return options.sort((a, b) => a.value.localeCompare(b.value));
}
