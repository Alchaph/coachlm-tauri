import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Plans" }).click();
});

test("shows sub-tab navigation", async ({ page }) => {
  await expect(page.getByRole("button", { name: "My Plans" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Schedule" })).toBeVisible();
});

test("can switch between tabs", async ({ page }) => {
  const myPlansButton = page.getByRole("button", { name: "My Plans" });
  const scheduleButton = page.getByRole("button", { name: "Schedule" });

  await expect(myPlansButton).toBeVisible();
  await expect(scheduleButton).toBeVisible();

  await scheduleButton.click();
  const scheduleStyle = await scheduleButton.evaluate(
    (el) => window.getComputedStyle(el).borderBottomColor,
  );
  expect(scheduleStyle).toBeTruthy();

  await myPlansButton.click();
  const myPlansStyle = await myPlansButton.evaluate(
    (el) => window.getComputedStyle(el).borderBottomColor,
  );
  expect(myPlansStyle).toBeTruthy();
});

test("displays race list on My Plans tab", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      list_races: [
        {
          id: "race-1",
          name: "Test Marathon",
          distance_km: 42.195,
          race_date: "2025-09-15",
          terrain: "road",
          elevation_m: null,
          goal_time_s: 12600,
          priority: "A",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Plans" }).click();
  await page.getByRole("button", { name: "My Plans" }).click();

  await expect(page.getByText("Test Marathon")).toBeVisible();
});
