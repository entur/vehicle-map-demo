import { describe, expect, it } from "vitest";
import { limitConcurrency } from "./limitConcurrency.ts";

describe("limitConcurrency", () => {
  it("never runs more than max tasks at once, and runs them all", async () => {
    const limited = limitConcurrency(2);
    let running = 0;
    let peak = 0;
    const task = async (value: number) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return value;
    };
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => limited(() => task(n))),
    );
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it("frees the slot when a task rejects", async () => {
    const limited = limitConcurrency(1);
    await expect(
      limited(() => Promise.reject(new Error("tile failed"))),
    ).rejects.toThrow("tile failed");
    await expect(limited(() => Promise.resolve("next"))).resolves.toBe("next");
  });
});
