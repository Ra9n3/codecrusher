import { describe, expect, it } from "vitest";
import {
  BudgetCandidate,
  PLACEHOLDER_TOKENS,
  centralityScores,
  evictionOrder,
  formatTokens,
  importSpecifiers,
  isProtectedPath,
  parseBudgetInput,
  planEviction,
  stemOf,
} from "../budget";
import { estimateTokens } from "../processor";

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
