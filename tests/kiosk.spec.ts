import { test, expect } from "@playwright/test";

type KioskWindow = {
  __kiosk?: { phase: string };
  __kioskIdleMs?: number;
};

test.describe("kiosk mode", () => {
  // One after another: three WebGL maps at once on a loaded machine delayed
  // the chase test's click past its 6 s idle period. Not "serial", which
  // would skip the rest after a failure.
  test.describe.configure({ mode: "default" });

  test.beforeEach(async ({ page }) => {
    // Resume 6 s after the last input instead of 2 minutes. Read once, when
    // the kiosk starts; development builds only.
    await page.addInitScript(() => {
      (window as unknown as KioskWindow).__kioskIdleMs = 6000;
    });
  });

  test("hides the app's controls and switches to vehicles", async ({
    page,
  }) => {
    await page.goto("/?mode=situations&kiosk=20");

    const situations = page.getByRole("button", {
      name: "Situations",
      exact: true,
    });
    // The attribution renders with the map, so the app is up before the
    // absence below is asserted.
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
    await expect(situations).toHaveCount(0);
    // Vehicles mode is forced at start, before the first pick.
    await expect(page).toHaveURL(/mode=vehicles/, { timeout: 30000 });
    // In vehicles mode the mode pill would otherwise always show.
    await expect(situations).toHaveCount(0);
  });

  test("chases, pauses on input and restores its setup on resume", async ({
    page,
  }) => {
    // Locking on can take up to a minute, which is longer than the default.
    test.setTimeout(120000);
    await page.goto("/?kiosk=20");

    const chased = await page
      .waitForFunction(
        () => (window as unknown as KioskWindow).__kiosk?.phase === "chasing",
        null,
        { timeout: 60000 },
      )
      .then(
        () => true,
        () => false,
      );
    test.skip(!chased, "No vehicle locked on within a minute");

    await expect(page.getByRole("region", { name: "Kiosk" })).toBeVisible();

    await page.keyboard.press("Shift");
    await expect(page.getByText(/Kiosk paused/)).toBeVisible();
    const situations = page.getByRole("button", {
      name: "Situations",
      exact: true,
    });
    await expect(situations).toBeVisible();

    // A visitor switches modes and walks away.
    // The pill is still settling and the idle period is only 6 s, so skip
    // the stability wait or the kiosk resumes before the click lands.
    await situations.click({ force: true });
    await expect(page).toHaveURL(/mode=situations/);

    // 6 s later the kiosk resumes and puts its own setup back.
    await expect(page).toHaveURL(/mode=vehicles/, { timeout: 15000 });
    await expect(situations).toHaveCount(0);

    // Paused again, the pill's button resumes at once, well inside the 6 s.
    await page.keyboard.press("Shift");
    await expect(situations).toBeVisible();
    await page.getByRole("button", { name: "Resume kiosk" }).click();
    await expect(situations).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByText(/Kiosk paused/)).toHaveCount(0);
  });

  test("starts and stops from the Kiosk tool", async ({ page }) => {
    await page.goto("/");

    const situations = page.getByRole("button", {
      name: "Situations",
      exact: true,
    });
    await expect(situations).toBeVisible();
    await page.getByRole("button", { name: "Kiosk", exact: true }).click();
    const panel = page.getByRole("region", { name: "Kiosk" });
    await expect(panel.getByText("All vehicles")).toBeVisible();

    // The click that presses Start must not pause the run it starts.
    await panel.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/[?&]kiosk=180(&|$)/);
    await expect(page).not.toHaveURL(/kioskIdle/);
    await expect(situations).toHaveCount(0);
    await expect(page.getByText(/Kiosk paused/)).toHaveCount(0);

    // Paused, the controls come back, and Stop is in the tool — not the pill.
    // Every click is input too, so the 6 s idle period restarts with each.
    await page.keyboard.press("Shift");
    await expect(page.getByText(/Kiosk paused/)).toBeVisible();
    await page.getByRole("button", { name: "Kiosk", exact: true }).click();
    await page
      .getByRole("region", { name: "Kiosk" })
      .getByRole("button", { name: "Stop" })
      .click();
    await expect(page).not.toHaveURL(/kiosk=/);
    await expect(page.getByText(/Kiosk paused/)).toHaveCount(0);

    // Longer than the idle period: nothing resumes.
    await page.waitForTimeout(8000);
    await expect(situations).toBeVisible();
    await expect(page).not.toHaveURL(/kiosk=/);
  });

  test.describe("fixed view", () => {
    type MapWindow = KioskWindow & {
      __vehicleMap?: {
        getCenter(): { lng: number; lat: number };
        getZoom(): number;
        getPitch(): number;
        getBearing(): number;
        isMoving(): boolean;
        jumpTo(options: { center: [number, number]; zoom: number }): void;
      };
    };
    const FIXED = {
      lat: 59.911,
      lng: 10.755,
      zoom: 16,
      pitch: 45,
      bearing: -30,
    };
    const LINK = `/?kioskView=${FIXED.lat},${FIXED.lng},${FIXED.zoom},${FIXED.pitch},${FIXED.bearing}&view=3d`;

    // Settled: not mid-ease, and on the fixed camera. Runs in the page.
    const onFixedCamera = (expected: typeof FIXED): boolean => {
      const map = (window as unknown as MapWindow).__vehicleMap;
      if (!map || map.isMoving()) return false;
      const { lng, lat } = map.getCenter();
      return (
        Math.abs(lat - expected.lat) < 1e-4 &&
        Math.abs(lng - expected.lng) < 1e-4 &&
        Math.abs(map.getZoom() - expected.zoom) < 0.01 &&
        Math.abs(map.getPitch() - expected.pitch) < 0.5 &&
        Math.abs(map.getBearing() - expected.bearing) < 0.5
      );
    };

    test("holds its camera, hides the controls and flies back after a visitor", async ({
      page,
    }) => {
      await page.goto(LINK);

      // On its own pitch, not the 3D view's 55°, once the dimension settles.
      await page.waitForFunction(onFixedCamera, FIXED, { timeout: 20000 });
      await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
      const situations = page.getByRole("button", {
        name: "Situations",
        exact: true,
      });
      await expect(situations).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(
        0,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as KioskWindow).__kiosk?.phase,
          ),
        )
        .toBe("fixed");
      // No band: the map is the whole screen.
      await expect(page.getByRole("region", { name: "Kiosk" })).toHaveCount(0);

      // A visitor pauses it and moves the map elsewhere.
      await page.keyboard.press("Shift");
      await expect(page.getByText(/Kiosk paused/)).toBeVisible();
      await expect(situations).toBeVisible();
      await page.evaluate(() =>
        (window as unknown as MapWindow).__vehicleMap?.jumpTo({
          center: [10.4, 63.43],
          zoom: 12,
        }),
      );

      // 6 s later it resumes and flies back to its own view.
      await page.waitForFunction(onFixedCamera, FIXED, { timeout: 20000 });
      await expect(situations).toHaveCount(0);
      await expect(page.getByText(/Kiosk paused/)).toHaveCount(0);
    });

    test("starts from the Kiosk tool on the current view", async ({ page }) => {
      await page.goto("/");
      const situations = page.getByRole("button", {
        name: "Situations",
        exact: true,
      });
      await expect(situations).toBeVisible();
      await page.waitForFunction(
        () => (window as unknown as MapWindow).__vehicleMap !== undefined,
      );
      await page.evaluate(() =>
        (window as unknown as MapWindow).__vehicleMap?.jumpTo({
          center: [10.755, 59.911],
          zoom: 15,
        }),
      );

      await page.getByRole("button", { name: "Kiosk", exact: true }).click();
      const panel = page.getByRole("region", { name: "Kiosk" });
      await panel.getByRole("combobox", { name: "Kind" }).click();
      await page.getByRole("option", { name: "Fixed view" }).click();
      await panel.getByRole("button", { name: "Start" }).click();

      await expect(page).toHaveURL(/[?&]kioskView=59\.911,10\.755,15,0,0(&|$)/);
      await expect(page).not.toHaveURL(/[?&]kiosk=/);
      await expect(situations).toHaveCount(0);
      await expect(page.getByText(/Kiosk paused/)).toHaveCount(0);
    });
  });
});
