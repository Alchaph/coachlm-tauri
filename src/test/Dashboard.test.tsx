import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import Dashboard from "../components/dashboard";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));

interface ActivityItem {
  activity_id: string;
  strava_id: string | null;
  name: string | null;
  type: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  gear_id: string | null;
  elapsed_time: number | null;
  total_elevation_gain: number | null;
  max_speed: number | null;
  workout_type: number | null;
  sport_type: string | null;
  start_date_local: string | null;
}

const mockActivity: ActivityItem = {
  activity_id: "act-1",
  strava_id: "12345",
  name: "Morning Run",
  type: "Run",
  start_date: "2025-02-15T08:00:00Z",
  distance: 10000,
  moving_time: 3600,
  average_speed: 2.78,
  average_heartrate: 145,
  max_heartrate: 165,
  average_cadence: 180,
  gear_id: null,
  elapsed_time: 3700,
  total_elevation_gain: 50,
  max_speed: 4.0,
  workout_type: null,
  sport_type: "Run",
  start_date_local: "2025-02-15T09:00:00",
};

function setupInvokeMock(overrides?: Partial<Record<string, unknown>>) {
  vi.mocked(invoke).mockImplementation((command: string) => {
    const defaults: Record<string, unknown> = {
      get_activity_stats: {
        total_activities: 5,
        total_distance_km: 42.5,
        earliest_date: "2025-01-01",
        latest_date: "2025-03-01",
        total_elevation_m: 250,
        total_moving_time_s: 15000,
        this_week_distance_km: 10.0,
      },
      get_recent_activities: [mockActivity],
      get_strava_auth_status: { connected: true, expires_at: 9999999999 },
      get_aggregated_zone_distribution: [],
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

describe("Dashboard", () => {
  it("renders stats cards with total activities and distance when data loads", async () => {
    setupInvokeMock();

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    expect(screen.getByText("Activities")).toBeInTheDocument();
    expect(screen.getByText("43")).toBeInTheDocument();
    expect(screen.getByText("Total km")).toBeInTheDocument();
  });

  it("renders empty state message when no activities exist", async () => {
    setupInvokeMock({
      get_activity_stats: {
        total_activities: 0,
        total_distance_km: 0,
        earliest_date: null,
        latest_date: null,
        total_elevation_m: 0,
        total_moving_time_s: 0,
        this_week_distance_km: 0,
      },
      get_recent_activities: [],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("No activities yet.")).toBeInTheDocument();
    });
  });

  it("shows sync button when strava is connected", async () => {
    setupInvokeMock();

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sync activities/i })).toBeInTheDocument();
    });
  });

  it("does not show sync button when strava is not connected", async () => {
    setupInvokeMock({
      get_strava_auth_status: { connected: false, expires_at: null },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /sync activities/i })).not.toBeInTheDocument();
    });
  });

  it("shows connect strava message in empty state when not connected", async () => {
    setupInvokeMock({
      get_activity_stats: {
        total_activities: 0,
        total_distance_km: 0,
        earliest_date: null,
        latest_date: null,
        total_elevation_m: 0,
        total_moving_time_s: 0,
        this_week_distance_km: 0,
      },
      get_recent_activities: [],
      get_strava_auth_status: { connected: false, expires_at: null },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/connect strava in settings/i)).toBeInTheDocument();
    });
  });
});
