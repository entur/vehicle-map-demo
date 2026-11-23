import { test, expect, type Page } from "@playwright/test";

type TestWindow = {
  __vehicleMap?: {
    getPixelRatio(): number;
    getCanvas(): HTMLCanvasElement;
    getLayoutProperty(layer: string, name: string): unknown;
    getPaintProperty(layer: string, name: string): unknown;
    getPitch(): number;
    getBearing(): number;
    getZoom(): number;
    getCenter(): { lng: number; lat: number };
    jumpTo(options: {
      center?: [number, number];
      zoom?: number;
      pitch?: number;
      bearing?: number;
    }): void;
    once(event: "idle", listener: () => void): void;
    _fadeDuration: number;
  };
};

/** Majorstuen: a small area that loads quickly in software WebGL. */
const MAJORSTUEN: [number, number] = [10.7156, 59.9298];

/** MapLibre's own label fade, which High leaves in place. */
const MAPLIBRE_FADE_MS = 300;

/**
 * What the map and deck.gl are drawing at. deck.gl draws into the map's
 * canvas and has to be told when its drawing buffer changes; `deck` is null
 * until it has attached.
 */
const drawing = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as TestWindow).__vehicleMap!;
    const canvas = map.getCanvas();
    const gl = canvas.getContext("webgl2") as unknown as {
      luma?: {
        device?: { canvasContext?: { getDrawingBufferSize(): number[] } };
      };
    };
    return {
      ratio: map.getPixelRatio(),
      canvas: [canvas.width, canvas.height],
      deck: gl.luma?.device?.canvasContext?.getDrawingBufferSize() ?? null,
      fade: map._fadeDuration,
    };
  });

/** Two animation frames, so a resize has been drawn and observed. */
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

async function open(page: Page, search: string) {
  await page.goto(`/${search}`);
  await page.waitForFunction(
    () => (window as unknown as TestWindow).__vehicleMap !== undefined,
    undefined,
    { timeout: 60000 },
  );
  // Streaming vehicle frames can keep `idle` away for seconds; the tiles at
  // this small view are what matter, and they are in well within the limit.
  await page.evaluate(
    (center) =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as TestWindow).__vehicleMap!;
        map.jumpTo({ center, zoom: 16 });
        map.once("idle", resolve);
        setTimeout(resolve, 10000);
      }),
    MAJORSTUEN,
  );
}

async function chooseQuality(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "Layers", exact: true }).click();
  }
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

// Large and dense enough that both Low and Medium have to lower the ratio.
test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

test("a low link draws fewer pixels without label fades, and deck.gl follows every change", async ({
  page,
}) => {
  await open(page, "?quality=low&mode=vehicles");
  await page.waitForFunction(
    () =>
      (
        (window as unknown as TestWindow)
          .__vehicleMap!.getCanvas()
          .getContext("webgl2") as unknown as { luma?: { device?: unknown } }
      ).luma?.device !== undefined,
  );
  const low = await drawing(page);
  expect(low.canvas[0] * low.canvas[1]).toBeLessThanOrEqual(1280 * 720);
  expect(low.deck).toEqual(low.canvas);
  expect(low.fade).toBe(0);

  // deck.gl has attached by now, so from here on only the sync keeps its
  // drawing buffer equal to the canvas.
  await chooseQuality(page, "Medium");
  await expect
    .poll(async () => (await drawing(page)).ratio)
    .not.toBe(low.ratio);
  const medium = await drawing(page);
  expect(medium.canvas[0] * medium.canvas[1]).toBeLessThanOrEqual(1920 * 1080);
  expect(medium.canvas[0]).toBeGreaterThan(low.canvas[0]);
  expect(medium.deck).toEqual(medium.canvas);
  expect(medium.fade).toBe(0);
  // The quality's key changes, and nobody else's is touched.
  expect(page.url()).toContain("quality=medium");
  expect(page.url()).toContain("mode=vehicles");

  await chooseQuality(page, "High");
  await expect.poll(async () => (await drawing(page)).ratio).toBe(2);
  const high = await drawing(page);
  expect(high.deck).toEqual(high.canvas);
  expect(high.fade).toBe(MAPLIBRE_FADE_MS);
  expect(page.url()).not.toContain("quality=");
  expect(page.url()).toContain("mode=vehicles");

  // A window resize at a lowered ratio: the ratio is worked out again for
  // the new size, and deck.gl still matches once the resize has landed.
  await chooseQuality(page, "Low");
  await page.setViewportSize({ width: 1200, height: 900 });
  const resizedRatio = Math.sqrt((1280 * 720) / (1200 * 900));
  await expect
    .poll(async () => (await drawing(page)).ratio)
    .toBeCloseTo(resizedRatio, 3);
  await twoFrames(page);
  const resized = await drawing(page);
  expect(resized.canvas[0] * resized.canvas[1]).toBeLessThanOrEqual(1280 * 720);
  expect(resized.deck).toEqual(resized.canvas);
});

test("low hides the hillshade and solidifies the buildings in 3D, and a change does not move the camera", async ({
  page,
}) => {
  await open(page, "?quality=low");
  await page.getByRole("button", { name: "Show 3D view" }).click();
  const layers = () =>
    page.evaluate(() => {
      const map = (window as unknown as TestWindow).__vehicleMap!;
      return {
        hillshade: map.getLayoutProperty("hillshade-layer", "visibility"),
        buildings: map.getLayoutProperty("buildings-3d-layer", "visibility"),
        // The opacity the zoom fade ends at: 1 draws in one pass.
        opacity: (
          map.getPaintProperty(
            "buildings-3d-layer",
            "fill-extrusion-opacity",
          ) as number[]
        ).at(-1),
      };
    });
  const camera = () =>
    page.evaluate(() => {
      const map = (window as unknown as TestWindow).__vehicleMap!;
      const { lng, lat } = map.getCenter();
      const round = (n: number) => Math.round(n * 1e5) / 1e5;
      return {
        pitch: round(map.getPitch()),
        bearing: round(map.getBearing()),
        zoom: round(map.getZoom()),
        lng: round(lng),
        lat: round(lat),
      };
    });
  await expect.poll(async () => (await camera()).pitch).toBe(55);
  await expect.poll(layers).toEqual({
    hillshade: "none",
    buildings: "visible",
    opacity: 1,
  });

  // Somewhere neither 2D nor 3D would put the camera, so any ease a quality
  // change set off would show.
  await page.evaluate(() =>
    (window as unknown as TestWindow).__vehicleMap!.jumpTo({
      pitch: 40,
      bearing: 30,
    }),
  );
  const before = await camera();
  await chooseQuality(page, "High");
  await expect.poll(layers).toEqual({
    hillshade: "visible",
    buildings: "visible",
    opacity: 0.85,
  });
  await twoFrames(page);
  expect(await camera()).toEqual(before);
});
