import { test, expect } from "@playwright/test";
import { setupTauriMocks, getInvokeLog } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Context" }).click();
});

test("shows profile form with empty fields", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Context" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Athlete Profile" })).toBeVisible();
  
  const profileAgeInput = page.locator("#profile-age");
  const profileMaxHrInput = page.locator("#profile-max-hr");
  
  await expect(profileAgeInput).toBeVisible();
  await expect(profileMaxHrInput).toBeVisible();
});

test("saves profile data", async ({ page }) => {
  const profileAgeInput = page.locator("#profile-age");
  const profileMaxHrInput = page.locator("#profile-max-hr");
  
  await profileAgeInput.fill("30");
  await profileMaxHrInput.fill("185");
  
  await page.getByRole("button", { name: "Save Profile" }).click();
  
  const invokeLog = await getInvokeLog(page);
  const hasSaveProfile = invokeLog.some((call) => call.cmd === "save_profile_data");
  expect(hasSaveProfile).toBe(true);
});

test("shows pinned insights tab", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_pinned_insights: [
        {
          id: 1,
          content: "You should increase your long run distance gradually",
          source_session_id: "sess-1",
          created_at: "2025-01-15T00:00:00Z",
        },
      ],
    },
  });
  
  await page.goto("/");
  await page.getByRole("button", { name: "Context" }).click();
  
  await page.getByRole("tab", { name: /Pinned Insights/ }).click();
  
  await expect(
    page.getByText("You should increase your long run distance gradually")
  ).toBeVisible();
});

test("opens context preview modal", async ({ page }) => {
  await page.getByRole("button", { name: "Preview Prompt" }).click();
  
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  
  await expect(page.getByRole("heading", { name: /Context Preview|Athlete Context/ })).toBeVisible();
  
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
