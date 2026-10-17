import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BudgetBar from "../BudgetBar";
import { BUDGET_PRESETS } from "../../lib/budget";

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

  it("suggests levers when protected files alone exceed the budget", () => {
    render(<BudgetBar budget={1_000} used={5_000} evictedCount={4} protectedOverflow onBudget={() => {}} />);
    const line = screen.getByText(/Signatures only/);
    expect(line.textContent).toContain("raise the budget");
    expect(line.textContent).toContain("narrower selection");
    expect(line.textContent).toContain("can't be evicted");
  });

  it("omits the levers when there is no protected overflow", () => {
    render(<BudgetBar budget={100_000} used={40_000} evictedCount={3} protectedOverflow={false} onBudget={() => {}} />);
    expect(screen.queryByText(/Signatures only/)).toBeNull();
  });

  it("offers a 30k preset alongside the others", () => {
    expect(BUDGET_PRESETS).toContain(30_000);
  });

  it("renders a 30k preset button", () => {
    render(<BudgetBar budget={null} used={10} evictedCount={0} protectedOverflow={false} onBudget={() => {}} />);
    expect(screen.getByRole("button", { name: "30k" })).toBeTruthy();
  });

  it("applies the 30k preset on click", () => {
    const onBudget = vi.fn();
    render(<BudgetBar budget={null} used={10} evictedCount={0} protectedOverflow={false} onBudget={onBudget} />);
    fireEvent.click(screen.getByRole("button", { name: "30k" }));
    expect(onBudget).toHaveBeenCalledWith(30_000);
  });

  it("shows exact budget usage in green when used equals budget and turns red 1 token above budget", () => {
    const { rerender } = render(
      <BudgetBar budget={30_000} used={30_000} evictedCount={2} protectedOverflow={false} onBudget={() => {}} />,
    );
    expect(screen.getByTestId("budget-indicator").className).toContain("text-emerald-300");

    rerender(
      <BudgetBar budget={30_000} used={30_001} evictedCount={2} protectedOverflow={false} onBudget={() => {}} />,
    );
    expect(screen.getByTestId("budget-indicator").className).toContain("text-red-400");
    expect(screen.queryByText(/Signatures only/)).toBeNull();
  });

  it("distinguishes Case 1 (protected files alone overflow) from Case 2 (protected files fit, but overhead/placeholders push total over budget)", () => {
    const { rerender, container } = render(
      <BudgetBar budget={30_000} used={31_200} evictedCount={5} protectedOverflow={false} onBudget={() => {}} />,
    );
    // Case 2: over budget -> red indicator and red progress bar, eviction count shown,
    // but NO "README / entry points alone exceed the budget" warning
    expect(screen.getByTestId("budget-indicator").textContent).toBe("31,200 / 30,000 tokens used");
    expect(screen.getByTestId("budget-indicator").className).toContain("text-red-400");
    expect(container.querySelector(".bg-red-500")).toBeTruthy();
    expect(screen.getByText(/5 files auto-evicted/)).toBeTruthy();
    expect(screen.queryByText(/README \/ entry points alone exceed the budget/)).toBeNull();

    // Case 1: protected files themselves exceed the budget -> shows the protected-overflow warning and levers
    rerender(
      <BudgetBar budget={30_000} used={45_000} evictedCount={5} protectedOverflow={true} onBudget={() => {}} />,
    );
    expect(screen.getByTestId("budget-indicator").className).toContain("text-red-400");
    expect(screen.getByText(/README \/ entry points alone exceed the budget/)).toBeTruthy();
    expect(screen.getByText(/Signatures only/)).toBeTruthy();
  });
});
