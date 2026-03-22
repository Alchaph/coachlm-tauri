import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import TrainingPlanPage from "../components/TrainingPlan";

function setupInvokeMock(overrides?: Partial<Record<string, unknown>>) {
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === "get_active_plan") {
      const override = overrides?.["get_active_plan"];
      if (override instanceof Error) {
        return Promise.reject(override);
      }
      if (override !== undefined) {
        return Promise.resolve(override);
      }
      return Promise.reject(new Error("No active plan"));
    }

    const defaults: Record<string, unknown> = {
      list_plans: [],
      list_races: [],
    };
    const merged = { ...defaults, ...overrides };
    if (command in merged) {
      return Promise.resolve(merged[command]);
    }
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrainingPlanPage", () => {
  it("renders My Plans and Schedule sub-tabs", () => {
    setupInvokeMock();

    render(<TrainingPlanPage />);

    expect(screen.getByRole("button", { name: /my plans/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /schedule/i })).toBeInTheDocument();
  });

  it("defaults to My Plans tab when no active plan exists", async () => {
    setupInvokeMock();

    render(<TrainingPlanPage />);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_races");
    });

    await waitFor(() => {
      expect(screen.getByText("Race Goals")).toBeInTheDocument();
    });
  });

  it("switches to Schedule tab when active plan exists", async () => {
    setupInvokeMock({
      get_active_plan: {
        id: "plan-1",
        race_id: "race-1",
        generated_at: "2025-01-01T00:00:00Z",
        llm_backend: "ollama",
        prompt_hash: "abc123",
        is_active: true,
      },
      get_plan_weeks: [],
      list_races: [],
    });

    render(<TrainingPlanPage />);

    await waitFor(() => {
      expect(screen.queryByText("Race Goals")).not.toBeInTheDocument();
    });
  });

  it("clicking Schedule tab switches to schedule view", async () => {
    setupInvokeMock();

    render(<TrainingPlanPage />);

    await waitFor(() => {
      expect(screen.getByText("Race Goals")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const scheduleTab = screen.getByRole("button", { name: /schedule/i });
    await user.click(scheduleTab);

    await waitFor(() => {
      expect(screen.queryByText("Race Goals")).not.toBeInTheDocument();
    });
  });

  it("clicking My Plans tab returns to plans view from schedule", async () => {
    setupInvokeMock();

    render(<TrainingPlanPage />);

    const user = userEvent.setup();

    const scheduleTab = screen.getByRole("button", { name: /schedule/i });
    await user.click(scheduleTab);

    await waitFor(() => {
      expect(screen.queryByText("Race Goals")).not.toBeInTheDocument();
    });

    const plansTab = screen.getByRole("button", { name: /my plans/i });
    await user.click(plansTab);

    await waitFor(() => {
      expect(screen.getByText("Race Goals")).toBeInTheDocument();
    });
  });
});
