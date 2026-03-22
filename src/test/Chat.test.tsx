import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import Chat from "../components/Chat";

const mockInvoke = vi.mocked(invoke);

const SESSION_LIST = [
  { id: "sess-1", title: "My Chat", created_at: "2025-01-01T00:00:00Z" },
];

const MESSAGE_LIST = [
  {
    id: 1,
    session_id: "sess-1",
    role: "user",
    content: "Hello",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    session_id: "sess-1",
    role: "assistant",
    content: "Hi there!",
    created_at: "2025-01-01T00:00:01Z",
  },
];

const DEFAULT_SETTINGS = {
  active_llm: "local",
  ollama_endpoint: "http://localhost:11434",
  ollama_model: "llama3",
  custom_system_prompt: "",
  cloud_api_key: null,
  cloud_model: null,
  web_search_enabled: false,
  web_search_provider: "duckduckgo",
};

const NEW_SESSION = {
  id: "sess-new",
  title: null,
  created_at: "2025-01-01T00:00:00Z",
};

function setupInvokeMocks(overrides: Partial<Record<string, unknown>> = {}): void {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd in overrides) return Promise.resolve(overrides[cmd]);
    if (cmd === "get_chat_sessions") return Promise.resolve(SESSION_LIST);
    if (cmd === "get_chat_messages") return Promise.resolve(MESSAGE_LIST);
    if (cmd === "get_settings") return Promise.resolve(DEFAULT_SETTINGS);
    if (cmd === "create_chat_session") return Promise.resolve(NEW_SESSION);
    if (cmd === "send_message") return Promise.resolve("AI response text");
    if (cmd === "save_settings") return Promise.resolve(undefined);
    if (cmd === "save_pinned_insight") return Promise.resolve(undefined);
    if (cmd === "delete_chat_session") return Promise.resolve(undefined);
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupInvokeMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("Chat component", () => {
  it("renders the session list in the sidebar on initial load", async () => {
    render(<Chat />);

    await waitFor(() => {
      const labels = screen.getAllByText("My Chat");
      expect(labels.length).toBeGreaterThanOrEqual(1);
      expect(labels[0]).toBeInTheDocument();
    });
  });

  it("renders the chat input textarea", async () => {
    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask your coach...")).toBeInTheDocument();
    });
  });

  it("displays loaded messages in the chat area", async () => {
    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there!")).toBeInTheDocument();
    });
  });

  it("creates a new session when the plus button is clicked", async () => {
    const user = userEvent.setup();
    setupInvokeMocks({ get_chat_sessions: [] });
    render(<Chat />);

    const newChatButton = await screen.findByTitle("New chat");
    await user.click(newChatButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_chat_session");
    });
  });

  it("closes sidebar when close button is clicked and reopens with open button", async () => {
    const user = userEvent.setup();
    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByTitle("Close sidebar")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Close sidebar"));

    await waitFor(() => {
      expect(screen.getByTitle("Open sidebar")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Open sidebar"));

    await waitFor(() => {
      expect(screen.getByTitle("Close sidebar")).toBeInTheDocument();
    });
  });

  it("shows the web search toggle button", async () => {
    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByText("Web search")).toBeInTheDocument();
    });
  });

  it("web search toggle is active when settings have web_search_enabled: true", async () => {
    setupInvokeMocks({
      get_settings: { ...DEFAULT_SETTINGS, web_search_enabled: true },
    });
    render(<Chat />);

    await waitFor(() => {
      const toggleBtn = screen.getByText("Web search").closest("button");
      expect(toggleBtn).toHaveClass("chat-toggle-chip-active");
    });
  });

  it("shows copy button on assistant messages", async () => {
    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy message")).toBeInTheDocument();
    });
  });

  it("copies assistant message content to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<Chat />);

    const copyBtn = await screen.findByTitle("Copy message");
    await user.click(copyBtn);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("Hi there!");
    });
  });

  it("shows empty state when there are no messages", async () => {
    setupInvokeMocks({ get_chat_sessions: [], get_chat_messages: [] });
    render(<Chat />);

    await waitFor(() => {
      expect(
        screen.getByText("Start a conversation with your AI running coach.")
      ).toBeInTheDocument();
    });
  });
});
