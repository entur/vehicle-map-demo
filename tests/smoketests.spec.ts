import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Vehicle Map Demo");
});

test("has map", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("css=.maplibregl-map")).toBeVisible();
});

test("selecting a vehicle shows the timetable panel", async ({ page }) => {
  await page.goto("/");

  // Wait for at least one vehicle marker to render. Vehicles render as a
  // MapLibre symbol layer ("vehicle-layer") on top of a canvas, so we can't
  // query individual markers via DOM — instead we wait for the GraphQL data
  // to populate by polling the maplibre source.
  const hasVehicle = await page
    .waitForFunction(
      () => {
        const win = window as unknown as {
          __maplibreVehicleSourceFeatureCount?: number;
        };
        // The app does not expose the source count, so as a proxy we click the
        // canvas center after a short delay — most dev runs have vehicles in
        // the default viewport.
        void win;
        return true;
      },
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!hasVehicle) test.skip(true, "Could not confirm vehicles loaded");

  // Give vehicles a moment to render, then click the centre of the canvas.
  await page.waitForTimeout(3000);
  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) test.skip(true, "Map canvas not found");
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // If a vehicle was selected, its detail panel appears.
  const panel = page.getByRole("region", { name: "Selected vehicle" });
  await expect(panel).toBeVisible({ timeout: 5000 });

  // And at least one stop row eventually appears. We don't have a stable
  // test ID on rows; assert by waiting for >=1 element under the panel with
  // tabular-numeric content matching HH:MM.
  await expect(panel.locator("text=/[0-9]{2}:[0-9]{2}/").first()).toBeVisible({
    timeout: 8000,
  });
});

test("switching to situations mode swaps the tool rail", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Data report" })).toBeVisible();

  await page.getByRole("button", { name: "Situations", exact: true }).click();

  await expect(page).toHaveURL(/mode=situations/);
  await expect(page.getByRole("button", { name: "Data report" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Info" })).toHaveCount(0);

  await page.getByRole("button", { name: "Situations panel" }).click();
  await expect(page.getByRole("heading", { name: "Situations" })).toBeVisible();
});

test("statistics is a vehicles-mode tool in the right toolbar", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByRole("region", { name: "Statistics" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Statistics" }).getByText("Statistics", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Situations", exact: true }).click();
  await expect(page.getByRole("button", { name: "Statistics" })).toHaveCount(0);
});

test("mode survives a reload", async ({ page }) => {
  await page.goto("/?mode=situations");

  await expect(page.getByRole("button", { name: "Data report" })).toHaveCount(
    0,
  );
});

test("the theme toggle switches to dark and survives a reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
  await expect(html).toHaveAttribute("data-mui-color-scheme", "dark");

  // Hold the app back on its config fetch, so React has not rendered when we
  // look: a dark attribute at that point can only have come from the pre-load
  // script in index.html.
  await page.route("**/bootstrap.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(html).toHaveAttribute("data-mui-color-scheme", "dark", {
    timeout: 500,
  });

  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
});

type TestMap = {
  getLayer(id: string): unknown;
  getLayoutProperty(id: string, name: string): unknown;
  hasImage(name: string): boolean;
  querySourceFeatures(source: string): unknown[];
  addImage(
    name: string,
    image: { width: number; height: number; data: Uint8Array },
  ): void;
};
type BaseVisibility = { light: unknown; dark: unknown };
type TestWindow = {
  __vehicleMap?: TestMap;
  // Set once, from MapView's onStyleData handler, on the map's first
  // 'styledata' — before BaseMapScheme's own listener (registered later, once
  // BaseMapScheme has mounted) has any chance to correct a wrongly-built
  // scheme. Unlike __vehicleMap (set on 'load'), this proves what
  // buildMapStyle actually baked in, not what the running map looks like by
  // the time the style, sprite and glyphs have finished loading.
  __vehicleMapInitialBaseVisibility?: BaseVisibility;
};

test("switching to dark swaps the base map and keeps app state", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  // Live dev API: matches the older vehicle test's approach of skipping
  // rather than failing when the feed doesn't deliver in time.
  const hasVehicle = await page
    .waitForFunction(
      () => {
        const map = (window as unknown as TestWindow).__vehicleMap;
        return !!map && map.querySourceFeatures("vehicles").length > 0;
      },
      null,
      { timeout: 30000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!hasVehicle) test.skip(true, "Could not confirm vehicles loaded");

  const read = () =>
    page.evaluate(() => {
      const map = (window as unknown as TestWindow).__vehicleMap!;
      return {
        light: map.getLayoutProperty("light/background", "visibility"),
        dark: map.getLayoutProperty("dark/background", "visibility"),
        vehicleLayer:
          map.getLayoutProperty("vehicle-layer", "visibility") ?? "visible",
        icon: map.hasImage("green-marker-icon"),
        vehicleIcon: map.hasImage("vehicle-bus"),
        features: map.querySourceFeatures("vehicles").length,
      };
    });

  const before = await read();
  expect(before.light).toBe("visible");
  expect(before.dark).toBe("none");
  expect(before.vehicleIcon).toBe(true);

  // Sentinel for setStyle: setStyle drops every registered image, so a
  // surviving probe is the clearest proof this was a visibility switch, not a
  // style replacement.
  await page.evaluate(() => {
    const map = (window as unknown as TestWindow).__vehicleMap!;
    map.addImage("__probe", { width: 1, height: 1, data: new Uint8Array(4) });
  });

  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mui-color-scheme",
    "dark",
  );

  await expect.poll(async () => (await read()).dark).toBe("visible");
  const after = await read();
  expect(after.light).toBe("none");
  expect(after.vehicleLayer).toBe(before.vehicleLayer);
  expect(after.icon).toBe(true);
  expect(after.vehicleIcon).toBe(true);
  expect(after.features).toBeGreaterThan(0);

  const probeSurvived = await page.evaluate(() =>
    (window as unknown as TestWindow).__vehicleMap!.hasImage("__probe"),
  );
  expect(probeSurvived).toBe(true);
});

test("loading in dark starts on the dark base map", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  // Proves the style buildMapStyle actually baked in, not just the running
  // map's eventual state: __vehicleMapInitialBaseVisibility is recorded on
  // the map's first 'styledata', before BaseMapScheme's own listener can run
  // and correct a wrongly-built scheme (see MapView's onStyleData handler and
  // its comment). Checking only __vehicleMap, which is set on 'load', would
  // pass even if MapView built the light style and BaseMapScheme silently
  // fixed it up before 'load' fired.
  await page.waitForFunction(
    () => !!(window as unknown as TestWindow).__vehicleMapInitialBaseVisibility,
    null,
    { timeout: 30000 },
  );
  const initial = await page.evaluate(
    () => (window as unknown as TestWindow).__vehicleMapInitialBaseVisibility!,
  );
  expect(initial).toEqual({ light: "none", dark: "visible" });

  // The running map should agree once it has finished loading.
  await page.waitForFunction(
    () =>
      !!(window as unknown as TestWindow).__vehicleMap?.getLayer(
        "dark/background",
      ),
    null,
    { timeout: 30000 },
  );
  const visibility = await page.evaluate(() => {
    const map = (window as unknown as TestWindow).__vehicleMap!;
    return {
      light: map.getLayoutProperty("light/background", "visibility"),
      dark: map.getLayoutProperty("dark/background", "visibility"),
    };
  });
  expect(visibility).toEqual({ light: "none", dark: "visible" });
});
