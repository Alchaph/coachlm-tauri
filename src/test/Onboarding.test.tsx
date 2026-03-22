import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import Onboarding from "../components/Onboarding";

function setupInvokeMock() {
  vi.mocked(invoke).mockImplementation((command: string) => {
    switch (command) {
      case "get_strava_credentials_available":
        return Promise.resolve(false);
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

describe("Onboarding", () => {
  it("renders step 1 with welcome and setup content", async () => {
    setupInvokeMock();

    render(<Onboarding onComplete={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText("CoachLM")).toBeInTheDocument();
    });

    expect(screen.getByText("Your personal AI running coach")).toBeInTheDocument();
  });

  it("shows Get Started button on step 1", async () => {
    setupInvokeMock();

    render(<Onboarding onComplete={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    });
  });

  it("next button advances from step 1 to step 2", async () => {
    setupInvokeMock();
    const user = userEvent.setup();

    render(<Onboarding onComplete={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByText("Connect Strava")).toBeInTheDocument();
    });
  });

  it("step indicators are visible as 4 dots", async () => {
    setupInvokeMock();

    const { container } = render(<Onboarding onComplete={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText("CoachLM")).toBeInTheDocument();
    });

    const stepDots = container.querySelectorAll("div[style*='border-radius: 50%']");
    expect(stepDots.length).toBeGreaterThanOrEqual(4);
  });

  it("calls get_strava_credentials_available on mount", async () => {
    setupInvokeMock();

    render(<Onboarding onComplete={() => undefined} />);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_strava_credentials_available");
    });
  });

  it("calls onComplete after completing setup on step 4", async () => {
    setupInvokeMock();
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<Onboarding onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => {
      expect(screen.getByText("Connect Strava")).toBeInTheDocument();
    });

    const nextOnStep2 = screen.getByRole("button", { name: /^next$/i });
    await user.click(nextOnStep2);
    await waitFor(() => {
      expect(screen.getByText("LLM Setup")).toBeInTheDocument();
    });

    const nextOnStep3 = screen.getByRole("button", { name: /^next$/i });
    await user.click(nextOnStep3);
    await waitFor(() => {
      expect(screen.getByText("All Set!")).toBeInTheDocument();
    });

    const finishButton = screen.getByRole("button", { name: /go to context/i });
    await user.click(finishButton);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", expect.anything());
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
