import { NONE } from "./situationStats.ts";

/** A codespace the dropdown can offer. `count` is null when none is known. */
export type CodespaceOption = { value: string; count: number | null };

/** Bare codespace ids as options, for a source that carries no counts. */
export function withoutCounts(ids: string[]): CodespaceOption[] {
  return ids.map((value) => ({ value, count: null }));
}

/**
 * The options for a codespace dropdown, given what the current mode's data
 * actually contains.
 *
 * The two modes draw from different sources and they do not agree. Vehicles use
 * the API's `codespaces` root, which on dev matches the vehicle feed exactly;
 * situations are published by a partly different set — measured on dev, seven
 * situation codespaces are absent from that root, including the two largest
 * publishers (RUT and NSB, together about three quarters of the feed), while
 * eleven of its entries carry no situations at all. Offering one list for both
 * makes most of the situations feed unreachable and most of the options empty.
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
