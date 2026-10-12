import { test, expect, Page } from "@playwright/test";

/** A Nowcast body as api.met.no shapes it, cut to what the app reads. */
function nowcast(precipitationRate: number, symbolCode: string) {
  return {
    properties: {
      meta: { radar_coverage: "ok" },
      timeseries: [
        {
          data: {
            instant: {
              details: {
                precipitation_rate: precipitationRate,
                wind_speed: 4,
              },
            },
            next_1_hours: { summary: { symbol_code: symbolCode } },
          },
        },
      ],
    },
  };
}

// The weather itself is stubbed: what falls over the map's centre is not
// something a test can count on.
async function stubNowcast(page: Page, body: unknown) {
  await page.route("**/weatherapi/nowcast/**", (route) =>
    route.fulfill({ json: body }),
  );
}

type TestWindow = {
  __vehicleMap?: {
    jumpTo(options: { zoom: number }): void;
    getSky(): Record<string, unknown> | undefined;
  };
};

const skyColour = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as TestWindow).__vehicleMap!.getSky()?.["sky-color"],
  );

// The weather is drawn from the zoom where vehicles become 3D models (16).
async function zoomTo(page: Page, zoom: number) {
  await page.waitForFunction(
    () => (window as unknown as TestWindow).__vehicleMap !== undefined,
  );
  await page.evaluate(
    (zoom) => (window as unknown as TestWindow).__vehicleMap!.jumpTo({ zoom }),
    zoom,
  );
}

// Opens in 2D and switches: in the test browser a page loaded cold in 3D can
// take over a minute to hand out its map, with terrain tiles still loading.
async function open3d(page: Page, zoom = 17) {
  await page.goto("/");
  await zoomTo(page, zoom);
  await page.getByRole("button", { name: "Show 3D view" }).click();
}

async function switchWeatherOn(page: Page) {
  await page.getByRole("button", { name: "Layers" }).click();
  const answered = page.waitForResponse("**/weatherapi/nowcast/**");
  await page.getByLabel("Weather").check();
  await answered;
}

const overlay = (page: Page) => page.getByTestId("weather-overlay");

test("the Weather switch draws rain over the 3D map when it is raining", async ({
  page,
}) => {
  await stubNowcast(page, nowcast(2, "rain"));
  await open3d(page);

  await expect(overlay(page)).toHaveCount(0);
  await switchWeatherOn(page);

  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page)).toHaveAttribute("data-weather", "rain");
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText(
    "MET Norway",
  );

  await page.getByLabel("Weather").uncheck();
  await expect(overlay(page)).toHaveCount(0);
  await expect(page.locator(".maplibregl-ctrl-attrib")).not.toContainText(
    "MET Norway",
  );
});

test("the Weather switch draws snow when it is snowing", async ({ page }) => {
  await stubNowcast(page, nowcast(1, "snow"));
  await open3d(page);
  await switchWeatherOn(page);

  await expect(overlay(page)).toHaveAttribute("data-weather", "snow");
});

test("dry weather draws nothing", async ({ page }) => {
  await stubNowcast(page, nowcast(0, "cloudy"));
  await open3d(page);
  await switchWeatherOn(page);

  await expect(page.getByLabel("Weather")).toBeChecked();
  await expect(overlay(page)).toHaveCount(0);
});

test("the weather does not take the map's input", async ({ page }) => {
  await stubNowcast(page, nowcast(2, "rain"));
  await open3d(page);
  await switchWeatherOn(page);
  await expect(overlay(page)).toBeVisible();

  await expect(overlay(page)).toHaveCSS("pointer-events", "none");
});

test("the Weather switch is off and unavailable in 2D", async ({ page }) => {
  await stubNowcast(page, nowcast(2, "rain"));
  await page.goto("/");
  await page.getByRole("button", { name: "Layers" }).click();

  await expect(page.getByLabel("Weather")).toBeDisabled();
  await expect(overlay(page)).toHaveCount(0);
});

// The sky is the other half of the weather, and needs nothing to be falling.
test("a cloudy sky is grey, and the scheme's own again with the switch off", async ({
  page,
}) => {
  await stubNowcast(page, nowcast(0, "cloudy"));
  await open3d(page);
  const own = await skyColour(page);

  await switchWeatherOn(page);
  await expect.poll(() => skyColour(page)).not.toBe(own);

  await page.getByLabel("Weather").uncheck();
  await expect.poll(() => skyColour(page)).toBe(own);
});

test("a clear sky is left as the scheme has it", async ({ page }) => {
  await stubNowcast(page, nowcast(0, "clearsky_day"));
  await open3d(page);
  const own = await skyColour(page);

  await switchWeatherOn(page);
  await expect(page.getByLabel("Weather")).toBeChecked();
  expect(await skyColour(page)).toBe(own);
});

test("leaving 3D stops the weather", async ({ page }) => {
  await stubNowcast(page, nowcast(2, "rain"));
  await open3d(page);
  await switchWeatherOn(page);
  await expect(overlay(page)).toBeVisible();

  await page.getByRole("button", { name: "Show 2D view" }).click();
  await expect(overlay(page)).toHaveCount(0);

  // The switch keeps its setting, so going back to 3D brings the rain back.
  await page.getByRole("button", { name: "Show 3D view" }).click();
  await expect(overlay(page)).toBeVisible();
});

test("the weather is drawn only where vehicles are 3D models", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/weatherapi/nowcast/**", (route) => {
    requests++;
    return route.fulfill({ json: nowcast(2, "rain") });
  });
  await open3d(page, 15.5);
  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByLabel("Weather").check();

  // Zoomed out, the weather is neither drawn nor asked for.
  await page.waitForTimeout(1000);
  await expect(overlay(page)).toHaveCount(0);
  expect(requests).toBe(0);

  await zoomTo(page, 16.5);
  await expect(overlay(page)).toBeVisible();

  await zoomTo(page, 15.5);
  await expect(overlay(page)).toHaveCount(0);
});

test("reduced motion draws no weather", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubNowcast(page, nowcast(2, "rain"));
  await open3d(page);
  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByLabel("Weather").check();

  await expect(page.getByLabel("Weather")).toBeChecked();
  await expect(overlay(page)).toHaveCount(0);
});
