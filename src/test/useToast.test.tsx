import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "../hooks/useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts with no toast", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
    expect(result.current.toastElement).toBeNull();
  });

  it("shows a success toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast("Saved", "success");
    });

    expect(result.current.toast).toEqual({ message: "Saved", type: "success" });
    expect(result.current.toastElement).not.toBeNull();
  });

  it("shows an error toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast("Failed", "error");
    });

    expect(result.current.toast).toEqual({ message: "Failed", type: "error" });
  });

  it("auto-dismisses after 3 seconds", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast("Temporary", "success");
    });
    expect(result.current.toast).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.toast).toBeNull();
  });
});
