import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
