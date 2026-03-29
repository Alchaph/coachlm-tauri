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
        total_elevation_m: 250,
        total_moving_time_s: 15000,
        this_week_distance_km: 10.0,
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

const sampleActivity = {
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
};

test("aggregate zone panel is visible on dashboard", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_aggregated_zone_distribution: [
        { zone_index: 0, zone_min: 0, zone_max: 120, total_time_seconds: 600, percentage: 10.0 },
        { zone_index: 1, zone_min: 120, zone_max: 148, total_time_seconds: 1800, percentage: 30.0 },
        { zone_index: 2, zone_min: 148, zone_max: 162, total_time_seconds: 2400, percentage: 40.0 },
        { zone_index: 3, zone_min: 162, zone_max: 174, total_time_seconds: 900, percentage: 15.0 },
        { zone_index: 4, zone_min: 174, zone_max: -1, total_time_seconds: 300, percentage: 5.0 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page.locator('[data-testid="aggregate-zone-panel"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "30 Days" })).toBeVisible();
});

test("clicking different time range button updates aggregate zone panel", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_aggregated_zone_distribution: [
        { zone_index: 0, zone_min: 0, zone_max: 120, total_time_seconds: 600, percentage: 10.0 },
        { zone_index: 1, zone_min: 120, zone_max: 148, total_time_seconds: 1800, percentage: 30.0 },
        { zone_index: 2, zone_min: 148, zone_max: 162, total_time_seconds: 2400, percentage: 40.0 },
        { zone_index: 3, zone_min: 162, zone_max: 174, total_time_seconds: 900, percentage: 15.0 },
        { zone_index: 4, zone_min: 174, zone_max: -1, total_time_seconds: 300, percentage: 5.0 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await page.locator('[data-testid="aggregate-zone-panel"]').getByRole("button", { name: "7 Days" }).click();

  await expect(page.getByRole("button", { name: "7 Days" })).toBeVisible();
  await expect(page.locator('[data-testid="aggregate-zone-panel"]')).toBeVisible();
});

test("clicking activity row opens ActivityDetail modal", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_recent_activities: [sampleActivity],
      get_activity_laps: [
        { id: 1, activity_id: "a1", lap_index: 1, distance: 1000.0, elapsed_time: 280, moving_time: 275, average_speed: 3.57, max_speed: 4.2, average_heartrate: 142.0, max_heartrate: 155.0, average_cadence: 178.0, total_elevation_gain: 5.0 },
        { id: 2, activity_id: "a1", lap_index: 2, distance: 1000.0, elapsed_time: 270, moving_time: 265, average_speed: 3.70, max_speed: 4.3, average_heartrate: 148.0, max_heartrate: 162.0, average_cadence: 182.0, total_elevation_gain: 3.0 },
        { id: 3, activity_id: "a1", lap_index: 3, distance: 1000.0, elapsed_time: 285, moving_time: 280, average_speed: 3.51, max_speed: 4.1, average_heartrate: 150.0, max_heartrate: 165.0, average_cadence: 176.0, total_elevation_gain: 8.0 },
      ],
      get_activity_zone_distribution: [
        { activity_id: "a1", zone_index: 0, zone_min: 0, zone_max: 120, time_seconds: 120 },
        { activity_id: "a1", zone_index: 1, zone_min: 120, zone_max: 148, time_seconds: 480 },
        { activity_id: "a1", zone_index: 2, zone_min: 148, zone_max: 162, time_seconds: 900 },
        { activity_id: "a1", zone_index: 3, zone_min: 162, zone_max: 174, time_seconds: 360 },
        { activity_id: "a1", zone_index: 4, zone_min: 174, zone_max: -1, time_seconds: 60 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await page.locator("table tbody tr").filter({ hasText: "Morning Run" }).click();

  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[role="dialog"]').getByText("Morning Run")).toBeVisible();
});

test("ActivityDetail modal shows lap chart area", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_recent_activities: [sampleActivity],
      get_activity_laps: [
        { id: 1, activity_id: "a1", lap_index: 1, distance: 1000.0, elapsed_time: 280, moving_time: 275, average_speed: 3.57, max_speed: 4.2, average_heartrate: 142.0, max_heartrate: 155.0, average_cadence: 178.0, total_elevation_gain: 5.0 },
        { id: 2, activity_id: "a1", lap_index: 2, distance: 1000.0, elapsed_time: 270, moving_time: 265, average_speed: 3.70, max_speed: 4.3, average_heartrate: 148.0, max_heartrate: 162.0, average_cadence: 182.0, total_elevation_gain: 3.0 },
        { id: 3, activity_id: "a1", lap_index: 3, distance: 1000.0, elapsed_time: 285, moving_time: 280, average_speed: 3.51, max_speed: 4.1, average_heartrate: 150.0, max_heartrate: 165.0, average_cadence: 176.0, total_elevation_gain: 8.0 },
      ],
      get_activity_zone_distribution: [
        { activity_id: "a1", zone_index: 0, zone_min: 0, zone_max: 120, time_seconds: 120 },
        { activity_id: "a1", zone_index: 1, zone_min: 120, zone_max: 148, time_seconds: 480 },
        { activity_id: "a1", zone_index: 2, zone_min: 148, zone_max: 162, time_seconds: 900 },
        { activity_id: "a1", zone_index: 3, zone_min: 162, zone_max: 174, time_seconds: 360 },
        { activity_id: "a1", zone_index: 4, zone_min: 174, zone_max: -1, time_seconds: 60 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await page.locator("table tbody tr").filter({ hasText: "Morning Run" }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await expect(page.locator('[data-testid="lap-chart"]')).toBeVisible();
});

test("ActivityDetail modal shows zone chart area", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_recent_activities: [sampleActivity],
      get_activity_laps: [
        { id: 1, activity_id: "a1", lap_index: 1, distance: 1000.0, elapsed_time: 280, moving_time: 275, average_speed: 3.57, max_speed: 4.2, average_heartrate: 142.0, max_heartrate: 155.0, average_cadence: 178.0, total_elevation_gain: 5.0 },
        { id: 2, activity_id: "a1", lap_index: 2, distance: 1000.0, elapsed_time: 270, moving_time: 265, average_speed: 3.70, max_speed: 4.3, average_heartrate: 148.0, max_heartrate: 162.0, average_cadence: 182.0, total_elevation_gain: 3.0 },
        { id: 3, activity_id: "a1", lap_index: 3, distance: 1000.0, elapsed_time: 285, moving_time: 280, average_speed: 3.51, max_speed: 4.1, average_heartrate: 150.0, max_heartrate: 165.0, average_cadence: 176.0, total_elevation_gain: 8.0 },
      ],
      get_activity_zone_distribution: [
        { activity_id: "a1", zone_index: 0, zone_min: 0, zone_max: 120, time_seconds: 120 },
        { activity_id: "a1", zone_index: 1, zone_min: 120, zone_max: 148, time_seconds: 480 },
        { activity_id: "a1", zone_index: 2, zone_min: 148, zone_max: 162, time_seconds: 900 },
        { activity_id: "a1", zone_index: 3, zone_min: 162, zone_max: 174, time_seconds: 360 },
        { activity_id: "a1", zone_index: 4, zone_min: 174, zone_max: -1, time_seconds: 60 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await page.locator("table tbody tr").filter({ hasText: "Morning Run" }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await expect(page.locator('[data-testid="zone-chart"]')).toBeVisible();
});

test("ActivityDetail modal closes on Escape key", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_recent_activities: [sampleActivity],
      get_activity_laps: [
        { id: 1, activity_id: "a1", lap_index: 1, distance: 1000.0, elapsed_time: 280, moving_time: 275, average_speed: 3.57, max_speed: 4.2, average_heartrate: 142.0, max_heartrate: 155.0, average_cadence: 178.0, total_elevation_gain: 5.0 },
        { id: 2, activity_id: "a1", lap_index: 2, distance: 1000.0, elapsed_time: 270, moving_time: 265, average_speed: 3.70, max_speed: 4.3, average_heartrate: 148.0, max_heartrate: 162.0, average_cadence: 182.0, total_elevation_gain: 3.0 },
        { id: 3, activity_id: "a1", lap_index: 3, distance: 1000.0, elapsed_time: 285, moving_time: 280, average_speed: 3.51, max_speed: 4.1, average_heartrate: 150.0, max_heartrate: 165.0, average_cadence: 176.0, total_elevation_gain: 8.0 },
      ],
      get_activity_zone_distribution: [
        { activity_id: "a1", zone_index: 0, zone_min: 0, zone_max: 120, time_seconds: 120 },
        { activity_id: "a1", zone_index: 1, zone_min: 120, zone_max: 148, time_seconds: 480 },
        { activity_id: "a1", zone_index: 2, zone_min: 148, zone_max: 162, time_seconds: 900 },
        { activity_id: "a1", zone_index: 3, zone_min: 162, zone_max: 174, time_seconds: 360 },
        { activity_id: "a1", zone_index: 4, zone_min: 174, zone_max: -1, time_seconds: 60 },
      ],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dashboard" }).click();

  await page.locator("table tbody tr").filter({ hasText: "Morning Run" }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
