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

  // Vehicles are drawn on a canvas, so ask the map where some are rather than
  // clicking a fixed spot and hoping a vehicle happens to be there. Only
  // vehicles well inside the canvas count: the edges are under the map
  // controls, the toolbar and the detail card. Candidates are kept apart so
  // each click lands on a different vehicle.
  const targets = await page
    .waitForFunction(
      () => {
        const map = (window as unknown as TestWindow).__vehicleMap;
        if (!map?.getLayer("vehicle-layer")) return null;
        const { width, height } = map.getCanvas().getBoundingClientRect();
        const points: { x: number; y: number }[] = [];
        for (const feature of map.queryRenderedFeatures({
          layers: ["vehicle-layer"],
        })) {
          if (feature.geometry.type !== "Point") continue;
          const { x, y } = map.project(feature.geometry.coordinates);
          const inside =
            x > width * 0.35 &&
            x < width * 0.65 &&
            y > height * 0.25 &&
            y < height * 0.75;
          const apart = points.every((p) => Math.hypot(p.x - x, p.y - y) > 40);
          if (inside && apart) points.push({ x, y });
          if (points.length === 5) break;
        }
        return points.length > 0 ? points : null;
      },
      null,
      { timeout: 30000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);

  test.skip(!targets, "No vehicles rendered in the default view");

  const box = await page.locator(".maplibregl-canvas").boundingBox();
  const panel = page.getByRole("region", { name: "Selected vehicle" });
  // Stop rows carry HH:MM times; there is no stable test ID on them.
  const stopTime = panel.locator("text=/[0-9]{2}:[0-9]{2}/").first();
  const notAvailable = panel.getByText(
    "Timetable not available for this trip.",
  );

  // Some journeys in the feed have no timetable (SKY ferries, for one), and
  // the panel rightly says so. Move on to the next vehicle when that happens:
  // the test is that timetables render, not that every vehicle has one.
  for (const target of targets!) {
    await page.mouse.click(box!.x + target.x, box!.y + target.y);
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(stopTime.or(notAvailable).first()).toBeVisible({
      timeout: 8000,
    });
    if (await stopTime.isVisible()) return;
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toBeHidden();
  }
  throw new Error(`None of ${targets!.length} vehicles showed a timetable`);
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
  getCanvas(): HTMLCanvasElement;
  queryRenderedFeatures(
    pointOrOptions: [number, number] | { layers: string[] },
    options?: { layers: string[] },
  ): {
    geometry: { type: string; coordinates: [number, number] };
  }[];
  project(lngLat: [number, number]): { x: number; y: number };
  unproject(point: [number, number]): { lng: number; lat: number };
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  getPadding(): { top: number; bottom: number };
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

test.describe("on a phone", () => {
  // Not a device preset: those set the browser type, which a project already
  // fixes, and isMobile, which Firefox does not support. The layout only
  // follows the width, and the sheet's handle needs touch.
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true });

  test("a selected vehicle opens a bottom sheet and stays in view above it", async ({
    page,
  }) => {
    await page.goto("/?mode=vehicles");
    await page.waitForFunction(
      () => !!(window as unknown as TestWindow).__vehicleMap,
      null,
      { timeout: 30000 },
    );
    // Trondheim: ATB reports every few seconds, so there are vehicles to tap
    // at a zoom where they are drawn apart.
    await page.evaluate(() =>
      (window as unknown as TestWindow).__vehicleMap!.jumpTo({
        center: [10.4, 63.43],
        zoom: 13,
      }),
    );

    // Vehicles low on the screen, where the collapsed sheet lands, so the
    // map has to bring the selection into view. Clear of the bottom edge,
    // where the attribution sits.
    const targets = await page
      .waitForFunction(
        () => {
          const map = (window as unknown as TestWindow).__vehicleMap!;
          const { width, height } = map.getCanvas().getBoundingClientRect();
          const points: { x: number; y: number }[] = [];
          for (const feature of map.queryRenderedFeatures({
            layers: ["vehicle-layer"],
          })) {
            if (feature.geometry.type !== "Point") continue;
            const { x, y } = map.project(feature.geometry.coordinates);
            const inside =
              x > width * 0.2 &&
              x < width * 0.7 &&
              y > height * 0.65 &&
              y < height * 0.88;
            const apart = points.every(
              (p) => Math.hypot(p.x - x, p.y - y) > 40,
            );
            if (inside && apart) points.push({ x, y });
            if (points.length === 5) break;
          }
          return points.length > 0 ? points : null;
        },
        null,
        { timeout: 30000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => null);

    test.skip(!targets, "No vehicles rendered low in the Trondheim view");

    const box = (await page.locator(".maplibregl-canvas").boundingBox())!;
    const sheet = page.getByRole("region", { name: "Selected vehicle" });
    const handle = sheet.getByRole("button", { name: /^Resize panel/ });

    // A tap can land between vehicles as they move; try the next one. The
    // vehicle a tap selects is the first feature under it in the layers
    // VehicleMarkers queries — which include the line label, drawn beside the
    // icon — so it is read the same way here, not assumed to be at the tap.
    let selected: { at: [number, number] } | null = null;
    for (const target of targets!) {
      const hit = await page.evaluate(({ x, y }) => {
        const map = (window as unknown as TestWindow).__vehicleMap!;
        const [feature] = map.queryRenderedFeatures([x, y], {
          layers: ["vehicle-layer", "vehicle-model-layer"],
        });
        if (!feature || feature.geometry.type !== "Point") return null;
        return { at: feature.geometry.coordinates };
      }, target);
      if (!hit) continue;
      await page.touchscreen.tap(box.x + target.x, box.y + target.y);
      const opened = await sheet
        .waitFor({ state: "visible", timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (opened) {
        selected = hit;
        break;
      }
    }
    expect(selected, "no tapped vehicle opened the sheet").not.toBeNull();

    // A sheet, not the desktop's column: across the bottom, collapsed.
    await expect(handle).toHaveAccessibleName("Resize panel (collapsed)");
    const peek = (await sheet.boundingBox())!;
    expect(peek.width).toBeGreaterThan(box.width * 0.9);
    expect(peek.y + peek.height).toBeGreaterThan(box.height * 0.95);
    expect(peek.height).toBeLessThan(box.height * 0.3);

    // No map popup on a phone: its actions are in the sheet, inside the
    // collapsed height rather than clipped below it.
    await expect(page.locator(".vehicle-popup")).toHaveCount(0);
    const chase = sheet.getByRole("button", { name: "Chase camera" });
    await expect(chase).toBeVisible();
    const chaseBox = (await chase.boundingBox())!;
    expect(chaseBox.y + chaseBox.height).toBeLessThanOrEqual(
      peek.y + peek.height,
    );

    // The map is padded by what the sheet hides, and the selected vehicle is
    // above the sheet once the map has brought it out from under it.
    const hiddenBy = (sheetTop: number) => Math.round(box.height - sheetTop);
    const readMap = () =>
      page.evaluate((at) => {
        const map = (window as unknown as TestWindow).__vehicleMap!;
        return {
          bottom: map.getPadding().bottom,
          vehicleY: map.project(at).y,
        };
      }, selected!.at);
    // The sheet eases between heights, so both sides are read together until
    // they agree rather than the sheet once, mid-animation.
    const paddingMismatch = async () =>
      (await readMap()).bottom - hiddenBy((await sheet.boundingBox())!.y);
    await expect.poll(paddingMismatch).toBe(0);
    await expect
      .poll(async () => (await readMap()).vehicleY, { timeout: 3000 })
      .toBeLessThan(peek.y);

    // Tapping the handle opens it a step, and the padding follows.
    await handle.tap();
    await expect(handle).toHaveAccessibleName("Resize panel (half open)");
    await expect
      .poll(async () => (await sheet.boundingBox())!.height)
      .toBeGreaterThan(peek.height * 1.5);
    await expect.poll(paddingMismatch).toBe(0);

    // Closing gives the map back its whole height.
    await sheet.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await readMap()).bottom).toBe(0);
  });
});
