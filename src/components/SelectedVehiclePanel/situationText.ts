import { TranslatedString } from "../../types.ts";

const LANGUAGE_PREFERENCE = ["NO", "EN"];

function usable(entry: TranslatedString | undefined): string | null {
  const value = entry?.value?.trim();
  return value ? value : null;
}

/**
 * Picks the best display string out of a list of translations.
 *
 * Norwegian wins over English because the feed frequently publishes an EN entry
 * that is really just the Norwegian text copied across. Untagged entries are
 * common enough (roughly a quarter of live records carry `language: null`) that
 * the last resort is simply the first entry holding any text.
 */
export function pickTranslation(
  strings: TranslatedString[] | null | undefined,
): string | null {
  if (!strings) return null;

  for (const language of LANGUAGE_PREFERENCE) {
    const match = strings.find(
      (entry) => entry.language?.toUpperCase() === language && usable(entry),
    );
    if (match) return usable(match);
  }

  return usable(strings.find((entry) => usable(entry)));
}

/**
 * True when `text` adds nothing beyond `summary`, so the expanded view can skip
 * it. The feed routinely publishes a description identical to the summary.
 */
export function isRedundant(
  text: string | null,
  summary: string | null,
): boolean {
  if (!text) return true;
  if (!summary) return false;
  return text.trim() === summary.trim();
}
