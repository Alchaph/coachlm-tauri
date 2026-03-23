import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();
});

test("shows empty state when no activities", async ({ page }) => {
  await expect(page.locator("text=No activities yet.")).toBeVisible();
});

test("shows stats cards when activities exist", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_activity_stats: {
        total_activities: 5,
        total_distance_km: 42.5,
        earliest_date: "2025-01-01",
        latest_date: "2025-03-01",
      },
      get_recent_activities: [
        {
          activity_id: "a1",
          strava_id: "s1",
          name: "Morning Run",
          type: "Run",
          sport_type: "Run",
          start_date: "2025-03-01T08:00:00Z",
          start_date_local: "2025-03-01T08:00:00",
          distance: 10000,
          moving_time: 3000,
          average_speed: 3.33,
          average_heartrate: 145,
          max_heartrate: 170,
          average_cadence: 180,
          gear_id: null,
          elapsed_time: 3100,
          total_elevation_gain: 50,
          max_speed: 4.5,
          workout_type: null,
        },
      ],
      get_strava_auth_status: { connected: true, expires_at: 9999999999 },
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page.locator("text=5").first()).toBeVisible();
  const kmElements = await page.locator("text=/^(42|43)/").all();
  expect(kmElements.length).toBeGreaterThan(0);

  await expect(page.locator("text=Morning Run")).toBeVisible();
  await expect(page.locator("text=10.0 km")).toBeVisible();
});

test("shows sync button when connected", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_strava_auth_status: { connected: true, expires_at: 9999999999 },
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page.getByRole("button", { name: "Sync Activities" })).toBeVisible();
});

test("hides sync button when not connected", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Sync Activities" })).not.toBeVisible();
});
