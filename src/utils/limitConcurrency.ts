/**
 * Wraps async tasks so no more than `max` run at once; the rest wait their
 * turn in call order.
 */
export function limitConcurrency(max: number) {
  let running = 0;
  const waiting: (() => void)[] = [];

  return async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (running >= max) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}
