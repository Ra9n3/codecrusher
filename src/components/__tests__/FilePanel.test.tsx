import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePanel from "../FilePanel";
import { demoFiles } from "./fixtures";

afterEach(cleanup);

function rowFor(path: string): HTMLElement {
  const label = screen.getByTitle(path);
  return label.closest('[data-testid="file-row"]') as HTMLElement;
}

describe("FilePanel", () => {
  it("renders collapsed junk dimmed with an omitted-line count and lets the user expand it", () => {
    const onToggle = vi.fn();
    render(<FilePanel files={demoFiles} onToggle={onToggle} onToggleAll={() => {}} />);

    const row = rowFor("package-lock.json");
    expect(row.getAttribute("data-collapsed")).toBe("true");
    expect(within(row).getByText("2 lines omitted · lockfile")).toBeTruthy();

    const checkbox = within(row).getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith("package-lock.json");
  });

  it("shows binary files as non-selectable placeholders", () => {
    render(<FilePanel files={demoFiles} onToggle={() => {}} onToggleAll={() => {}} />);
    const row = rowFor("public/logo.png");
    const checkbox = within(row).getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(within(row).getByText(/omitted · binary/)).toBeTruthy();
  });

  it("shows a layer badge per file and reassigns through the badge", () => {
    const onReassign = vi.fn();
    render(<FilePanel files={demoFiles} onToggle={() => {}} onToggleAll={() => {}} onReassignLayer={onReassign} />);

    const row = rowFor("src/store/cartSlice.ts");
    const badge = within(row).getByTestId("layer-badge");
    expect(badge.textContent).toBe("state");

    fireEvent.click(badge);
    const select = within(row).getByLabelText("Layer for src/store/cartSlice.ts") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "business-logic" } });
    expect(onReassign).toHaveBeenCalledWith("src/store/cartSlice.ts", "business-logic");
  });

  it("lists directories that were not scanned and marks budget-evicted files", () => {
    render(
      <FilePanel
        files={demoFiles}
        skippedDirs={["node_modules", ".git"]}
        evicted={new Map([["src/App.tsx", "token budget"]])}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />
    );
    expect(screen.getByTestId("skipped-dirs").textContent).toContain("node_modules/");
    expect(within(rowFor("src/App.tsx")).getByText("evicted · budget")).toBeTruthy();
  });

  it("counts full vs collapsed files in the header", () => {
    render(<FilePanel files={demoFiles} onToggle={() => {}} onToggleAll={() => {}} />);
    // README, App.tsx, cartSlice are full; lockfile + png are collapsed placeholders
    expect(screen.getByText(/\(3 in the crush · 2 collapsed\)/)).toBeTruthy();
  });
});
