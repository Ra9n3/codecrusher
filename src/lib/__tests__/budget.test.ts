import { describe, expect, it } from "vitest";
import {
  BudgetCandidate,
  OMITTED_NOTE_TOKENS,
  PLACEHOLDER_TOKENS,
  candidateResidualTokens,
  centralityScores,
  evictionOrder,
  formatTokens,
  importSpecifiers,
  isProtectedPath,
  parseBudgetInput,
  planEviction,
  stemOf,
} from "../budget";
import { JUNK_LABEL } from "../junk";
import {
  OutputMeta,
  RepoFile,
  estimateTokens,
  finalizeRepoFile,
  generateOutput,
  renderFileBlock,
} from "../processor";

describe("token estimation", () => {
  it("uses ceil(chars / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("x".repeat(4000))).toBe(1000);
  });
});

describe("isProtectedPath", () => {
  it("protects README and entry points by convention", () => {
    for (const p of ["README.md", "docs/README", "readme.txt", "src/index.ts", "src/main.py", "src/App.tsx", "app.js", "cmd/main.go"]) {
      expect(isProtectedPath(p), p).toBe(true);
    }
  });
  it("does not protect look-alikes", () => {
    for (const p of ["app.config.ts", "src/index.test.ts", "src/utils.ts", "src/mainframe.ts", "README-old.md"]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });
});

describe("centrality", () => {
  it("derives stems that link imports to files", () => {
    expect(stemOf("src/components/Button.tsx")).toBe("button");
    expect(stemOf("src/components/Button/index.ts")).toBe("button");
    expect(stemOf("./Button")).toBe("button");
    expect(stemOf("../lib/utils")).toBe("utils");
    expect(stemOf("src/lib/__init__.py")).toBe("lib");
  });

  it("extracts relative import specifiers without an AST", () => {
    const src = [
      'import x from "./a";',
      "import { b } from '../lib/b';",
      'const c = require("./c");',
      'import d from "react";',
      'const lazy = () => import("./lazy");',
      "from app.models import User",
    ].join("\n");
    expect(importSpecifiers(src)).toEqual(["./a", "../lib/b", "./c", "./lazy", "app/models"]);
  });

  it("ranks files referenced by many others as more central", () => {
    const files = [
      { path: "src/utils.ts", content: "export const x = 1" },
      { path: "src/components/Button.tsx", content: 'import { x } from "../utils";' },
      { path: "src/pages/Home.tsx", content: 'import { x } from "../utils";\nimport { Button } from "../components/Button";' },
    ];
    const scores = centralityScores(files);
    expect(scores.get("src/utils.ts")!).toBeGreaterThan(scores.get("src/components/Button.tsx")!);
    expect(scores.get("src/components/Button.tsx")!).toBeGreaterThan(scores.get("src/pages/Home.tsx")!);
  });
});

const candidates: BudgetCandidate[] = [
  { path: "package-lock.json", tokens: 5_000, junk: "lockfile", content: "{}" },
  { path: "src/data/huge.json", tokens: 20_000, junk: null, content: "[]" },
  { path: "src/utils.ts", tokens: 1_000, junk: null, content: "x" },
  { path: "src/components/Button.tsx", tokens: 1_000, junk: null, content: "x" },
  { path: "README.md", tokens: 3_000, junk: null, content: "#" },
  { path: "src/index.ts", tokens: 500, junk: null, content: "x" },
];
const centrality = new Map([
  ["src/utils.ts", 6],
  ["src/components/Button.tsx", 3],
]);

describe("evictionOrder", () => {
  it("evicts expanded junk, then oversized files, then least-central files; never README / entry points", () => {
    const order = evictionOrder(candidates, centrality).map((c) => c.path);
    expect(order).toEqual(["package-lock.json", "src/data/huge.json", "src/components/Button.tsx", "src/utils.ts"]);
    expect(order).not.toContain("README.md");
    expect(order).not.toContain("src/index.ts");
  });

  it("breaks centrality ties by size (largest first)", () => {
    const tie: BudgetCandidate[] = [
      { path: "src/a.ts", tokens: 100, junk: null, content: "x" },
      { path: "src/b.ts", tokens: 300, junk: null, content: "x" },
    ];
    expect(evictionOrder(tie, new Map()).map((c) => c.path)).toEqual(["src/b.ts", "src/a.ts"]);
  });
});

describe("planEviction", () => {
  it("does nothing when the selection fits", () => {
    const plan = planEviction({ candidates, baseTokens: 1_000, budget: 100_000, centrality });
    expect(plan.evicted).toEqual([]);
    expect(plan.after).toBe(plan.before);
    expect(plan.protectedOverflow).toBe(false);
  });

  it("evicts in priority order until the estimate fits, leaving placeholder cost in place", () => {
    const plan = planEviction({ candidates, baseTokens: 1_000, budget: 10_000, centrality });
    expect(plan.before).toBe(31_500);
    expect(plan.evicted).toEqual(["package-lock.json", "src/data/huge.json"]);
    expect(plan.after).toBe(31_500 - (5_000 - PLACEHOLDER_TOKENS) - (20_000 - PLACEHOLDER_TOKENS));
    expect(plan.after).toBeLessThanOrEqual(10_000);
    expect(plan.evictedMap.get("src/data/huge.json")).toBe("token budget");
    expect(plan.protectedOverflow).toBe(false);
  });

  it("reports when protected files alone exceed the budget", () => {
    const plan = planEviction({ candidates, baseTokens: 1_000, budget: 2_000, centrality });
    expect(plan.evicted).toHaveLength(4);
    expect(plan.protectedOverflow).toBe(true);
    expect(plan.evicted).not.toContain("README.md");
  });

  describe("budget boundary behavior (5% safety margin vs configured budget)", () => {
    // At budget = 10_000 and default 5% margin, planner target = floor(10_000 * 0.95) = 9_500.
    const singleEvictable = (tokens: number): BudgetCandidate[] => [
      { path: "README.md", tokens: 4_000, junk: null, content: "#" },
      { path: "src/feature.ts", tokens, junk: null, content: "x" },
    ];

    it("does not evict when comfortably below the planner target", () => {
      const plan = planEviction({
        candidates: singleEvictable(3_000),
        baseTokens: 500, // before = 7_500 < 9_500
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.before).toBe(7_500);
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(7_500);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("does not evict when selection is exactly at the planner target (9,500)", () => {
      const plan = planEviction({
        candidates: singleEvictable(5_000),
        baseTokens: 500, // before = 9_500 === target
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.before).toBe(9_500);
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(9_500);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("evicts when selection is 1 estimated token above the planner target (9,501), even though below raw budget", () => {
      const plan = planEviction({
        candidates: singleEvictable(5_001),
        baseTokens: 500, // before = 9_501 > 9_500, still < 10_000
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.before).toBe(9_501);
      expect(plan.evicted).toEqual(["src/feature.ts"]);
      expect(plan.after).toBe(9_501 - (5_001 - PLACEHOLDER_TOKENS));
      expect(plan.protectedOverflow).toBe(false);
    });

    it("evicts when selection is exactly at the configured budget (10,000 > target 9,500)", () => {
      const plan = planEviction({
        candidates: singleEvictable(5_500),
        baseTokens: 500, // before = 10_000
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.before).toBe(10_000);
      expect(plan.evicted).toEqual(["src/feature.ts"]);
      expect(plan.after).toBe(4_500 + PLACEHOLDER_TOKENS);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("evicts when selection is 1 estimated token above the configured budget (10,001)", () => {
      const plan = planEviction({
        candidates: singleEvictable(5_501),
        baseTokens: 500, // before = 10_001
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.before).toBe(10_001);
      expect(plan.evicted).toEqual(["src/feature.ts"]);
      expect(plan.after).toBe(4_500 + PLACEHOLDER_TOKENS);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("rounds the 5% margin target down via Math.floor at small and non-round budgets", () => {
      // budget = 1_001 → floor(1001 * 0.95) = floor(950.95) = 950
      const atFloor = planEviction({
        candidates: [{ path: "src/a.ts", tokens: 850, junk: null, content: "x" }],
        baseTokens: 100, // before = 950 === target
        budget: 1_001,
        centrality: new Map(),
      });
      expect(atFloor.evicted).toEqual([]);

      const aboveFloor = planEviction({
        candidates: [{ path: "src/a.ts", tokens: 851, junk: null, content: "x" }],
        baseTokens: 100, // before = 951 > 950
        budget: 1_001,
        centrality: new Map(),
      });
      expect(aboveFloor.evicted).toEqual(["src/a.ts"]);

      // Custom margin = 0 → target equals exact budget
      const zeroMargin = planEviction({
        candidates: [{ path: "src/a.ts", tokens: 900, junk: null, content: "x" }],
        baseTokens: 100,
        budget: 1_000,
        centrality: new Map(),
        margin: 0,
      });
      expect(zeroMargin.evicted).toEqual([]);
    });
  });

  describe("protected files and overflow", () => {
    it("reports protectedOverflow = false when protected content is comfortably below target", () => {
      const plan = planEviction({
        candidates: [{ path: "README.md", tokens: 2_000, junk: null, content: "#" }],
        baseTokens: 300,
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual([]);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("reports protectedOverflow = false when protected content + base is exactly at the planner target", () => {
      const plan = planEviction({
        candidates: [{ path: "README.md", tokens: 9_200, junk: null, content: "#" }],
        baseTokens: 300, // 9_500 === target for budget 10_000
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(9_500);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("reports protectedOverflow = false when protected content is exactly at the configured budget (with zero margin/base)", () => {
      const plan = planEviction({
        candidates: [{ path: "README.md", tokens: 10_000, junk: null, content: "#" }],
        baseTokens: 0,
        budget: 10_000,
        margin: 0,
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(10_000);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("reports protectedOverflow = true when protected content alone is 1 token above the configured budget", () => {
      const plan = planEviction({
        candidates: [{ path: "README.md", tokens: 10_001, junk: null, content: "#" }],
        baseTokens: 0,
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(10_001);
      expect(plan.protectedOverflow).toBe(true);
    });

    it("reports protectedOverflow = true when multiple protected files across subdirectories exceed the budget", () => {
      const multiProtected: BudgetCandidate[] = [
        { path: "README.md", tokens: 4_000, junk: null, content: "#" },
        { path: "src/index.ts", tokens: 4_500, junk: null, content: "x" },
        { path: "src/App.tsx", tokens: 5_000, junk: null, content: "x" },
        { path: "cmd/main.go", tokens: 3_000, junk: null, content: "x" },
      ];
      const plan = planEviction({
        candidates: multiProtected,
        baseTokens: 400,
        budget: 15_000, // target = 14_250; total = 16_900 > 15_000
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(16_900);
      expect(plan.protectedOverflow).toBe(true);
    });

    it("distinguishes overhead-driven overflow from protected-content overflow: protectedOverflow is false when protected content fits within the budget (9,400 <= 10,000) even when baseTokens + placeholder residuals push after (10,120) above the configured budget", () => {
      const mixed: BudgetCandidate[] = [
        { path: "README.md", tokens: 5_400, junk: null, content: "#" },
        { path: "src/index.ts", tokens: 4_000, junk: null, content: "x" },
        { path: "src/helperA.ts", tokens: 2_000, junk: null, content: "a" },
        { path: "src/helperB.ts", tokens: 2_000, junk: null, content: "b" },
      ];
      // Protected tokens alone = 9_400 (<= target 9_500 and <= budget 10_000).
      // With baseTokens = 640 and 2 evicted files leaving 2 * 40 = 80 placeholder tokens,
      // after = 9_400 + 640 + 80 = 10_120 > budget 10_000 (and > target 9_500).
      // Because protected files themselves fit within the budget, protectedOverflow must be false
      // so the UI does not falsely blame README / entry points alone.
      const plan = planEviction({
        candidates: mixed,
        baseTokens: 640,
        budget: 10_000,
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual(["src/helperA.ts", "src/helperB.ts"]);
      expect(plan.after).toBe(10_120);
      expect(plan.after).toBeGreaterThan(10_000);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("does not report protectedOverflow when protected files are between the 5% margin target and the raw budget (e.g. 9,700 tokens at a 10,000 budget)", () => {
      const candidatesNearCap: BudgetCandidate[] = [
        { path: "README.md", tokens: 9_700, junk: null, content: "#" },
        { path: "src/helper.ts", tokens: 500, junk: null, content: "a" },
      ];
      const plan = planEviction({
        candidates: candidatesNearCap,
        baseTokens: 100,
        budget: 10_000, // target = 9_500; protected = 9_700 <= 10_000; after = 9_840 <= 10_000
        centrality: new Map(),
      });
      expect(plan.evicted).toEqual(["src/helper.ts"]);
      expect(plan.after).toBe(9_840);
      expect(plan.after).toBeLessThanOrEqual(10_000);
      expect(plan.protectedOverflow).toBe(false);
    });

    it("evicts all evictable files in a mixed repo and still flags overflow when protected floor + residuals exceed target", () => {
      const mixed: BudgetCandidate[] = [
        { path: "README.md", tokens: 12_000, junk: null, content: "#" },
        { path: "src/App.tsx", tokens: 10_000, junk: null, content: "x" },
        { path: "package-lock.json", tokens: 15_000, junk: "lockfile", content: "{}" },
        { path: "src/big.ts", tokens: 9_000, junk: null, content: "x" },
        { path: "src/util.ts", tokens: 2_000, junk: null, content: "x" },
      ];
      const plan = planEviction({
        candidates: mixed,
        baseTokens: 500, // includes pre-existing collapsed placeholders in baseTokens
        budget: 20_000, // target 19_000; protected alone = 22_000
        centrality: new Map([["src/util.ts", 4]]),
      });
      expect(plan.evicted).toEqual(["package-lock.json", "src/big.ts", "src/util.ts"]);
      expect(plan.after).toBe(500 + 22_000 + 3 * PLACEHOLDER_TOKENS);
      expect(plan.protectedOverflow).toBe(true);
    });
  });

  describe("eviction accounting invariants", () => {
    it("orders tiers deterministically: expanded junk -> oversized -> tier 2 by ascending centrality, descending size, then path", () => {
      const list: BudgetCandidate[] = [
        { path: "src/z.ts", tokens: 600, junk: null, content: "x" },
        { path: "src/a.ts", tokens: 600, junk: null, content: "x" },
        { path: "src/mid.ts", tokens: 900, junk: null, content: "x" },
        { path: "src/central.ts", tokens: 2_000, junk: null, content: "x" },
        { path: "src/oversized-small.ts", tokens: 9_000, junk: null, content: "x" },
        { path: "src/oversized-big.ts", tokens: 12_000, junk: null, content: "x" },
        { path: "dist/bundle.min.js", tokens: 3_000, junk: "minified", content: "x" },
        { path: "pnpm-lock.yaml", tokens: 7_000, junk: "lockfile", content: "x" },
        { path: "README.md", tokens: 50_000, junk: null, content: "#" },
        { path: "src/main.ts", tokens: 50_000, junk: null, content: "x" },
      ];
      const scores = new Map<string, number>([
        ["src/a.ts", 1],
        ["src/z.ts", 1],
        ["src/mid.ts", 1],
        ["src/central.ts", 10],
      ]);
      const order = evictionOrder(list, scores).map((c) => c.path);
      expect(order).toEqual([
        // Tier 0: junk, largest first
        "pnpm-lock.yaml",
        "dist/bundle.min.js",
        // Tier 1: oversized (> max(8000, 3 * median)), largest first
        "src/oversized-big.ts",
        "src/oversized-small.ts",
        // Tier 2: centrality 1 (mid=900 first, then a.ts vs z.ts lexical tie-break), then centrality 10
        "src/mid.ts",
        "src/a.ts",
        "src/z.ts",
        "src/central.ts",
      ]);
    });

    it("skips evicting a tiny file whose token count is <= its placeholder residual so eviction never inflates output", () => {
      const tinyCandidates: BudgetCandidate[] = [
        { path: "README.md", tokens: 940, junk: null, content: "#" },
        { path: "src/tiny.ts", tokens: 25, junk: null, content: "x" },
      ];
      const plan = planEviction({
        candidates: tinyCandidates,
        baseTokens: 0,
        budget: 1_000, // target 950; before = 965 > 950
        centrality: new Map(),
      });
      expect(plan.before).toBe(965);
      expect(plan.evicted).toEqual([]);
      expect(plan.after).toBe(965);
      expect(plan.after).toBeLessThanOrEqual(plan.before);
      expect(plan.protectedOverflow).toBe(false);
    });
  });

  describe("planner versus generated output consistency", () => {
    const BASE_HEADER_TOKENS = 260;
    const TREE_LINE_TOKENS = 9;

    const meta: OutputMeta = {
      rootName: "test-repo",
      profile: "Everything",
      intent: "Review architecture and core modules.",
      depth: "full",
    };

    function makeRepoFile(path: string, content: string | null, collapsedOverride?: boolean): RepoFile {
      const f = finalizeRepoFile({
        path,
        size: content?.length ?? 4096,
        content,
        skippedReason: content === null ? "binary" : undefined,
      });
      if (collapsedOverride !== undefined) f.collapsed = collapsedOverride;
      return f;
    }

    function runPipeline(
      files: RepoFile[],
      budget: number,
      skippedDirs: string[] = [],
      customIntent?: string,
    ) {
      const activeMeta: OutputMeta = customIntent ? { ...meta, intent: customIntent } : meta;
      const candidates: BudgetCandidate[] = files
        .filter((f) => f.included && !f.collapsed && f.content !== null)
        .map((f) => ({
          path: f.path,
          tokens: estimateTokens(renderFileBlock(f, activeMeta)),
          junk: f.junk,
          content: f.content,
          lines: f.lines,
          size: f.size,
        }));
      const placeholderFiles = files.filter((f) => f.included && (f.collapsed || f.content === null));
      const placeholderTokens = placeholderFiles.reduce(
        (sum, f) =>
          sum +
          candidateResidualTokens(
            {
              path: f.path,
              tokens: 0,
              junk: f.junk,
              content: f.content,
              lines: f.lines,
              size: f.size,
              junkLabel: f.junkLabel,
            },
            f.junkLabel ?? JUNK_LABEL[f.junk ?? (f.content === null ? "binary" : "build-output")],
          ),
        0,
      );
      const treeDirs = new Set<string>();
      for (const f of files) {
        if (!f.included) continue;
        const parts = f.path.split("/");
        for (let i = 1; i < parts.length; i++) {
          treeDirs.add(parts.slice(0, i).join("/"));
        }
      }
      const treeLines =
        candidates.length +
        placeholderFiles.length +
        skippedDirs.length +
        treeDirs.size;
      const skippedDirsTokens = skippedDirs.length > 0 ? estimateTokens(skippedDirs.join(", ")) : 0;
      const intentExtraTokens = Math.max(0, estimateTokens(activeMeta.intent) - 35);
      const baseTokens =
        BASE_HEADER_TOKENS +
        treeLines * TREE_LINE_TOKENS +
        placeholderTokens +
        skippedDirsTokens +
        intentExtraTokens;
      const centrality = centralityScores(files);
      const plan = planEviction({
        candidates,
        baseTokens,
        budget,
        centrality,
        firstEvictionOverhead: placeholderFiles.length === 0 ? OMITTED_NOTE_TOKENS : 0,
      });
      const output = generateOutput(files, {
        ...activeMeta,
        evicted: plan.evictedMap,
        skippedDirs,
        budget,
      });
      const measuredTokens = estimateTokens(output);
      return { plan, output, measuredTokens, baseTokens };
    }

    it("1. small repository that fits comfortably: no eviction and measured output stays well below budget", () => {
      const files = [
        makeRepoFile("README.md", "# Small Repo\n\nOverview of the project.\n"),
        makeRepoFile("src/index.ts", 'import { helper } from "./helper";\nexport const run = () => helper();\n'),
        makeRepoFile("src/helper.ts", "export const helper = () => 42;\n"),
      ];
      const { plan, measuredTokens } = runPipeline(files, 30_000);
      expect(plan.evicted).toEqual([]);
      expect(plan.protectedOverflow).toBe(false);
      expect(measuredTokens).toBeLessThanOrEqual(30_000);
    });

    it("2. repository that triggers evictions: evicted files render as placeholders and measured output fits within budget", () => {
      const files = [
        makeRepoFile("README.md", "# Service\n".repeat(40)),
        makeRepoFile("src/index.ts", 'import { a } from "./a";\nexport const main = () => a();\n'),
        makeRepoFile("src/a.ts", "export const a = () => {\n" + "  const step = 1;\n".repeat(900) + "};\n"),
        makeRepoFile("src/b.ts", "export const b = () => {\n" + "  const work = 2;\n".repeat(1200) + "};\n"),
        makeRepoFile("src/c.ts", "export const c = () => {\n" + "  const item = 3;\n".repeat(1200) + "};\n"),
      ];
      const { plan, output, measuredTokens } = runPipeline(files, 10_000);
      expect(plan.evicted.length).toBeGreaterThan(0);
      expect(plan.protectedOverflow).toBe(false);
      expect(measuredTokens).toBeLessThanOrEqual(10_000);
      for (const p of plan.evicted) {
        expect(output).toContain(`omitted: ${p} (token budget)]`);
      }
    });

    it("3. repository with pre-existing collapsed junk and binary placeholders stays consistent", () => {
      const files = [
        makeRepoFile("README.md", "# App\n"),
        makeRepoFile("package-lock.json", '{\n  "lockfileVersion": 3\n}\n'.repeat(300)), // auto-collapsed lockfile
        makeRepoFile("assets/logo.png", null), // binary placeholder
        makeRepoFile("src/feature.ts", "export const v = 'x';\n".repeat(1500)),
      ];
      const { plan, output, measuredTokens } = runPipeline(files, 5_000, ["node_modules", ".git"]);
      expect(plan.evicted).toContain("src/feature.ts");
      expect(plan.protectedOverflow).toBe(false);
      expect(measuredTokens).toBeLessThanOrEqual(5_000);
      expect(output).toContain("(lockfile)");
      expect(output).toContain("(binary)");
      expect(output).toContain("(token budget)");
    });

    it("4. repository where protected files dominate the output reports protectedOverflow and measured output also exceeds budget", () => {
      const files = [
        makeRepoFile("README.md", "# Huge Documentation\n" + "Detailed paragraph of documentation.\n".repeat(600)),
        makeRepoFile("src/index.ts", "export const boot = () => {\n" + "  init();\n".repeat(600) + "};\n"),
        makeRepoFile("src/leaf.ts", "export const leaf = 1;\n".repeat(100)),
      ];
      const protectedTokens = files
        .filter((f) => isProtectedPath(f.path))
        .reduce((sum, f) => sum + estimateTokens(renderFileBlock(f, meta)), 0);
      expect(protectedTokens).toBeGreaterThan(5_000);

      const { plan, measuredTokens } = runPipeline(files, 5_000);
      expect(plan.evicted).toEqual(["src/leaf.ts"]);
      expect(plan.protectedOverflow).toBe(true);
      expect(measuredTokens).toBeGreaterThan(5_000);
    });

    it("5. repository with heavy header/tree/placeholder overhead (many files in deep paths): when protectedOverflow is false, measured output does not exceed the configured budget", () => {
      // 80 files with deep paths and ~1,800 chars (~460 tokens) each -> total ~38k tokens.
      // At a 30,000 budget, ~25-30 files get evicted. Each evicted file leaves a placeholder block (~52 tokens)
      // plus a tree note (~9 tokens) = ~61 tokens, whereas flat PLACEHOLDER_TOKENS is 40.
      const files: RepoFile[] = [
        makeRepoFile("README.md", "# Monorepo\n".repeat(30)),
        makeRepoFile("src/index.ts", "export const root = true;\n".repeat(20)),
        ...Array.from({ length: 80 }, (_, i) => {
          const pkg = `packages/pkg-${String(i % 8).padStart(2, "0")}/src/modules/mod-${String(i).padStart(3, "0")}`;
          const path = `${pkg}/service-${String(i).padStart(3, "0")}.ts`;
          const body = `export function service${i}() {\n` + `  const line = "${path}";\n`.repeat(30) + `  return line;\n}\n`;
          return makeRepoFile(path, body);
        }),
      ];
      const { plan, measuredTokens } = runPipeline(files, 30_000, ["node_modules", ".git", "dist"]);
      expect(plan.protectedOverflow).toBe(false);
      expect(measuredTokens).toBeLessThanOrEqual(30_000);
      // Planner's after estimate agrees with the rendered output within the 5% margin window
      expect(Math.abs(plan.after - measuredTokens)).toBeLessThan(1_500);
    });

    it("6. Case 2 end-to-end: protected files fit within the budget, but header, directory tree, and placeholders push the generated output over the budget", () => {
      // Protected files alone (README.md + src/index.ts) are ~3,800 tokens (< 5,000 budget).
      // However, 25 collapsed/binary placeholder files and 20 evictable files in nested directories
      // add ~1,800 tokens of unavoidable header + tree + placeholder overhead, pushing total > 5,000.
      const files: RepoFile[] = [
        makeRepoFile("README.md", "# Project\n" + " Core overview line.\n".repeat(450)),
        makeRepoFile("src/index.ts", "export const boot = () => {\n" + "  step();\n".repeat(450) + "};\n"),
        ...Array.from({ length: 25 }, (_, i) =>
          makeRepoFile(`assets/icons/icon-${String(i).padStart(2, "0")}.png`, null),
        ),
        ...Array.from({ length: 20 }, (_, i) =>
          makeRepoFile(
            `packages/mod-${String(i).padStart(2, "0")}/src/handler-${String(i).padStart(2, "0")}.ts`,
            `export const handler${i} = () => {\n` + `  return ${i};\n`.repeat(60) + `};\n`,
          ),
        ),
      ];
      const protectedBlockTokens =
        estimateTokens(renderFileBlock(files[0], meta)) +
        estimateTokens(renderFileBlock(files[1], meta));
      expect(protectedBlockTokens).toBeLessThan(5_000);

      const { plan, measuredTokens } = runPipeline(files, 5_000, ["node_modules", ".git", "dist"]);
      // Every evictable file was evicted
      expect(plan.evicted).toHaveLength(20);
      // Both the planner's after estimate and the final generated output exceed the 5,000 budget
      expect(plan.after).toBeGreaterThan(5_000);
      expect(measuredTokens).toBeGreaterThan(5_000);
      // Protected files alone did NOT exceed the budget, so protectedOverflow is false
      expect(plan.protectedOverflow).toBe(false);
    });

    it("7. Case 3 end-to-end: planner and final output agree when deep nested directories, first-eviction omittedNote, and long custom intent are present", () => {
      const longIntent = "Verify every module boundary and security invariant in detail. ".repeat(20);
      const files: RepoFile[] = [
        makeRepoFile("README.md", "# Deep Repo\n".repeat(50)),
        makeRepoFile("src/index.ts", "export const entry = 1;\n".repeat(50)),
        ...Array.from({ length: 12 }, (_, i) =>
          makeRepoFile(
            `apps/web/src/features/feat-${i}/components/comp-${i}/view-${i}.tsx`,
            `export const View${i} = () => {\n` + `  const row = "item-${i}";\n`.repeat(80) + `  return row;\n};\n`,
          ),
        ),
      ];
      const { plan, measuredTokens } = runPipeline(files, 6_000, ["node_modules", ".git"], longIntent);
      // Planner and actual generated-output estimates agree on whether this repository fits.
      expect(plan.after <= 6_000).toBe(measuredTokens <= 6_000);
      expect(plan.after).toBeLessThanOrEqual(6_000);
      expect(measuredTokens).toBeLessThanOrEqual(6_000);
      expect(Math.abs(plan.after - measuredTokens)).toBeLessThan(1_500);
      expect(plan.protectedOverflow).toBe(false);
    });
  });
});

describe("budget input / formatting", () => {
  it("parses human budgets", () => {
    expect(parseBudgetInput("150k")).toBe(150_000);
    expect(parseBudgetInput("1.5m")).toBe(1_500_000);
    expect(parseBudgetInput("200,000")).toBe(200_000);
    expect(parseBudgetInput("abc")).toBeNull();
    expect(parseBudgetInput("500")).toBeNull();
    expect(parseBudgetInput("")).toBeNull();
  });
  it("formats compactly", () => {
    expect(formatTokens(50_000)).toBe("50k");
    expect(formatTokens(1_500)).toBe("1.5k");
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(999)).toBe("999");
  });
});
