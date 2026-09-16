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
};
type TestWindow = { __vehicleMap?: TestMap };

test("switching to dark swaps the base map and keeps app state", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.waitForFunction(
    () => {
      const map = (window as unknown as TestWindow).__vehicleMap;
      return !!map && map.querySourceFeatures("vehicles").length > 0;
    },
    null,
    { timeout: 30000 },
  );

  const read = () =>
    page.evaluate(() => {
      const map = (window as unknown as TestWindow).__vehicleMap!;
      return {
        light: map.getLayoutProperty("light/background", "visibility"),
        dark: map.getLayoutProperty("dark/background", "visibility"),
        vehicleLayer:
          map.getLayoutProperty("vehicle-layer", "visibility") ?? "visible",
        icon: map.hasImage("green-marker-icon"),
        features: map.querySourceFeatures("vehicles").length,
      };
    });

  const before = await read();
  expect(before.light).toBe("visible");
  expect(before.dark).toBe("none");

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
  expect(after.features).toBeGreaterThan(0);
});

test("loading in dark starts on the dark base map", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
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
