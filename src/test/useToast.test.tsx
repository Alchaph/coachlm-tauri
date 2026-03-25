import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useToast } from "../hooks/useToast";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useToast", () => {
  it("returns showToast function", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.showToast).toBeTypeOf("function");
  });

  it("calls toast.success for success type", () => {
    const { result } = renderHook(() => useToast());
    result.current.showToast("Saved", "success");
    expect(toast.success).toHaveBeenCalledWith("Saved");
  });

  it("calls toast.error for error type", () => {
    const { result } = renderHook(() => useToast());
    result.current.showToast("Failed", "error");
    expect(toast.error).toHaveBeenCalledWith("Failed");
  });
});
