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
/**
 * Stavanger byterminal: the densest cluster of buses reporting every few
 * seconds that the flags were measured at — 11 to 14 flagged in view.
 */
const STAVANGER_BYTERMINAL: [number, number] = [5.7325, 58.9667];

async function openAtMajorstuen(page: Page, search: string) {
  await openAt(page, search, MAJORSTUEN);
}

async function openAt(page: Page, search: string, center: [number, number]) {
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
    center,
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

// Opened in 2D and switched: loaded cold in 3D, the whole country's terrain
// keeps software WebGL from reaching the map's "load" within the test.
async function openIn3d(page: Page, search: string) {
  await openAt(page, search, STAVANGER_BYTERMINAL);
  await page.getByRole("button", { name: "Show 3D view" }).click();
}

test("buses fly flags in the 17. mai season", async ({ page }) => {
  // Vehicle frames, then models built for them, all in software WebGL.
  test.setTimeout(90000);
  await openIn3d(page, "?season=17mai");
  await expect
    .poll(async () => (await seasonal(page))?.count ?? 0, { timeout: 60000 })
    .toBeGreaterThan(0);
  expect((await seasonal(page))?.season).toBe("17mai");
});

test("no flags with season=none", async ({ page }) => {
  await openIn3d(page, "?season=none");
  // Long enough for the vehicle feed's first frames to arrive.
  await page.waitForTimeout(5000);
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
