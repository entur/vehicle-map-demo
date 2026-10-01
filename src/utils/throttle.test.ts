import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttle } from "./throttle.ts";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the first call at once", () => {
    const run = vi.fn();
    throttle(run, 500)("a");
    expect(run).toHaveBeenCalledExactlyOnceWith("a");
  });

  // The case the leading-only throttle lost: a move that ended inside the
  // window was dropped, and the map's last position never reached the filter.
  it("runs once more at the end of the window with the latest arguments", () => {
    const run = vi.fn();
    const throttled = throttle(run, 500);
    throttled("a");
    throttled("b");
    throttled("c");
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith("c");
  });

  it("makes no trailing call when nothing came during the window", () => {
    const run = vi.fn();
    throttle(run, 500)("a");
    vi.advanceTimersByTime(2000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("holds the trailing call to the same rate", () => {
    const run = vi.fn();
    const throttled = throttle(run, 500);
    throttled("a");
    throttled("b");
    vi.advanceTimersByTime(500);
    throttled("c");
    expect(run).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenLastCalledWith("c");
  });

  it("runs at once again after a quiet window", () => {
    const run = vi.fn();
    const throttled = throttle(run, 500);
    throttled("a");
    vi.advanceTimersByTime(500);
    throttled("b");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith("b");
  });

  it("drops a pending trailing call when cancelled", () => {
    const run = vi.fn();
    const throttled = throttle(run, 500);
    throttled("a");
    throttled("b");
    throttled.cancel();
    vi.advanceTimersByTime(2000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
