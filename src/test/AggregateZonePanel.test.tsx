import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import AggregateZonePanel from "../components/dashboard/AggregateZonePanel";
import type { ActivityZoneSummary } from "../components/dashboard/types";

const mockInvoke = vi.mocked(invoke);

const sampleZoneData: ActivityZoneSummary[] = [
  { zone_index: 0, zone_min: 0, zone_max: 120, total_time_seconds: 600, percentage: 20 },
  { zone_index: 1, zone_min: 120, zone_max: 140, total_time_seconds: 900, percentage: 30 },
  { zone_index: 2, zone_min: 140, zone_max: 160, total_time_seconds: 1200, percentage: 40 },
  { zone_index: 3, zone_min: 160, zone_max: 180, total_time_seconds: 180, percentage: 6 },
  { zone_index: 4, zone_min: 180, zone_max: 999, total_time_seconds: 120, percentage: 4 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AggregateZonePanel", () => {
  it("renders with 30 Days selected by default", async () => {
    mockInvoke.mockResolvedValue([]);

    render(<AggregateZonePanel />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "get_aggregated_zone_distribution",
        { days: 30 },
      );
    });

    const thirtyDaysBtn = screen.getByRole("button", { name: "30 Days" });
    expect(thirtyDaysBtn).toBeInTheDocument();
  });

  it("calls invoke with days:7 when 7 Days is clicked", async () => {
    mockInvoke.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<AggregateZonePanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "7 Days" })).toBeInTheDocument();
    });

    const sevenDaysBtn = screen.getByRole("button", { name: "7 Days" });
    await user.click(sevenDaysBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "get_aggregated_zone_distribution",
        { days: 7 },
      );
    });
  });

  it("calls invoke with days:null when All Time is clicked", async () => {
    mockInvoke.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<AggregateZonePanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All Time" })).toBeInTheDocument();
    });

    const allTimeBtn = screen.getByRole("button", { name: "All Time" });
    await user.click(allTimeBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "get_aggregated_zone_distribution",
        { days: null },
      );
    });
  });

  it("shows empty state when no data returned", async () => {
    mockInvoke.mockResolvedValue([]);

    render(<AggregateZonePanel />);

    await waitFor(() => {
      expect(
        screen.getByText("No heart rate zone data for this period"),
      ).toBeInTheDocument();
    });
  });

  it("shows chart when data available", async () => {
    mockInvoke.mockResolvedValue(sampleZoneData);

    render(<AggregateZonePanel />);

    await waitFor(() => {
      expect(screen.getByTestId("aggregate-zone-panel")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Total training time/)).toBeInTheDocument();
    });
  });
});
