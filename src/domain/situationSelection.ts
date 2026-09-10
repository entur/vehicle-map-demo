import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/**
 * How the map singles out the selected situation.
 *
 * Both expressions key on the `situationNumber` feature property, so every
 * feature a situation flattens to — each affected stop, each affected span —
 * responds together. Nothing here rebuilds the features: selection is applied
 * to the style, not the data, which keeps `situationFeatures` pure and avoids
 * re-flying the map on every subscription frame.
 */

const isSelected = (selected: string): ExpressionSpecification => [
  "==",
  ["get", "situationNumber"],
  selected,
];

/** Filter for the halo layers: the selected situation's features, or nothing. */
export function selectedSituationFilter(
  selected: string | null,
): FilterSpecification {
  return selected === null ? ["boolean", false] : isSelected(selected);
}

/**
 * Opacity for the ordinary layers: `full` while nothing is selected, and
 * `dimmed` for every situation but the selected one once something is.
 */
export function dimmedUnlessSelected(
  selected: string | null,
  full: number,
  dimmed: number,
): number | ExpressionSpecification {
  return selected === null
    ? full
    : ["case", isSelected(selected), full, dimmed];
}
