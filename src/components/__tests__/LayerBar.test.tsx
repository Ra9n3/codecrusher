import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_LAYERS } from "../../lib/layers";
import LayerBar from "../LayerBar";
import { demoFiles } from "./fixtures";

afterEach(cleanup);

const tokensOf = () => 1000;

describe("LayerBar", () => {
  it("renders the built-in presets and all twelve layers with counts", () => {
    render(<LayerBar files={demoFiles} layers={ALL_LAYERS} tokensOf={tokensOf} onToggleLayer={() => {}} onPreset={() => {}} shareUrl="http://x/?layers=ui" />);
    for (const name of ["UI review", "Architecture", "Backend deep-dive", "Everything but tests"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    // README → docs: 1 file, ≈1k tokens
    expect(screen.getByLabelText("Docs layer").closest("label")!.textContent).toContain("1 · ≈1k");
  });

  it("toggles a layer and applies presets", () => {
    const onToggleLayer = vi.fn();
    const onPreset = vi.fn();
    render(<LayerBar files={demoFiles} layers={ALL_LAYERS} tokensOf={tokensOf} onToggleLayer={onToggleLayer} onPreset={onPreset} shareUrl="" />);
    fireEvent.click(screen.getByLabelText("State layer"));
    expect(onToggleLayer).toHaveBeenCalledWith("state");
    fireEvent.click(screen.getByRole("button", { name: "UI review" }));
    expect(onPreset).toHaveBeenCalledWith("ui-review");
  });

  it("reflects the active preset and counts files in the selected layers", () => {
    render(<LayerBar files={demoFiles} layers={["design-assets", "ui", "routing"]} tokensOf={tokensOf} onToggleLayer={() => {}} onPreset={() => {}} shareUrl="" />);
    // App.tsx (ui) + logo.png (design-assets)
    expect(screen.getByText("2 files")).toBeTruthy();
    expect(screen.queryByText("custom mix")).toBeNull();
  });
});
