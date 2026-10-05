import { Filter } from "../types.ts";

/**
 * The query params that belong to `Filter`. Every other key in the query
 * string is owned by another hook (`mode` by `useModeQueryParam`, `view` by
 * `useViewDimensionQueryParam`). Copying one of those into the filter would
 * put a stray key into the subscription variables, and the filter hook would
 * then write its stale value back over the owner's on every map move.
 */
const FILTER_QUERY_KEYS = ["codespaceId", "operatorRef", "maxDataAge"] as const;

export function filterFromQueryParams(
  params: Record<string, string>,
): Partial<Filter> {
  const filter: Record<string, string> = {};
  for (const key of FILTER_QUERY_KEYS) {
    if (params[key] !== undefined) filter[key] = params[key];
  }
  return filter as Partial<Filter>;
}
