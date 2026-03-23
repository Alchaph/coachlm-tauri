import { test, expect } from "@playwright/test";
import { setupTauriMocks, getInvokeLog } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page, { onboardingMode: true });
  await page.goto("/");
});

test("renders welcome step with CoachLM heading", async ({ page }) => {
  const heading = page.locator("h1");
  await expect(heading).toContainText("CoachLM");
  const button = page.locator("button", { hasText: "Get Started" });
  await expect(button).toBeVisible();
});

test("navigates through all 4 steps", async ({ page }) => {
  await page.click("button:has-text('Get Started')");
  const connectHeading = page.locator("h2");
  await expect(connectHeading).toContainText("Connect Strava");
  
  const skipButtons = page.locator("button:has-text('Skip for now')");
  const firstSkipButton = skipButtons.first();
  await firstSkipButton.click();
  
  const llmHeading = page.locator("h2");
  await expect(llmHeading).toContainText("LLM Setup");
  
  const allSkipButtons = page.locator("button:has-text('Skip for now')");
  const nextSkipButton = allSkipButtons.first();
  await nextSkipButton.click();
  
  const allSetHeading = page.locator("h2");
  await expect(allSetHeading).toContainText("All Set!");
});

test("saves settings on completion", async ({ page }) => {
  await page.click("button:has-text('Get Started')");
  const skipButtons = page.locator("button:has-text('Skip for now')");
  await skipButtons.first().click();
  
  const allSkipButtons = page.locator("button:has-text('Skip for now')");
  await allSkipButtons.first().click();
  
  await page.click("button:has-text('Go to Context')");
  
  const log = await getInvokeLog(page);
  const saveSettingsCall = log.find(entry => entry.cmd === "save_settings");
  expect(saveSettingsCall).toBeDefined();
});

test("shows strava connect button when credentials available", async ({ page }) => {
  await setupTauriMocks(page, {
    onboardingMode: true,
    overrides: { get_strava_credentials_available: true },
  });
  await page.goto("/");
  
  await page.click("button:has-text('Get Started')");
  const connectButton = page.locator("button:has-text('Connect Strava')");
  await expect(connectButton).toBeVisible();
});
