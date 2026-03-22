import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import SettingsPage from "../components/Settings";

const defaultSettings = {
  active_llm: "ollama",
  ollama_endpoint: "http://localhost:11434",
  ollama_model: "llama3",
  custom_system_prompt: "",
  cloud_api_key: null,
  cloud_model: null,
  web_search_enabled: false,
  web_search_provider: "duckduckgo",
};

function setupInvokeMock() {
  vi.mocked(invoke).mockImplementation((command: string) => {
    switch (command) {
      case "get_settings":
        return Promise.resolve(defaultSettings);
      case "get_strava_auth_status":
        return Promise.resolve({ connected: false, expires_at: null });
      case "get_strava_credentials_available":
        return Promise.resolve(false);
      case "check_ollama_status":
        return Promise.resolve(true);
      case "save_settings":
        return Promise.resolve(undefined);
      default:
        return Promise.resolve(undefined);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("renders settings form with LLM provider section", async () => {
    setupInvokeMock();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("LLM Configuration")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
  });

  it("displays Save Settings button", async () => {
    setupInvokeMock();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save settings/i })).toBeInTheDocument();
    });
  });

  it("save settings button calls invoke with save_settings", async () => {
    setupInvokeMock();
    const user = userEvent.setup();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save settings/i })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", { data: expect.objectContaining({ active_llm: "ollama" }) as unknown });
    });
  });

  it("loads settings on mount by calling get_settings", async () => {
    setupInvokeMock();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_settings");
    });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_strava_auth_status");
    });
  });

  it("shows Strava credentials not configured message when unavailable", async () => {
    setupInvokeMock();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/strava credentials are not configured/i)).toBeInTheDocument();
    });
  });

  it("renders web search section with On/Off toggle", async () => {
    setupInvokeMock();

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Web Search")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /^off$/i })).toBeInTheDocument();
  });
});
