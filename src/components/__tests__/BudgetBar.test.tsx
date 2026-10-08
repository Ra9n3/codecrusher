import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BudgetBar from "../BudgetBar";

afterEach(cleanup);

describe("BudgetBar", () => {
  it("shows X / Y tokens used and turns red when over budget", () => {
    render(<BudgetBar budget={100_000} used={120_000} evictedCount={0} protectedOverflow={false} onBudget={() => {}} />);
    const indicator = screen.getByTestId("budget-indicator");
    expect(indicator.textContent).toBe("120,000 / 100,000 tokens used");
    expect(indicator.className).toContain("text-red-400");
  });

  it("is green when under budget and states the estimation method", () => {
    render(<BudgetBar budget={100_000} used={40_000} evictedCount={3} protectedOverflow={false} onBudget={() => {}} />);
    expect(screen.getByTestId("budget-indicator").className).toContain("text-emerald-300");
    expect(screen.getByText(/3 files auto-evicted/)).toBeTruthy();
    expect(screen.getByText(/characters ÷ 4/)).toBeTruthy();
  });

  it("applies presets, custom values and Off", () => {
    const onBudget = vi.fn();
    render(<BudgetBar budget={null} used={10} evictedCount={0} protectedOverflow={false} onBudget={onBudget} />);
    fireEvent.click(screen.getByRole("button", { name: "50k" }));
    expect(onBudget).toHaveBeenCalledWith(50_000);

    const input = screen.getByLabelText("Custom token budget");
    fireEvent.change(input, { target: { value: "150k" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onBudget).toHaveBeenCalledWith(150_000);

    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(onBudget).toHaveBeenCalledWith(null);
  });

  it("warns when protected files alone overflow", () => {
    render(<BudgetBar budget={1_000} used={5_000} evictedCount={9} protectedOverflow onBudget={() => {}} />);
    expect(screen.getByText(/README \/ entry points alone exceed the budget/)).toBeTruthy();
  });
});
