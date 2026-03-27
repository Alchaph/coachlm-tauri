import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import Context from "../components/Context";

const sampleInsights = [
  {
    id: 1,
    content: "Focus on easy aerobic base before adding speed work.",
    source_session_id: "sess_001",
    created_at: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    content: "Recovery weeks every 4th week are essential to avoid injury.",
    source_session_id: null,
    created_at: "2024-01-20T12:00:00Z",
  },
];

const sampleProfile = {
  age: 32,
  max_hr: 185,
  resting_hr: 55,
  threshold_pace_secs: 270,
  weekly_mileage_target: 60,
  race_goals: "Sub-3 marathon",
  injury_history: "Left knee ITB 2023",
  experience_level: "intermediate",
  training_days_per_week: 5,
  preferred_terrain: "road",
  heart_rate_zones: null,
  custom_notes: null,
};

function setupInvokeMock(withInsights = false, withProfile = false) {
  vi.mocked(invoke).mockImplementation((command: string) => {
    switch (command) {
      case "get_profile_data":
        return Promise.resolve(withProfile ? sampleProfile : null);
      case "get_pinned_insights":
        return Promise.resolve(withInsights ? sampleInsights : []);
      case "save_profile_data":
        return Promise.resolve(undefined);
      case "delete_pinned_insight":
        return Promise.resolve(undefined);
      default:
        return Promise.resolve(undefined);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Context", () => {
  it("renders profile tab by default", async () => {
    setupInvokeMock();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByText("Athlete Profile")).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: /athlete profile/i })).toBeInTheDocument();
  });

  it("displays profile form fields for age and max hr", async () => {
    setupInvokeMock();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByLabelText("Age")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/max hr/i)).toBeInTheDocument();
  });

  it("renders insights tab when clicked", async () => {
    setupInvokeMock(true);
    const user = userEvent.setup();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /pinned insights/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /pinned insights/i }));

    await waitFor(() => {
      expect(screen.getByText("Focus on easy aerobic base before adding speed work.")).toBeInTheDocument();
    });
  });

  it("shows insights list with content and delete buttons", async () => {
    setupInvokeMock(true);
    const user = userEvent.setup();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /pinned insights/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /pinned insights/i }));

    await waitFor(() => {
      expect(screen.getByText("Recovery weeks every 4th week are essential to avoid injury.")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete insight/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it("shows empty state message when no insights exist", async () => {
    setupInvokeMock(false);
    const user = userEvent.setup();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /pinned insights/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /pinned insights/i }));

    await waitFor(() => {
      expect(screen.getByText("No pinned insights yet.")).toBeInTheDocument();
    });
  });

  it("calls delete_pinned_insight after confirm dialog", async () => {
    setupInvokeMock(true);
    const user = userEvent.setup();

    render(<Context />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /pinned insights/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /pinned insights/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /delete insight/i })).toHaveLength(2);
    });

    const [firstDeleteButton] = screen.getAllByRole("button", { name: /delete insight/i });
    await user.click(firstDeleteButton);

    const unpinButton = await screen.findByRole("button", { name: /unpin/i });
    await user.click(unpinButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("delete_pinned_insight", { id: 1 });
    });
  });
});
