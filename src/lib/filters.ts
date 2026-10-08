import type { RepoFile } from "./processor";
import { ALL_LAYERS, LayerId, classifyLayer } from "./layers";
import { matchesAny, splitPatterns } from "./glob";

export type CategoryId =
  | "ui"
  | "styles"
  | "logic"
  | "api"
  | "data"
  | "types"
  | "docs"
  | "tests"
  | "config";

export type Depth = "full" | "essentials";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  hint: string;
  dot: string;
  chip: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "logic", label: "Functionality", hint: "Services, hooks, state, utils, algorithms", dot: "bg-amber-400", chip: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  { id: "api", label: "API", hint: "Routes, controllers, handlers", dot: "bg-sky-400", chip: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  { id: "data", label: "Data", hint: "Models, schemas, migrations", dot: "bg-violet-400", chip: "border-violet-400/40 bg-violet-400/10 text-violet-200" },
  { id: "types", label: "Types", hint: "Interfaces, type declarations", dot: "bg-indigo-400", chip: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200" },
  { id: "ui", label: "UI", hint: "Components, pages, layouts, markup", dot: "bg-rose-400", chip: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  { id: "styles", label: "Design", hint: "CSS, tokens, themes, Tailwind", dot: "bg-fuchsia-400", chip: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200" },
  { id: "docs", label: "Docs", hint: "READMEs and documentation", dot: "bg-emerald-400", chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  { id: "tests", label: "Tests", hint: "Specs and expected behavior", dot: "bg-orange-400", chip: "border-orange-400/40 bg-orange-400/10 text-orange-200" },
  { id: "config", label: "Config", hint: "Build, tooling, package manifests", dot: "bg-zinc-300", chip: "border-zinc-500/50 bg-zinc-700/40 text-zinc-200" },
];

export const ALL_CATEGORIES: CategoryId[] = CATEGORIES.map((c) => c.id);

export interface Preset {
  id: string;
  name: string;
  kicker: string;
  description: string;
  categories: CategoryId[];
  depth: Depth;
  intent: string;
}

export const PRESETS: Preset[] = [
  {
    id: "all",
    name: "Everything",
    kicker: "Full crush",
    description: "Every readable file. Best when the repo is small.",
    categories: ALL_CATEGORIES,
    depth: "full",
    intent:
      "Read this repository and answer questions about it. The file contains the full source, flattened into one document.",
  },
  {
    id: "how",
    name: "How it works",
    kicker: "Functionality",
    description: "Logic, state, APIs, data and docs. UI markup and styles left out.",
    categories: ["logic", "api", "data", "types", "docs", "config"],
    depth: "full",
    intent:
      "Explain how this application works: architecture, data flow, key functions, and how features are implemented. Ignore visual styling and presentational components.",
  },
  {
    id: "ui",
    name: "UI & design",
    kicker: "Look & layout",
    description: "Components, pages, styles and design tokens. Backend logic left out.",
    categories: ["ui", "styles", "types"],
    depth: "full",
    intent:
      "Describe and work with the UI: layout, components, visual patterns, design tokens, and how screens are composed. Ignore backend and business logic.",
  },
  {
    id: "api",
    name: "API & data",
    kicker: "Contracts",
    description: "Routes, handlers, models, schemas and shared types.",
    categories: ["api", "data", "types"],
    depth: "full",
    intent:
      "Focus on the API surface and data model: endpoints, handlers, schemas, validation, and how data moves through the system.",
  },
  {
    id: "docs",
    name: "Docs only",
    kicker: "Writing",
    description: "READMEs, docs folders and markdown.",
    categories: ["docs"],
    depth: "full",
    intent: "Use the project documentation below. Summarize what the project is and how it is meant to be used.",
  },
  {
    id: "tests",
    name: "Tests",
    kicker: "Behavior",
    description: "Specs and test suites — what the code is supposed to do.",
    categories: ["tests"],
    depth: "full",
    intent:
      "Infer intended behavior from the tests. List features, edge cases, and invariants the suite expects.",
  },
  {
    id: "config",
    name: "Setup",
    kicker: "Tooling",
    description: "Manifests, build config, CI and environment examples.",
    categories: ["config"],
    depth: "full",
    intent:
      "Explain how this project is set up: dependencies, scripts, build tooling, and how to run it.",
  },
];

export interface ClassifiedFile extends RepoFile {
  categories: CategoryId[];
  pinned: boolean;
  /** Heuristic best-fit layer (exactly one). */
  layer: LayerId;
  /** User reassignment, persisted for the session. */
  layerOverride?: LayerId;
}

export function effectiveLayer(f: Pick<ClassifiedFile, "layer" | "layerOverride">): LayerId {
  return f.layerOverride ?? f.layer;
}

export interface FilterState {
  categories: CategoryId[];
  layers: LayerId[];
  depth: Depth;
  intent: string;
  pathInclude: string;
  pathExclude: string;
  extensions: string[];
}

export const DEFAULT_FILTER: FilterState = {
  categories: ALL_CATEGORIES,
  layers: ALL_LAYERS,
  depth: "full",
  intent: PRESETS[0].intent,
  pathInclude: "",
  pathExclude: "",
  extensions: [],
};

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function extOf(path: string): string {
  const name = path.split("/").pop() || "";
  if (!name.includes(".") || name.startsWith(".")) {
    const lower = name.toLowerCase();
    if (lower === "dockerfile") return "dockerfile";
    if (lower === "makefile") return "makefile";
    if (lower.includes(".")) return lower.split(".").pop() || "";
    return "";
  }
  return name.split(".").pop()!.toLowerCase();
}

const UI_DIRS = new Set([
  "components", "component", "pages", "page", "views", "view", "layouts", "layout",
  "ui", "screens", "screen", "widgets", "widget", "templates", "template",
]);
const LOGIC_DIRS = new Set([
  "lib", "libs", "utils", "util", "helpers", "helper", "services", "service",
  "hooks", "hook", "store", "stores", "state", "redux", "core", "domain",
  "engine", "algorithms", "algorithm", "workers", "worker", "middleware",
  "actions", "reducers", "contexts", "providers",
]);
const API_DIRS = new Set([
  "api", "routes", "route", "router", "routers", "controllers", "controller",
  "handlers", "handler", "endpoints", "endpoint", "graphql", "resolvers", "server",
]);
const DATA_DIRS = new Set([
  "models", "model", "schema", "schemas", "migrations", "migration", "prisma",
  "entities", "entity", "db", "database", "repositories", "repository",
]);

export function classifyFile(file: Pick<RepoFile, "path" | "content">): CategoryId[] {
  const lower = file.path.toLowerCase();
  const parts = lower.split("/");
  const name = parts[parts.length - 1] || "";
  const ext = extOf(file.path);
  const dirs = new Set(parts.slice(0, -1));
  const cats = new Set<CategoryId>();
  const head = (file.content || "").slice(0, 6000);

  const isTest =
    /\.(test|spec)\.[a-z0-9]+$/.test(name) ||
    name.endsWith("_test.go") ||
    name.startsWith("test_") ||
    name.endsWith("_spec.rb") ||
    dirs.has("test") ||
    dirs.has("tests") ||
    dirs.has("__tests__") ||
    dirs.has("spec") ||
    dirs.has("specs") ||
    dirs.has("cypress") ||
    dirs.has("e2e");
  if (isTest) cats.add("tests");

  if (
    ["md", "mdx", "rst", "adoc", "txt"].includes(ext) ||
    dirs.has("docs") ||
    dirs.has("doc") ||
    dirs.has("documentation") ||
    name === "readme" ||
    name.startsWith("readme.")
  ) {
    cats.add("docs");
  }

  if (["css", "scss", "sass", "less", "styl", "pcss"].includes(ext)) cats.add("styles");
  if (
    name.includes("tailwind") ||
    name.includes("tokens") ||
    name.includes("theme") ||
    name.endsWith(".module.css") ||
    ext === "svg"
  ) {
    cats.add("styles");
  }

  const configHit =
    [
      "package.json", "tsconfig", "jsconfig", "vite.config", "webpack", "eslint",
      "prettier", "dockerfile", "docker-compose", "makefile", "cargo.toml", "go.mod",
      "pyproject", "requirements.txt", "composer.json", "gemfile", "pubspec",
      "next.config", "nuxt.config", "svelte.config", "astro.config", "tailwind.config",
      "postcss.config", ".gitignore", ".npmrc", ".nvmrc", "netlify.toml", "vercel.json",
      "fly.toml", "render.yaml",
    ].some((c) => lower.includes(c)) ||
    dirs.has(".github") ||
    dirs.has("ci") ||
    name.includes(".config.") ||
    name.endsWith("rc") ||
    name.endsWith(".env.example") ||
    name === ".env.example";
  if (configHit || (["toml", "ini"].includes(ext) && !cats.has("docs"))) cats.add("config");

  if ([...dirs].some((d) => API_DIRS.has(d)) || /(route|controller|handler|endpoint|resolver|middleware)/.test(name)) {
    cats.add("api");
  }
  if (
    [...dirs].some((d) => DATA_DIRS.has(d)) ||
    ["sql", "prisma"].includes(ext) ||
    /(model|schema|migration|entity)/.test(name)
  ) {
    cats.add("data");
  }
  if (
    name.endsWith(".d.ts") ||
    dirs.has("types") ||
    dirs.has("interfaces") ||
    /(^|\/)types?\.[a-z]+$/.test(lower) ||
    name.startsWith("types.")
  ) {
    cats.add("types");
  }

  const uiDir = [...dirs].some((d) => UI_DIRS.has(d));
  const uiName = /(component|page|view|layout|screen|button|modal|card|navbar|header|footer|sidebar|form)/.test(name);
  const hasJsx = /<[A-Z][A-Za-z0-9]*[\s/>]|className=|return\s*\(\s*</.test(head);
  if (uiDir || uiName || ["vue", "svelte", "html", "htm"].includes(ext) || (["tsx", "jsx"].includes(ext) && (hasJsx || uiDir))) {
    cats.add("ui");
  }
  if (ext === "svg") cats.add("ui");

  const logicDir = [...dirs].some((d) => LOGIC_DIRS.has(d));
  const logicName = /(service|util|helper|hook|store|reducer|action|engine|algorithm|worker|provider|context)/.test(name);
  if (logicDir || logicName) cats.add("logic");
  if (["py", "go", "rs", "java", "kt", "rb", "php", "cs", "swift"].includes(ext) && !isTest) {
    cats.add("logic");
  }

  if (cats.size === 0) {
    if (["ts", "js", "mjs", "cjs", "tsx", "jsx", "py", "go", "rs", "java", "rb", "php", "swift", "kt", "c", "cpp", "cs", "lua", "ex", "exs"].includes(ext)) {
      cats.add(hasJsx ? "ui" : "logic");
    } else if (["json", "yaml", "yml"].includes(ext)) {
      cats.add("config");
    } else if (file.content === null) {
      // Unreadable (binary) files: images/fonts/media read as design, anything else as config.
      cats.add(/^(png|jpe?g|gif|webp|avif|bmp|ico|icns|tiff|heic|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|webm|mov|psd|ai|sketch|fig)$/.test(ext) ? "styles" : "config");
    } else {
      cats.add("logic");
    }
  }

  const order: CategoryId[] = ["tests", "docs", "styles", "config", "api", "data", "types", "ui", "logic"];
  return order.filter((c) => cats.has(c));
}

/**
 * Classifies every file (binary files too, by path) into categories + exactly one layer.
 * @param overrides per-path layer reassignments restored from the session
 */
export function classifyAll(files: RepoFile[], overrides: Record<string, LayerId> = {}): ClassifiedFile[] {
  return files.map((f) => ({
    ...f,
    categories: classifyFile(f),
    pinned: false,
    layer: classifyLayer(f),
    ...(overrides[f.path] ? { layerOverride: overrides[f.path] } : {}),
  }));
}

export function matchesFilter(file: ClassifiedFile, filter: FilterState): boolean {
  if (!file.categories.some((c) => filter.categories.includes(c))) return false;
  if (!filter.layers.includes(effectiveLayer(file))) return false;
  if (filter.extensions.length > 0 && !filter.extensions.includes(extOf(file.path) || "(none)")) return false;
  const inc = splitPatterns(filter.pathInclude);
  const exc = splitPatterns(filter.pathExclude);
  if (inc.length && !matchesAny(inc, file.path)) return false;
  if (exc.length && matchesAny(exc, file.path)) return false;
  return true;
}

export function applyFilter(files: ClassifiedFile[], filter: FilterState, clearPins = false): ClassifiedFile[] {
  return files.map((f) => {
    if (!clearPins && f.pinned) return f;
    return {
      ...f,
      pinned: clearPins ? false : f.pinned,
      // Resetting manual picks also re-collapses junk the user had expanded.
      collapsed: clearPins ? f.junk !== null : f.collapsed,
      included: matchesFilter(f, filter),
    };
  });
}

/** Per-layer file counts and token estimates (full content only — collapsed junk costs ~one line). */
export function layerStats(files: ClassifiedFile[], tokensOf: (f: ClassifiedFile) => number): Map<LayerId, { files: number; tokens: number }> {
  const map = new Map<LayerId, { files: number; tokens: number }>();
  for (const id of ALL_LAYERS) map.set(id, { files: 0, tokens: 0 });
  for (const f of files) {
    const s = map.get(effectiveLayer(f))!;
    s.files++;
    if (f.content !== null && !f.collapsed) s.tokens += tokensOf(f);
  }
  return map;
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function matchingPreset(categories: CategoryId[]): string {
  const set = new Set(categories);
  for (const p of PRESETS) {
    if (p.categories.length === set.size && p.categories.every((c) => set.has(c))) return p.id;
  }
  return "custom";
}

export function extensionCounts(files: ClassifiedFile[]): { ext: string; count: number }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    if (f.content === null) continue;
    const ext = extOf(f.path) || "(none)";
    map.set(ext, (map.get(ext) || 0) + 1);
  }
  return [...map.entries()]
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext));
}

// ---------- Essentials crusher ----------

function stripStrings(line: string): string {
  return line
    .replace(/`(?:\\.|[^`])*`/g, "''")
    .replace(/"(?:\\.|[^"])*"/g, "''")
    .replace(/'(?:\\.|[^'])*'/g, "''");
}

function indentOf(line: string): string {
  return line.match(/^\s*/)?.[0] ?? "";
}

function endOfBraceBlock(lines: string[], start: number): number {
  let depth = 0;
  let started = false;
  const limit = Math.min(lines.length, start + 2500);
  for (let j = start; j < limit; j++) {
    const stripped = stripStrings(lines[j]);
    for (const ch of stripped) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
        if (started && depth <= 0) return j;
      }
    }
    if (j > start + 6 && !started) return start;
  }
  return Math.min(lines.length - 1, start);
}

function isSignature(t: string): boolean {
  return (
    /^(export\s+)?(default\s+)?(async\s+)?function\b/.test(t) ||
    /^(export\s+)?(default\s+)?(abstract\s+)?class\b/.test(t) ||
    /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(?/.test(t) && /=>|function\b/.test(t) ||
    /^(export\s+)?(async\s+)?def\s+\w+/.test(t) ||
    /^(pub(\([^)]*\))?\s+)?(async\s+)?fn\s+\w+/.test(t) ||
    /^(public|private|protected|internal|static|final|override|virtual|async|\s)+[\w<>,\[\]\s]+\s+\w+\s*\(/.test(t) ||
    /^(func|sub)\s+\w+/i.test(t)
  );
}

function crushPythonLike(lines: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith("#") || t.startsWith("@") || t.startsWith("import ") || t.startsWith("from ") || t.startsWith("require ")) {
      out.push(raw);
      continue;
    }
    if (/^(async\s+)?def\s+/.test(t) || /^class\s+/.test(t)) {
      out.push(raw.trimEnd());
      out.push(indentOf(raw) + "    …");
      const base = indentOf(raw).length;
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === "") {
          j++;
          continue;
        }
        if (indentOf(lines[j]).length <= base) break;
        j++;
      }
      i = j - 1;
    }
  }
  return out.join("\n");
}

function crushCss(text: string): string {
  const vars = [...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].slice(0, 50).map((m) => `${m[1]}: ${m[2].trim()}`);
  const selectors = [...text.matchAll(/(?:^|\n)\s*([^{}@\n][^{]{0,80})\s*\{/g)]
    .map((m) => m[1].trim())
    .filter((s) => s && !s.startsWith("/*"))
    .slice(0, 80);
  return [
    "/* crushed stylesheet — tokens & selectors, rules removed */",
    vars.length ? "TOKENS:\n" + vars.join("\n") : "",
    selectors.length ? "SELECTORS:\n" + selectors.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function crushMarkdown(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 160) return text.trimEnd();
  const out: string[] = [];
  let kept = 0;
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line) || line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s/.test(line)) {
      out.push(line);
      kept = 0;
    } else if (line.trim() && kept < 2) {
      out.push(line);
      kept++;
    } else if (!line.trim()) {
      out.push("");
      kept = 0;
    }
  }
  return out.join("\n").trimEnd() + "\n\n… (long document condensed to headings)";
}

function crushCode(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) {
      i++;
      continue;
    }
    if (
      t.startsWith("//") ||
      t.startsWith("/*") ||
      t.startsWith("*") ||
      t.startsWith("#") ||
      t.startsWith("<!--") ||
      t.startsWith("--")
    ) {
      out.push(raw);
      i++;
      continue;
    }
    if (
      /^(import\s|export\s+\*|export\s+\{|export\s+type\s+\{|from\s+\w|using\s+|require\(|#include\b|#import\b)/.test(t) ||
      /^export\s+(type|interface|const|function|class|default|async).*\sfrom\s+['"]/.test(t)
    ) {
      out.push(raw.trimEnd());
      i++;
      continue;
    }
    if (/^(export\s+)?(declare\s+)?(interface|type|enum|struct|trait|impl)\b/.test(t)) {
      if (t.includes("{") && !/\}\s*$/.test(t)) {
        const end = endOfBraceBlock(lines, i);
        out.push(...lines.slice(i, end + 1));
        i = end + 1;
      } else {
        out.push(raw.trimEnd());
        i++;
      }
      continue;
    }
    if (isSignature(t)) {
      const end = endOfBraceBlock(lines, i);
      const sig = raw.replace(/\{[\s\S]*$/, "").trimEnd();
      out.push(sig + " { … }");
      i = Math.max(end, i) + 1;
      continue;
    }
    if (/^(export\s+)?(const|let|var)\s+\w+/.test(t) && t.length < 220 && !t.includes("{")) {
      out.push(t.length > 180 ? raw.trimEnd().slice(0, 180) + " …" : raw.trimEnd());
      i++;
      continue;
    }
    i++;
  }

  const tags = [...text.matchAll(/<([A-Z][A-Za-z0-9.]*)\b/g)].map((m) => m[1]);
  const unique = [...new Set(tags)].slice(0, 36);
  if (unique.length) {
    out.push("");
    out.push("// UI structure: " + unique.map((tag) => `<${tag}>`).join(" "));
  }
  if (out.length === 0) {
    return lines.slice(0, 30).join("\n").trimEnd() + (lines.length > 30 ? "\n…" : "");
  }
  return out.join("\n").trimEnd();
}

export function crushContent(path: string, content: string, depth: Depth): string {
  const text = content.replace(/\r\n/g, "\n");
  if (depth === "full") return text.trimEnd();
  const ext = extOf(path);
  if (["md", "mdx", "rst", "adoc", "txt"].includes(ext)) return crushMarkdown(text);
  if (["css", "scss", "sass", "less", "styl"].includes(ext)) return crushCss(text);
  if (["py", "rb", "ex", "exs"].includes(ext)) {
    const crushed = crushPythonLike(text.split("\n"));
    return crushed || text.split("\n").slice(0, 40).join("\n");
  }
  if (["json", "yaml", "yml", "toml", "xml"].includes(ext)) {
    const lines = text.split("\n");
    if (lines.length <= 140) return text.trimEnd();
    return lines.slice(0, 140).join("\n") + "\n… (truncated)";
  }
  return crushCode(text);
}
