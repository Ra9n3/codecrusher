import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OutputPanel from "../OutputPanel";

afterEach(cleanup);

const make = (n: number) => "a".repeat(n);

type Props = Parameters<typeof OutputPanel>[0];

function renderPanel(overrides: Partial<Props> = {}) {
  return render(
    <OutputPanel
      output={make(1_000)}
      rootName="demo"
      fileCount={3}
      profile="Balanced"
      depthLabel="Depth 2"
      {...overrides}
    />,
  );
}

describe("OutputPanel preview honesty", () => {
  it("shows no truncation banner at 59,999 characters", () => {
    renderPanel({ output: make(59_999) });
    expect(screen.queryByTestId("preview-truncated-banner")).toBeNull();
  });

  it("shows the truncation banner and counts at 60,001 characters", () => {
    renderPanel({ output: make(60_001) });
    const banner = screen.getByTestId("preview-truncated-banner");
    expect(banner.textContent).toContain("Preview shows the first 60,000 of 60,001 characters");
    expect(banner.textContent).toContain("Copy and Download always contain the full crush");
    expect(screen.getByTestId("preview-shown-chars").textContent).toBe("60,000");
    expect(screen.getByTestId("preview-total-chars").textContent).toBe("60,001");
  });

  it("keeps the banner visible in collapsed (max-h) mode", () => {
    renderPanel({ output: make(60_001) });
    expect(screen.getByTestId("preview-truncated-banner")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand preview" })).toBeTruthy();
  });

  it("keeps the banner visible in expanded mode", () => {
    renderPanel({ output: make(60_001) });
    fireEvent.click(screen.getByRole("button", { name: "Expand preview" }));
    expect(screen.getByRole("button", { name: "Collapse preview" })).toBeTruthy();
    expect(screen.getByTestId("preview-truncated-banner")).toBeTruthy();
  });

  it("rewords the trailing in-preview line to reassure Copy/Download", () => {
    renderPanel({ output: make(60_001) });
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toContain("nothing is missing from Copy/Download");
  });

  it("gives the expand button an honest title", () => {
    renderPanel({ output: make(10_000) });
    expect(screen.getByRole("button", { name: "Expand preview" }).getAttribute("title")).toBe(
      "Larger view of the preview (content cap unchanged)",
    );
  });
});

describe("OutputPanel budget nudge", () => {
  it("hides the nudge at exactly 50,000 tokens", () => {
    renderPanel({ output: make(200_000), budget: null, onBudget: () => {} });
    expect(screen.queryByTestId("budget-nudge")).toBeNull();
  });

  it("hides the nudge under the threshold", () => {
    renderPanel({ output: make(199_996), budget: null, onBudget: () => {} });
    expect(screen.queryByTestId("budget-nudge")).toBeNull();
  });

  it("shows the nudge at 50,001 tokens", () => {
    renderPanel({ output: make(200_001), budget: null, onBudget: () => {} });
    const nudge = screen.getByTestId("budget-nudge");
    expect(nudge.textContent).toContain("This crush is ~50,001 tokens");
    expect(nudge.textContent).toContain("set a budget to auto-evict the heaviest files?");
  });

  it("hides the nudge when a budget is already active", () => {
    renderPanel({ output: make(200_001), budget: 100_000, onBudget: () => {} });
    expect(screen.queryByTestId("budget-nudge")).toBeNull();
  });

  it("sets a 50k budget from the nudge button", () => {
    const onBudget = vi.fn();
    renderPanel({ output: make(200_001), budget: null, onBudget });
    fireEvent.click(screen.getByTestId("budget-nudge-50k"));
    expect(onBudget).toHaveBeenCalledWith(50_000);
  });
});
