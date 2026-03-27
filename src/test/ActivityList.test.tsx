import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityList from "../components/dashboard/ActivityList";
import type { ActivityItem, AuthStatus } from "../components/dashboard/types";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        start: i * opts.estimateSize(),
        end: (i + 1) * opts.estimateSize(),
        size: opts.estimateSize(),
        key: i,
        lane: 0,
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    measureElement: vi.fn(),
  }),
}));

const mockActivity: ActivityItem = {
  activity_id: "act-1",
  strava_id: "strava-123",
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

const defaultAuthStatus: AuthStatus = { connected: true, expires_at: 9999999999 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActivityList", () => {
  it("calls onActivityClick with correct activity when row is clicked", async () => {
    const onActivityClick = vi.fn();
    const user = userEvent.setup();

    render(
      <ActivityList
        filteredActivities={[mockActivity]}
        dataLoaded={true}
        hasMore={false}
        authStatus={defaultAuthStatus}
        activitiesCount={1}
        onLoadMore={vi.fn()}
        onActivityClick={onActivityClick}
      />,
    );

    const row = await screen.findByText("Morning Run");
    await user.click(row);

    expect(onActivityClick).toHaveBeenCalledTimes(1);
    expect(onActivityClick).toHaveBeenCalledWith(mockActivity);
  });
});
