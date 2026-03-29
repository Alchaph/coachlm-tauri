import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import App from "../App";

function setupDefaultInvokeMock() {
  vi.mocked(invoke).mockImplementation((command: string) => {
    switch (command) {
      case "is_first_run":
        return Promise.resolve(false);
      case "get_strava_auth_status":
        return Promise.resolve({ connected: false, expires_at: null });
      case "get_strava_credentials_available":
        return Promise.resolve(false);
      case "get_settings":
        return Promise.resolve({
          ollama_endpoint: "http://localhost:11434",
          ollama_model: "llama3",
          context_size: 4096,
          system_prompt: "",
          web_search_enabled: false,
        });
      case "get_chat_sessions":
        return Promise.resolve([]);
      case "get_chat_messages":
        return Promise.resolve([]);
      case "get_profile_data":
        return Promise.resolve(null);
      case "get_pinned_insights":
        return Promise.resolve([]);
      case "get_context_preview":
        return Promise.resolve("");
      case "get_recent_activities":
        return Promise.resolve([]);
      case "get_activity_stats":
        return Promise.resolve({
          total_activities: 0,
          total_distance_km: 0,
          earliest_date: null,
          latest_date: null,
          total_elevation_m: 0,
          total_moving_time_s: 0,
          this_week_distance_km: 0,
        });
      case "get_active_plan":
        return Promise.resolve(null);
      case "get_aggregated_zone_distribution":
        return Promise.resolve([]);
      case "get_ollama_models":
        return Promise.resolve([]);
      default:
        return Promise.resolve(undefined);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("App", () => {
  it("renders loading state initially while checking first run", () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => undefined));

    render(<App />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows Onboarding when is_first_run returns true", async () => {
    vi.mocked(invoke).mockImplementation((command: string) => {
      switch (command) {
        case "is_first_run":
          return Promise.resolve(true);
        case "get_strava_credentials_available":
          return Promise.resolve(false);
        case "get_ollama_models":
          return Promise.resolve([]);
        default:
          return Promise.resolve(undefined);
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Chat")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows main app layout when is_first_run returns false", async () => {
    setupDefaultInvokeMock();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Shoes")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("defaults to chat tab on initial render", async () => {
    setupDefaultInvokeMock();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    const chatButton = screen.getByRole("button", { name: "Chat" });
    expect(chatButton).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_chat_sessions");
    });
  });

  it("switches to Dashboard tab when Dashboard nav button is clicked", async () => {
    setupDefaultInvokeMock();
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    const dashboardButton = screen.getByRole("button", { name: /dashboard/i });
    await user.click(dashboardButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_recent_activities", expect.anything());
    });
  });

  it("switches to Settings tab when Settings nav button is clicked", async () => {
    setupDefaultInvokeMock();
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    await user.click(settingsButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_settings");
    });
  });

  it("switches to Context tab when Context nav button is clicked", async () => {
    setupDefaultInvokeMock();
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    const contextButton = screen.getByRole("button", { name: /context/i });
    await user.click(contextButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_pinned_insights");
    });
  });

  it("calls get_strava_auth_status on load when not first run", async () => {
    setupDefaultInvokeMock();

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_strava_auth_status");
    });
  });

  it("does not call sync_strava_activities when Strava is not connected", async () => {
    setupDefaultInvokeMock();

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith("sync_strava_activities");
  });
});
