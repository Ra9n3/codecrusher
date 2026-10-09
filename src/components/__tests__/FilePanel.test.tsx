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

  const cls = (name: string) => screen.getByRole("button", { name }).className;
  const lit = (name: string) => cls(name).includes("border-amber-400/70");
  const idle = (name: string) =>
    cls(name).includes("border-zinc-800") && !cls(name).includes("border-amber-400");
  const customPill = () => screen.getByText("custom");

  it("lights All with the house border and leaves None idle when every file is included", () => {
    render(<FilePanel files={demoFiles} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(lit("All")).toBe(true);
    expect(cls("All")).toContain("bg-amber-400/10");
    expect(cls("All")).toContain("text-amber-100");
    expect(idle("None")).toBe(true);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("lights None with the house border and leaves All idle when no file is included", () => {
    render(<FilePanel files={excluded} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(lit("None")).toBe(true);
    expect(idle("All")).toBe(true);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("leaves both buttons idle and lights custom with the active recipe when the selection is mixed", () => {
    render(<FilePanel files={mixed} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(idle("All")).toBe(true);
    expect(idle("None")).toBe(true);
    const custom = customPill();
    expect(custom.className).toContain("border-amber-400/70");
    expect(custom.className).toContain("bg-amber-400/10");
    expect(custom.className).toContain("text-amber-100");
    expect(custom.getAttribute("title")).toBe("Custom selection — some files included");
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
    expect(lit("All")).toBe(true);
    for (const f of plain) {
      fireEvent.click(screen.getByLabelText(`Include ${f.path}`));
    }
    expect(lit("None")).toBe(true);
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("lights neither button and shows no custom indicator when the file list is empty", () => {
    render(<FilePanel files={[]} onToggle={() => {}} onToggleAll={() => {}} />);
    expect(idle("All")).toBe(true);
    expect(idle("None")).toBe(true);
    expect(screen.queryByText("custom")).toBeNull();
  });
});
