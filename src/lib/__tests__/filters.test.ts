import { describe, expect, it } from "vitest";
import {
  ALL_CATEGORIES,
  DEFAULT_FILTER,
  FilterState,
  applyFilter,
  bulkFilterState,
} from "../filters";
import { ALL_LAYERS } from "../layers";
import { mkFile } from "../../components/__tests__/fixtures";

const custom: FilterState = {
  categories: ["api", "docs"],
  layers: ["ui", "tests"],
  depth: "essentials",
  intent: "custom intent",
  pathInclude: "src/api",
  pathExclude: "legacy",
  extensions: ["ts", "tsx"],
};

describe("bulkFilterState", () => {
  it("include=true lights every category and layer", () => {
    const next = bulkFilterState(custom, true);
    expect([...next.categories].sort()).toEqual([...ALL_CATEGORIES].sort());
    expect([...next.layers].sort()).toEqual([...ALL_LAYERS].sort());
  });

  it("include=false darkens every category but leaves layers untouched", () => {
    const next = bulkFilterState(custom, false);
    expect(next.categories).toEqual([]);
    expect(next.layers).toEqual(custom.layers);
  });

  it("passes depth, extensions, paths and intent through untouched", () => {
    for (const include of [true, false]) {
      const next = bulkFilterState(custom, include);
      expect(next.depth).toBe(custom.depth);
      expect(next.intent).toBe(custom.intent);
      expect(next.pathInclude).toBe(custom.pathInclude);
      expect(next.pathExclude).toBe(custom.pathExclude);
      expect(next.extensions).toEqual(custom.extensions);
    }
  });

  it("does not mutate the incoming state", () => {
    const snapshot = JSON.parse(JSON.stringify(custom)) as FilterState;
    bulkFilterState(custom, true);
    bulkFilterState(custom, false);
    expect(custom).toEqual(snapshot);
  });
});

describe("All/None never pin files", () => {
  const files = [
    mkFile("src/api/users.ts", "export const users = 1"),
    mkFile("README.md", "# readme"),
    mkFile("src/components/Button.tsx", "export function Button() { return <button /> }"),
  ];

  it("applying bulk all leaves pinned false everywhere", () => {
    const applied = applyFilter(files, bulkFilterState(DEFAULT_FILTER, true));
    expect(applied.every((f) => !f.pinned)).toBe(true);
  });

  it("applying bulk none leaves pinned false everywhere", () => {
    const applied = applyFilter(files, bulkFilterState(DEFAULT_FILTER, false));
    expect(applied.every((f) => !f.pinned)).toBe(true);
  });

  it("None excludes every unpinned file and All brings them all back", () => {
    const none = applyFilter(files, bulkFilterState(DEFAULT_FILTER, false));
    expect(none.every((f) => !f.included)).toBe(true);
    const all = applyFilter(none, bulkFilterState(DEFAULT_FILTER, true));
    expect(all.every((f) => f.included)).toBe(true);
  });

  it("keeps a manually pinned file included across None and All", () => {
    const pinned = files.map((f) =>
      f.path === "src/api/users.ts" ? { ...f, pinned: true } : f,
    );
    const none = applyFilter(pinned, bulkFilterState(DEFAULT_FILTER, false));
    expect(none.find((f) => f.path === "src/api/users.ts")!.included).toBe(true);
    const all = applyFilter(none, bulkFilterState(DEFAULT_FILTER, true));
    expect(all.every((f) => f.included)).toBe(true);
  });
});
