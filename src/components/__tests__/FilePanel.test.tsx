import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassifiedFile } from "../../lib/filters";
import FilePanel from "../FilePanel";
import { demoFiles, mkFile } from "./fixtures";

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

describe("FilePanel All/None mirror the selection", () => {
  const excluded = demoFiles.map((f) => ({ ...f, included: false }));
  const mixed = demoFiles.map((f, i) => (i === 0 ? { ...f, included: false } : f));

  const accented = (name: string) =>
    screen.getByRole("button", { name }).className.includes("text-amber-200");

  it("accents All and not None when every file is included", () => {
    render(<FilePanel files={demoFiles} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(accented("All")).toBe(true);
    expect(accented("None")).toBe(false);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("accents None and not All when no file is included", () => {
    render(<FilePanel files={excluded} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(accented("None")).toBe(true);
    expect(accented("All")).toBe(false);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("accents neither button and shows a muted custom indicator when the selection is mixed", () => {
    render(<FilePanel files={mixed} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(accented("All")).toBe(false);
    expect(accented("None")).toBe(false);
    expect(screen.getByText("custom")).toBeTruthy();
  });

  it("mirrors the user excluding files one by one until None lights up", () => {
    const plain = [
      mkFile("src/a.ts", "export const a = 1"),
      mkFile("src/b.ts", "export const b = 2"),
      mkFile("src/c.ts", "export const c = 3"),
    ];
    function Controlled({ initial }: { initial: ClassifiedFile[] }) {
      const [files, setFiles] = useState(initial);
      return (
        <FilePanel
          files={files}
          onToggle={(path) =>
            setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, included: !f.included } : f)))
          }
          onToggleAll={() => {}}
        />
      );
    }
    render(<Controlled initial={plain} />);
    expect(accented("All")).toBe(true);
    for (const f of plain) {
      fireEvent.click(screen.getByLabelText(`Include ${f.path}`));
    }
    expect(accented("None")).toBe(true);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("accents neither button when the file list is empty", () => {
    render(<FilePanel files={[]} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(accented("All")).toBe(false);
    expect(accented("None")).toBe(false);
    expect(screen.queryByText("custom")).toBeNull();
  });
});
