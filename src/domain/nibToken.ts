/**
 * Norge i bilder's tile cache wants a token on every tile, issued by Entur's
 * baat-token-proxy and bound to the page's origin. A token lasts an hour; the
 * proxy reports when it expires.
 */
export type NibToken = { token: string; expires: number };

/** A token is renewed this long before it expires, so no tile races its end. */
export const NIB_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * The tile cache reports a token problem as HTTP 200 with a JSON body:
 * 498 "Invalid Token" (expired, or bound to another origin) and 499 "Token
 * Required".
 */
export const NIB_TOKEN_ERROR_CODES: readonly number[] = [498, 499];

export type NibTokenSource = {
  /** A token valid for a while yet, fetching one when needed. */
  get: () => Promise<string>;
  /**
   * Drops `stale` after the tile cache refused it, so the next `get` fetches
   * a new one. A token that has already been replaced is left alone, so a
   * burst of refusals for one token fetches one replacement, not one each.
   */
  invalidate: (stale: string) => void;
};

/**
 * Caches the token, renews it ahead of expiry, and shares one fetch among
 * every caller that asks while it is under way — a screen of tiles asks at
 * once. A failed fetch is not cached, so the next `get` tries again.
 */
export function createNibTokenSource(
  fetchToken: () => Promise<NibToken>,
  now: () => number = Date.now,
): NibTokenSource {
  let current: NibToken | null = null;
  let inFlight: Promise<NibToken> | null = null;

  const get = async () => {
    if (current && current.expires - NIB_TOKEN_REFRESH_MARGIN_MS > now()) {
      return current.token;
    }
    if (!inFlight) {
      inFlight = fetchToken()
        .then((fresh) => (current = fresh))
        .finally(() => (inFlight = null));
    }
    return (await inFlight).token;
  };

  const invalidate = (stale: string) => {
    if (current?.token === stale) current = null;
  };

  return { get, invalidate };
}

/**
 * The tile cache's error code in a JSON body, or null if it has none. Both
 * shapes have been seen: `{"error":{"code":499,…}}` and `{"code":498,…}`.
 */
export function nibErrorCode(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const { code, error } = body as {
    code?: unknown;
    error?: { code?: unknown };
  };
  if (typeof error?.code === "number") return error.code;
  return typeof code === "number" ? code : null;
}
