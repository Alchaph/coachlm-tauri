import { test, expect } from "@playwright/test";
import { setupTauriMocks, getInvokeLog } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
  await page.goto("/");
});

test("shows empty state when no sessions", async ({ page }) => {
  const emptyStateText = page.locator("text=Start a conversation");
  await expect(emptyStateText).toBeVisible();
});

test("sends a message and receives response", async ({ page }) => {
  const messageInput = page.locator("#chat-input");
  await messageInput.fill("How should I train for a 5k?");

  const sendButton = page.locator('[aria-label="Send message"]');
  await sendButton.click();

  const responseText = page.locator(
    "text=This is a mock response from the AI coach."
  );
  await expect(responseText).toBeVisible();

  const log = await getInvokeLog(page);
  const hasSendMessage = log.some((entry) => entry.cmd === "send_message");
  expect(hasSendMessage).toBe(true);
});

test("pins an assistant message", async ({ page }) => {
  const messageInput = page.locator("#chat-input");
  await messageInput.fill("How should I train for a 5k?");

  const sendButton = page.locator('[aria-label="Send message"]');
  await sendButton.click();

  const responseText = page.locator(
    "text=This is a mock response from the AI coach."
  );
  await expect(responseText).toBeVisible();

  const pinButton = page.locator('[aria-label="Pin insight"]').first();
  await pinButton.click();

  const log = await getInvokeLog(page);
  const hasSaveInsight = log.some(
    (entry) => entry.cmd === "save_pinned_insight"
  );
  expect(hasSaveInsight).toBe(true);
});

test("displays existing chat sessions in sidebar", async ({ page }) => {
  await setupTauriMocks(page, {
    overrides: {
      get_chat_sessions: [
        {
          id: "sess-1",
          title: "Training Talk",
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "sess-2",
          title: "Race Prep",
          created_at: "2025-01-02T00:00:00Z",
        },
      ],
    },
  });
  await page.goto("/");

  await expect(page.getByText("Training Talk").first()).toBeVisible();
  await expect(page.getByText("Race Prep").first()).toBeVisible();
});

test("creates new chat session", async ({ page }) => {
  const newChatButton = page.locator('[aria-label="New chat"]');
  await newChatButton.click();

  const log = await getInvokeLog(page);
  const hasCreateSession = log.some(
    (entry) => entry.cmd === "create_chat_session"
  );
  expect(hasCreateSession).toBe(true);
});
