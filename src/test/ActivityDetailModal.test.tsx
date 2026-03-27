import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import ActivityDetailModal from "../components/dashboard/ActivityDetailModal";
import type { ActivityItem } from "../components/dashboard/types";

const mockInvoke = vi.mocked(invoke);

const mockActivity: ActivityItem = {
  activity_id: "act-123",
  strava_id: "strava-456",
  name: "Morning Run",
  type: "Run",
  start_date: "2025-01-15T08:00:00Z",
  distance: 5000,
  moving_time: 1800,
  average_speed: 2.78,
  average_heartrate: 145,
  max_heartrate: 165,
  average_cadence: 180,
  gear_id: null,
  elapsed_time: 1900,
  total_elevation_gain: 50,
  max_speed: 4.0,
  workout_type: null,
  sport_type: "Run",
  start_date_local: "2025-01-15T09:00:00",
};

const mockActivityNoStrava: ActivityItem = {
  ...mockActivity,
  strava_id: null,
  activity_id: "act-no-strava",
};

function setupEmptyInvoke() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_activity_laps") return Promise.resolve([]);
    if (cmd === "get_activity_zone_distribution") return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupEmptyInvoke();
});

describe("ActivityDetailModal", () => {
  it("opens when open=true and activity is provided", async () => {
    const onOpenChange = vi.fn();

    render(
      <ActivityDetailModal
        activity={mockActivity}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("renders activity name in header", async () => {
    const onOpenChange = vi.fn();

    render(
      <ActivityDetailModal
        activity={mockActivity}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Morning Run")).toBeInTheDocument();
    });
  });

  it("shows strava-only message when activity has no strava_id", async () => {
    const onOpenChange = vi.fn();

    render(
      <ActivityDetailModal
        activity={mockActivityNoStrava}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Detailed data available for Strava-synced activities only"),
      ).toBeInTheDocument();
    });
  });

  it("shows no lap data message when laps array is empty", async () => {
    const onOpenChange = vi.fn();

    render(
      <ActivityDetailModal
        activity={mockActivity}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No lap data available")).toBeInTheDocument();
    });
  });

  it("shows no zone data message when zones array is empty", async () => {
    const onOpenChange = vi.fn();

    render(
      <ActivityDetailModal
        activity={mockActivity}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No heart rate zone data available")).toBeInTheDocument();
    });
  });
});
