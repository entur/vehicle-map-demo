import { test, expect, type Page } from "@playwright/test";

type TestWindow = {
  __vehicleMap?: {
    jumpTo(options: {
      center: [number, number];
      zoom: number;
      pitch?: number;
    }): void;
    once(event: "idle", listener: () => void): void;
  };
  __seasonal?: { season: string; count: number; twinkling: boolean };
};

/** Majorstuen: stops with room beside them, so some get pumpkins. */
const MAJORSTUEN: [number, number] = [10.7156, 59.9298];

async function openAtMajorstuen(page: Page, search: string) {
  await page.goto(`/${search}`);
  await page.waitForFunction(
    () => (window as unknown as TestWindow).__vehicleMap !== undefined,
    undefined,
    { timeout: 60000 },
  );
  // Waits for the tiles at the new view, so an absence is not just early.
  await page.evaluate(
    (center) =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as TestWindow).__vehicleMap!;
        map.jumpTo({ center, zoom: 17.5 });
        map.once("idle", resolve);
      }),
    MAJORSTUEN,
  );
}

const seasonal = (page: Page) =>
  page.evaluate(() => (window as unknown as TestWindow).__seasonal);

test("pumpkins stand near stops in the Halloween season", async ({ page }) => {
  await openAtMajorstuen(page, "?season=halloween");
  await expect
    .poll(async () => (await seasonal(page))?.count ?? 0, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect((await seasonal(page))?.season).toBe("halloween");
});

test("no decorations with season=none", async ({ page }) => {
  await openAtMajorstuen(page, "?season=none");
  expect(await seasonal(page)).toBeUndefined();
});

test("Christmas trees stand near stops in Advent", async ({ page }) => {
  await openAtMajorstuen(page, "?season=christmas");
  await expect
    .poll(async () => (await seasonal(page))?.count ?? 0, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect((await seasonal(page))?.season).toBe("christmas");
});

test("the lights hold steady with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAtMajorstuen(page, "?season=christmas");
  await expect
    .poll(async () => (await seasonal(page))?.count ?? 0, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect((await seasonal(page))?.twinkling).toBe(false);
});

// Tilted, the loaded tiles reach the horizon, where low-zoom tiles carry
// lines degrees long; placing pumpkins against them once blanked the app.
test("pumpkins survive a tilted 3D view", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openAtMajorstuen(page, "?season=halloween");
  await page.getByRole("button", { name: "Show 3D view" }).click();
  await page.evaluate(
    (center) =>
      (window as unknown as TestWindow).__vehicleMap!.jumpTo({
        center,
        zoom: 16.5,
        pitch: 75,
      }),
    MAJORSTUEN,
  );
  await expect
    .poll(async () => (await seasonal(page))?.count ?? 0, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect((await seasonal(page))?.season).toBe("halloween");
  // Let the horizon's tiles load and the next builds run against them.
  await page.waitForTimeout(8000);
  expect(
    errors.filter((text) => /pumpkin|Map maximum size/i.test(text)),
  ).toEqual([]);
  await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(1);
});
