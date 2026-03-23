import { test, expect } from "@playwright/test";
import { setupTauriMocks, getInvokeLog } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto("/");
});

test("loads and displays settings", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText("LLM Configuration")).toBeVisible();
  await expect(page.getByLabel("Ollama Endpoint URL")).toBeVisible();
});

test("saves settings when form is dirty", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();

  const saveButton = page.getByRole("button", { name: "Save Settings" });
  await expect(saveButton).toBeDisabled();

  const modelInput = page.locator("#ollama-model");
  await modelInput.fill("mistral");

  await expect(saveButton).toBeEnabled();

  await saveButton.click();

  const invokeLog = await getInvokeLog(page);
  const hasSaveSettings = invokeLog.some((call) => call.cmd === "save_settings");
  expect(hasSaveSettings).toBe(true);
});

test("fetches ollama models", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();

  await page.getByRole("button", { name: "Fetch Models" }).click();

  await expect(page.getByRole("button", { name: "llama3" })).toBeVisible();
  await expect(page.getByRole("button", { name: "mistral" })).toBeVisible();
  await expect(page.getByRole("button", { name: "codellama" })).toBeVisible();
});

test("shows strava not configured when credentials unavailable", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();

  await expect(
    page.getByText("Strava credentials are not configured")
  ).toBeVisible();
});

test("shows strava connected status", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_strava_credentials_available: true,
      get_strava_auth_status: { connected: true, expires_at: 9999999999 },
    },
  });
  
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const stravaSection = page.locator(".card", {
    has: page.getByRole("heading", { name: "Strava Integration" }),
  });
  await expect(stravaSection.getByText("Connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});
