import { describe, expect, it, vi } from "vitest";
import {
  NIB_TOKEN_REFRESH_MARGIN_MS,
  createNibTokenSource,
  nibErrorCode,
} from "./nibToken.ts";

const HOUR = 60 * 60 * 1000;

/** A fetcher handing out token-1, token-2, … each expiring an hour after `now`. */
function counting(now: () => number) {
  let n = 0;
  return vi.fn(async () => ({ token: `token-${++n}`, expires: now() + HOUR }));
}

describe("createNibTokenSource", () => {
  it("fetches once and reuses the token while it is fresh", async () => {
    let time = 0;
    const now = () => time;
    const fetchToken = counting(now);
    const source = createNibTokenSource(fetchToken, now);

    expect(await source.get()).toBe("token-1");
    time = HOUR - NIB_TOKEN_REFRESH_MARGIN_MS - 1;
    expect(await source.get()).toBe("token-1");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("renews the token within the margin of its expiry", async () => {
    let time = 0;
    const now = () => time;
    const source = createNibTokenSource(counting(now), now);

    await source.get();
    time = HOUR - NIB_TOKEN_REFRESH_MARGIN_MS;
    expect(await source.get()).toBe("token-2");
  });

  it("shares one fetch among callers that ask at once", async () => {
    const fetchToken = counting(() => 0);
    const source = createNibTokenSource(fetchToken, () => 0);

    const tokens = await Promise.all([
      source.get(),
      source.get(),
      source.get(),
    ]);

    expect(tokens).toEqual(["token-1", "token-1", "token-1"]);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed fetch", async () => {
    const fetchToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("proxy down"))
      .mockResolvedValueOnce({ token: "recovered", expires: HOUR });
    const source = createNibTokenSource(fetchToken, () => 0);

    await expect(source.get()).rejects.toThrow("proxy down");
    expect(await source.get()).toBe("recovered");
  });

  it("fetches a new token after the current one is invalidated", async () => {
    const source = createNibTokenSource(
      counting(() => 0),
      () => 0,
    );

    source.invalidate(await source.get());

    expect(await source.get()).toBe("token-2");
  });

  it("ignores invalidating a token that was already replaced", async () => {
    const fetchToken = counting(() => 0);
    const source = createNibTokenSource(fetchToken, () => 0);

    source.invalidate(await source.get());
    await source.get();
    source.invalidate("token-1");

    expect(await source.get()).toBe("token-2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});

describe("nibErrorCode", () => {
  it("reads the code of the tile cache's error body", () => {
    expect(
      nibErrorCode({ error: { code: 498, message: "Invalid Token" } }),
    ).toBe(498);
  });

  it("reads a bare code too", () => {
    expect(nibErrorCode({ code: 498, message: "Invalid Token" })).toBe(498);
  });

  it("is null for anything else", () => {
    expect(nibErrorCode(null)).toBeNull();
    expect(nibErrorCode("Invalid Token")).toBeNull();
    expect(nibErrorCode({ error: { code: "498" } })).toBeNull();
    expect(nibErrorCode({ code: "498" })).toBeNull();
  });
});
