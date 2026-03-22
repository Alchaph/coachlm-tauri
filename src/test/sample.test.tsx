import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BUILT_IN_SHOES } from "../data/shoes";

describe("BUILT_IN_SHOES", () => {
  it("contains at least one shoe", () => {
    expect(BUILT_IN_SHOES.length).toBeGreaterThan(0);
  });

  it("every shoe has a non-empty id and name", () => {
    for (const shoe of BUILT_IN_SHOES) {
      expect(shoe.id).toBeTruthy();
      expect(shoe.name).toBeTruthy();
    }
  });

  it("supershoes have carbon plates", () => {
    const supershoes = BUILT_IN_SHOES.filter((s) => s.tier === "supershoe");
    for (const shoe of supershoes) {
      expect(shoe.hasCarbonPlate).toBe(true);
    }
  });
});

describe("Sample render test", () => {
  it("renders a simple element", () => {
    render(<div data-testid="hello">Hello</div>);
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello");
  });
});
