/**
 * Token budget: estimate per-file cost, decide which files to evict (and in
 * which order) when the selection does not fit. Pure functions, unit-tested.
 *
 * Estimation method: ceil(characters / 4) — the same `estimateTokens` the rest
 * of the app uses. Stated in the UI next to the indicator.
 */

import type { JunkKind } from "./junk";

export const BUDGET_PRESETS = [50_000, 100_000, 200_000, 500_000] as const;
export const BUDGET_EVICTED_REASON = "token budget";

/** Approximate size of a one-line placeholder block. */
export const PLACEHOLDER_TOKENS = 40;

export interface BudgetCandidate {
  path: string;
  /** Tokens of the rendered block (header + fenced content). */
  tokens: number;
  junk: JunkKind | null;
  /** Expanded junk (lockfile the user opted back in, minified bundle …) is evicted first. */
  content: string | null;
}

export interface EvictionPlan {
  /** Paths evicted, in eviction order. */
  evicted: string[];
  evictedMap: Map<string, string>;
  /** Tokens before eviction (base + all blocks). */
  before: number;
  /** Estimated tokens after eviction. */
  after: number;
  /** True when even the protected files alone do not fit. */
  protectedOverflow: boolean;
}

/**
 * README and entry-point files are never evicted.
 * Entry points by convention: index.*, main.*, app.* (exactly one extension, e.g. App.tsx — not app.config.ts).
 */
export function isProtectedPath(path: string): boolean {
  const name = (path.split("/").pop() || "").toLowerCase();
  if (/^readme(\.[a-z0-9]+)?$/.test(name)) return true;
  return /^(index|main|app)\.[a-z0-9]+$/.test(name);
}

const IMPORT_RE = /(?:^|\s)(?:import|export)\s[^;'"]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|\W)(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)|^\s*from\s+([\w.]+)\s+import\b/gm;

/** Stem used to link imports to files: basename without extension, "/index" collapsed to the directory name. */
export function stemOf(path: string): string {
  const clean = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = clean.split("/");
  let base = parts[parts.length - 1] || "";
  base = base.replace(/\.[^.]+$/, "").replace(/\.(d|test|spec|stories)$/, "");
  if ((base === "index" || base === "mod" || base === "__init__") && parts.length > 1) return parts[parts.length - 2].toLowerCase();
  return base.toLowerCase();
}

/** Extracts relative/aliased import specifiers from source text (no AST). */
export function importSpecifiers(content: string): string[] {
  const out: string[] = [];
  const head = content.length > 200_000 ? content.slice(0, 200_000) : content;
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(head))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    if (m[3]) {
      // python: from a.b.c import x → "a/b/c"
      out.push(spec.replace(/^\.+/, "").replace(/\./g, "/"));
      continue;
    }
    if (/^(\.{1,2}\/|\/|@\/|~\/|#\/|src\/|\$lib\/|\$app\/)/.test(spec) || (!spec.startsWith("@") && !/^[a-z0-9_-]+$/i.test(spec.split("/")[0]))) {
      out.push(spec);
    } else if (/^(\.{1,2})$/.test(spec)) {
      out.push(spec);
    }
  }
  return out;
}

/**
 * Centrality: how many *other* files reference this file by stem (cheap import graph)
 * plus a small bonus for shallow paths. Higher = more central = evicted later.
 */
export function centralityScores(files: { path: string; content: string | null }[]): Map<string, number> {
  const inbound = new Map<string, number>();
  for (const f of files) {
    if (!f.content) continue;
    const own = stemOf(f.path);
    const seen = new Set<string>();
    for (const spec of importSpecifiers(f.content)) {
      const stem = stemOf(spec);
      if (!stem || stem === own || seen.has(stem)) continue;
      seen.add(stem);
      inbound.set(stem, (inbound.get(stem) || 0) + 1);
    }
  }
  const scores = new Map<string, number>();
  for (const f of files) {
    const depth = f.path.split("/").length - 1;
    const refs = inbound.get(stemOf(f.path)) || 0;
    scores.set(f.path, refs * 2 + Math.max(0, 3 - depth));
  }
  return scores;
}

export interface PlanInput {
  candidates: BudgetCandidate[];
  /** Tokens of header + directory tree + footer. */
  baseTokens: number;
  budget: number;
  centrality: Map<string, number>;
  /** Safety margin (fraction) so the final measured output lands under budget. */
  margin?: number;
}

/**
 * Eviction order:
 *   1. expanded junk (lockfiles, minified, generated, build output) — largest first
 *   2. oversized files (> max(8k tokens, 3 × median)) — largest first
 *   3. everything else — least central first, then largest first
 * README / index.* / main.* / app.* are never evicted.
 */
export function evictionOrder(candidates: BudgetCandidate[], centrality: Map<string, number>): BudgetCandidate[] {
  const evictable = candidates.filter((c) => !isProtectedPath(c.path));
  const sizes = evictable.map((c) => c.tokens).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const oversized = Math.max(8_000, median * 3);

  const tier = (c: BudgetCandidate): number => {
    if (c.junk) return 0;
    if (c.tokens > oversized) return 1;
    return 2;
  };
  return [...evictable].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 2) {
      const ca = centrality.get(a.path) ?? 0;
      const cb = centrality.get(b.path) ?? 0;
      if (ca !== cb) return ca - cb; // least central first
    }
    if (a.tokens !== b.tokens) return b.tokens - a.tokens; // largest first
    return a.path.localeCompare(b.path);
  });
}

export function planEviction(input: PlanInput): EvictionPlan {
  const margin = input.margin ?? 0.05;
  const target = Math.floor(input.budget * (1 - margin));
  const before = input.baseTokens + input.candidates.reduce((s, c) => s + c.tokens, 0);
  const evicted: string[] = [];
  const evictedMap = new Map<string, string>();
  let after = before;

  if (after <= target) return { evicted, evictedMap, before, after, protectedOverflow: false };

  for (const c of evictionOrder(input.candidates, input.centrality)) {
    if (after <= target) break;
    evicted.push(c.path);
    evictedMap.set(c.path, BUDGET_EVICTED_REASON);
    after -= c.tokens - PLACEHOLDER_TOKENS;
  }
  return { evicted, evictedMap, before, after, protectedOverflow: after > target };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

/** Parses "150k", "1.5m", "200000", "200,000" into a token count; null when invalid. */
export function parseBudgetInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[,_\s]/g, "");
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === "k") n *= 1_000;
  if (m[2] === "m") n *= 1_000_000;
  n = Math.round(n);
  return n >= 1_000 ? n : null;
}
