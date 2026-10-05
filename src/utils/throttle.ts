export type Throttled<T extends unknown[]> = ((...args: T) => void) & {
  /** Drops a trailing call still pending, so nothing runs after teardown. */
  cancel(): void;
};

/**
 * Runs `callback` at once, then at most once per `delayMs`: calls made while
 * waiting are folded into one trailing call, with the latest arguments, when
 * the wait ends. Without that trailing call the last of several calls in a
 * window is simply lost — for map moves, the position the map came to rest at.
 */
export function throttle<T extends unknown[]>(
  callback: (...args: T) => void,
  delayMs: number,
): Throttled<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: T | null = null;

  const wait = () => {
    timer = setTimeout(() => {
      timer = undefined;
      if (pending) {
        const args = pending;
        pending = null;
        callback(...args);
        wait();
      }
    }, delayMs);
  };

  const throttled = (...args: T) => {
    if (timer !== undefined) {
      pending = args;
      return;
    }
    callback(...args);
    wait();
  };
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
  };
  return throttled;
}
