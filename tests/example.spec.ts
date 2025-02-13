import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Vite + React + TS");
});

test("has map", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("css=.maplibregl-map")).toBeVisible();
});

test("has marker", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("css=.maplibregl-marker").first()).toBeVisible();
});
