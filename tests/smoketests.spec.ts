import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Vehicle Map Demo");
});

test("has map", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("css=.maplibregl-map")).toBeVisible();
});
