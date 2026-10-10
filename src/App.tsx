import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DropZone from "./components/DropZone";
import type { LoadingStage } from "./components/DropZone";
import FilePanel from "./components/FilePanel";
import FilterBar from "./components/FilterBar";
import LayerBar from "./components/LayerBar";
import OutputPanel from "./components/OutputPanel";
import { HeroTerminal } from "./components/HeroVisuals";
import {
  ALL_CATEGORIES,
  CategoryId,
  ClassifiedFile,
  DEFAULT_FILTER,
  FilterState,
  PRESETS,
  applyFilter,
  bulkFilterState,
  classifyAll,
  crushContent,
  effectiveLayer,
  matchesFilter,
  matchingPreset,
  presetById,
} from "./lib/filters";
import {
  ALL_LAYERS,
  LAYER_PRESETS,
  LayerId,
  layerMeta,
  loadLayerOverrides,
  parseLayersParam,
  saveLayerOverrides,
  withLayersParam,
} from "./lib/layers";
import {
  PLACEHOLDER_TOKENS,
  centralityScores,
  planEviction,
} from "./lib/budget";
import {
  OutputMeta,
  RepoFile,
  estimateTokens,
  generateOutput,
  processFileList,
  renderFileBlock,
} from "./lib/processor";

/** Header + footer + per-tree-line allowance used by the budget planner (measured output is shown to the user). */
const BASE_HEADER_TOKENS = 260;
const TREE_LINE_TOKENS = 9;

function currentSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

const STEPS = [
  {
    n: "01",
    title: "Drop the repo",
    text: "A project folder or a GitHub .zip. Nothing is uploaded — the press runs in your browser.",
  },
  {
    n: "02",
    title: "Pick layers & a budget",
    text: "Twelve architectural layers (UI, routing, state, data, tests…) plus a token budget that auto-evicts the heaviest, least-central files.",
  },
  {
    n: "03",
    title: "Crush to one file",
    text: "Lockfiles, build output and binaries collapse to one-line placeholders. Copy or download a single .txt, ready for any AI.",
  },
];

function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="url(#crush)" />
      <path
        d="M7 8h18v3.2c0 .5-.4.8-.9.8H7.9c-.5 0-.9-.3-.9-.8V8z"
        fill="#1c1917"
      />
      <path d="M10 13.2h12l-1.2 3.2H11.2L10 13.2z" fill="#fff7ed" />
      <rect x="8" y="18" width="16" height="2" rx="0.4" fill="#fbbf24" />
      <rect
        x="9.5"
        y="21.2"
        width="13"
        height="1.4"
        rx="0.3"
        fill="#fdba74"
        opacity="0.85"
      />
      <rect
        x="11"
        y="23.6"
        width="10"
        height="1.1"
        rx="0.3"
        fill="#fff"
        opacity="0.9"
      />
      <defs>
        <linearGradient
          id="crush"
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  const [files, setFiles] = useState<ClassifiedFile[] | null>(null);
  const [rootName, setRootName] = useState("repository");
  const [skippedDirs, setSkippedDirs] = useState<string[]>([]);
  // Layer selection is restored from ?layers=… so filtered views are shareable.
  const [filter, setFilter] = useState<FilterState>(() => ({
    ...DEFAULT_FILTER,
    layers: parseLayersParam(currentSearch()),
  }));
  const [budget, setBudget] = useState<number | null>(null);
  const [centrality, setCentrality] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const commit = useCallback((next: FilterState, clearPins = false) => {
    setFilter(next);
    setFiles((prev) => (prev ? applyFilter(prev, next, clearPins) : prev));
  }, []);

  // Keep the URL in sync with the active layers (replaceState → no history spam).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = withLayersParam(window.location.search, filter.layers);
    if (next !== window.location.search) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + next + window.location.hash,
      );
    }
  }, [filter.layers]);

  const handleFiles = useCallback(
    async (list: File[], knownSkipped: string[] = []) => {
      // Fresh controller per upload so a stale cancel can't kill the next run.
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoadingStage("reading");
      setError(null);
      try {
        // Yield to the browser so it can paint the "reading" state before we block on disk I/O.
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (controller.signal.aborted) return;

        // Reading stage: pull file contents off disk and inflate zips.
        const result = await processFileList(list, knownSkipped, controller.signal);
        if (controller.signal.aborted) return;

        // Processing stage: classify, score and assemble the crush.
        setLoadingStage("processing");
        // Yield again so the "processing" state paints before the heavy crunch.
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (controller.signal.aborted) return;

        const classified = classifyAll(
          result.files,
          loadLayerOverrides(result.rootName),
        );
        if (classified.filter((f) => f.content !== null).length === 0) {
          setError(
            "No readable text files found. Try a different folder or zip.",
          );
          setFiles(null);
        } else {
          const fresh: FilterState = {
            ...DEFAULT_FILTER,
            categories: [...ALL_CATEGORIES],
            layers: filter.layers,
          };
          setFilter(fresh);
          setFiles(applyFilter(classified, fresh, true));
          setRootName(result.rootName);
          setSkippedDirs(result.skippedDirs);
          setCentrality(centralityScores(classified));
        }
      } catch (e) {
        if (e instanceof Error && (e.name === "AbortError" || e.message === "Cancelled")) {
          console.log("User cancelled the upload.");
        } else {
          console.error(e);
          setError(
            "Something went wrong while reading the files. Please try again.",
          );
        }
      } finally {
        setLoadingStage("idle");
        abortControllerRef.current = null;
      }
    },
    [filter.layers],
  );

  const cancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoadingStage("idle");
  }, []);

  // Checkbox semantics: normal files flip included; junk flips between placeholder and full content.
  const toggle = useCallback((path: string) => {
    setFiles((prev) =>
      prev
        ? prev.map((f) => {
            if (f.path !== path || f.content === null) return f;
            if (f.junk) {
              const expand = f.collapsed || !f.included;
              return { ...f, included: true, collapsed: !expand, pinned: true };
            }
            return { ...f, included: !f.included, pinned: true };
          })
        : prev,
    );
  }, []);

  // All/None move the filter lens itself so applyFilter recomputes every non-pinned
  // file instantly; manual picks carry through because applyFilter skips pinned files.
  const toggleAll = useCallback(
    (include: boolean) => {
      commit(bulkFilterState(filter, include));
    },
    [commit, filter],
  );

  const reassignLayer = useCallback(
    (path: string, layer: LayerId | null) => {
      setFiles((prev) =>
        prev
          ? prev.map((f) => {
              if (f.path !== path) return f;
              const next: ClassifiedFile = {
                ...f,
                layerOverride: layer ?? undefined,
              };
              return f.pinned
                ? next
                : { ...next, included: matchesFilter(next, filter) };
            })
          : prev,
      );
    },
    [filter],
  );

  // Persist per-file layer overrides for the session.
  useEffect(() => {
    if (!files) return;
    const overrides: Record<string, LayerId> = {};
    for (const f of files)
      if (f.layerOverride) overrides[f.path] = f.layerOverride;
    saveLayerOverrides(rootName, overrides);
  }, [files, rootName]);

  // Preset clicks reset the *other* axis to "all" so the result is predictable.
  const onPreset = (id: string) => {
    const preset = presetById(id);
    if (!preset) return;
    commit(
      {
        ...filter,
        categories: [...preset.categories],
        layers: [...ALL_LAYERS],
        depth: preset.depth,
        intent: preset.intent,
        extensions: [],
      },
      true,
    );
  };

  const onLayerPreset = (id: string) => {
    const preset = LAYER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    commit(
      {
        ...filter,
        layers: [...preset.layers],
        categories: [...ALL_CATEGORIES],
      },
      true,
    );
  };

  const onToggleCategory = (id: CategoryId) => {
    const has = filter.categories.includes(id);
    const categories = has
      ? filter.categories.filter((c) => c !== id)
      : [...filter.categories, id];
    commit({ ...filter, categories });
  };

  const onToggleLayer = (id: LayerId) => {
    const has = filter.layers.includes(id);
    const layers = has
      ? filter.layers.filter((l) => l !== id)
      : [...filter.layers, id];
    commit({ ...filter, layers });
  };

  const profileName = useMemo(() => {
    const id = matchingPreset(filter.categories);
    return PRESETS.find((p) => p.id === id)?.name ?? "Custom mix";
  }, [filter.categories]);

  const renderMeta = useMemo<Pick<OutputMeta, "render" | "fileTags">>(
    () => ({
      render: (f: RepoFile) =>
        crushContent(f.path, f.content || "", filter.depth),
      fileTags: (f: RepoFile) => {
        const c = f as ClassifiedFile;
        return `layer: ${layerMeta(effectiveLayer(c)).id}; tags: ${c.categories?.join(", ") || "-"}`;
      },
    }),
    [filter.depth],
  );

  // Per-file token cost of the rendered block. Cached by (depth, layer, tags) so checkbox
  // toggles don't re-render every file.
  const tokenCache = useRef(new Map<string, { key: string; tokens: number }>());
  const blockTokens = useMemo(() => {
    const out = new Map<string, number>();
    if (!files) return out;
    const cache = tokenCache.current;
    for (const f of files) {
      if (f.content === null) continue;
      const key = `${filter.depth}|${effectiveLayer(f)}|${f.categories.join(",")}|${f.content.length}`;
      const hit = cache.get(f.path);
      if (hit && hit.key === key) {
        out.set(f.path, hit.tokens);
        continue;
      }
      const tokens = estimateTokens(renderFileBlock(f, renderMeta));
      cache.set(f.path, { key, tokens });
      out.set(f.path, tokens);
    }
    return out;
  }, [files, filter.depth, renderMeta]);

  const tokensOf = useCallback(
    (f: ClassifiedFile) => blockTokens.get(f.path) ?? 0,
    [blockTokens],
  );

  // Budget: evict in priority order until the estimate fits (README / entry points are never evicted).
  const plan = useMemo(() => {
    if (!files || budget === null) return null;
    const candidates = files
      .filter((f) => f.included && !f.collapsed && f.content !== null)
      .map((f) => ({
        path: f.path,
        tokens: blockTokens.get(f.path) ?? 0,
        junk: f.junk,
        content: f.content,
      }));
    const placeholders = files.filter(
      (f) => f.included && (f.collapsed || f.content === null),
    ).length;
    const treeLines = candidates.length + placeholders + skippedDirs.length;
    const baseTokens =
      BASE_HEADER_TOKENS +
      treeLines * TREE_LINE_TOKENS +
      placeholders * PLACEHOLDER_TOKENS;
    return planEviction({ candidates, baseTokens, budget, centrality });
  }, [files, budget, blockTokens, centrality, skippedDirs.length]);

  const output = useMemo(() => {
    if (!files) return "";
    return generateOutput(files, {
      rootName,
      profile: profileName,
      intent: filter.intent,
      depth: filter.depth,
      ...renderMeta,
      evicted: plan?.evictedMap,
      skippedDirs,
      budget,
    });
  }, [
    files,
    rootName,
    filter.intent,
    filter.depth,
    profileName,
    renderMeta,
    plan,
    skippedDirs,
    budget,
  ]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      window.location.origin +
      window.location.pathname +
      withLayersParam("", filter.layers)
    );
  }, [filter.layers]);

  const includedCount = files
    ? files.filter(
        (f) =>
          f.included &&
          !f.collapsed &&
          f.content !== null &&
          !plan?.evictedMap.has(f.path),
      ).length
    : 0;
  const omittedCount = files
    ? files.filter(
        (f) =>
          f.included &&
          (f.collapsed || f.content === null || plan?.evictedMap.has(f.path)),
      ).length
    : 0;
  const pinnedCount = files ? files.filter((f) => f.pinned).length : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-orange-600/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-8">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFiles(null)}
            className="flex items-center gap-2.5 text-left"
          >
            <Logo />
            <span className="text-lg font-black tracking-tight">
              CODE<span className="text-amber-400">CRUSHER</span>
            </span>
          </button>
          <span className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            100% local — nothing leaves this tab
          </span>
        </header>

        {!files ? (
          <>
            <section className="mt-12 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">
                  Repo in. One file out.
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                  Crush a codebase into{" "}
                  <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                    exactly what the AI needs.
                  </span>
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                  Drop a whole repository. Keep only the functionality, only the
                  UI, only the API — or mix them. Code Crusher flattens the rest
                  into a single text file.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {PRESETS.slice(0, 4).map((p) => (
                    <span
                      key={p.id}
                      className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-[12px] text-zinc-300"
                    >
                      {p.name}
                    </span>
                  ))}
                  <span className="rounded-full border border-dashed border-zinc-700 px-3 py-1 text-[12px] text-zinc-500">
                    + custom
                  </span>
                </div>
              </div>
              <HeroTerminal />
            </section>

            <section className="mx-auto mt-12 max-w-3xl">
              <DropZone
                onFiles={handleFiles}
                loadingStage={loadingStage}
                onCancel={cancelProcessing}
              />
              {error && (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                  {error}
                </p>
              )}
            </section>

            <section className="mt-16 grid gap-3 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                >
                  <span className="font-mono text-[11px] font-bold text-amber-500/80">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                    {s.text}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-16">
              <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Same repo. Different crush.
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Sample
                  title="How it works"
                  file="app-how-it-works.txt"
                  body={`TASK FOR THE AI
Explain how this application works. Ignore visual styling.

FILE: src/lib/auth.ts  [logic]
export async function signIn(email: string, password: string) { … }
export function sessionFromToken(token: string): Session { … }

FILE: src/api/routes.ts  [api]
export function register(app: App) { … }`}
                />
                <Sample
                  title="UI & design"
                  file="app-ui.txt"
                  body={`TASK FOR THE AI
Describe the UI: layout, components, and design tokens.

FILE: src/components/Button.tsx  [ui]
export function Button({ tone, children }: Props) {
  return <button className={tones[tone]}>{children}</button>
}

FILE: src/index.css  [styles]
--amber: #fbbf24;
.press { background: var(--amber); }`}
                />
              </div>
            </section>

            <footer className="mt-20 border-t border-zinc-900 py-8 text-center">
              <p className="text-xs text-zinc-600">
                Your code never leaves this browser. No servers, no storage, no
                tracking.
              </p>

              {/* Single GitHub Support Button */}
              <div className="mt-6 flex items-center justify-center">
                <a
                  href="https://github.com/Ra9n3/codecrusher"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 transition-all hover:border-amber-500/50 hover:bg-zinc-800 hover:text-amber-200"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  Star or Support on GitHub
                </a>
              </div>

              <p className="mt-6 text-[10px] font-semibold tracking-wide text-zinc-600">
                CODE CRUSHER
              </p>
            </footer>
          </>
        ) : (
          <main className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-mono text-xl font-bold text-amber-300">
                  {rootName}/
                </h1>
                <p className="text-xs text-zinc-500">
                  {files.length} scanned · {includedCount} in this crush
                  {filter.depth === "essentials" ? " · signatures only" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiles(null)}
                className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
              >
                ← New crush
              </button>
            </div>

            <LayerBar
              files={files}
              layers={filter.layers}
              tokensOf={tokensOf}
              onToggleLayer={onToggleLayer}
              onPreset={onLayerPreset}
              shareUrl={shareUrl}
            />

            <FilterBar
              files={files}
              categories={filter.categories}
              depth={filter.depth}
              intent={filter.intent}
              pathInclude={filter.pathInclude}
              pathExclude={filter.pathExclude}
              extensions={filter.extensions}
              pinnedCount={pinnedCount}
              onPreset={onPreset}
              onToggleCategory={onToggleCategory}
              onDepth={(depth) => commit({ ...filter, depth })}
              onIntent={(intent) => setFilter((f) => ({ ...f, intent }))}
              onPathInclude={(pathInclude) =>
                commit({ ...filter, pathInclude })
              }
              onPathExclude={(pathExclude) =>
                commit({ ...filter, pathExclude })
              }
              onToggleExt={(ext) => {
                const extensions = filter.extensions.includes(ext)
                  ? filter.extensions.filter((e) => e !== ext)
                  : [...filter.extensions, ext];
                commit({ ...filter, extensions });
              }}
              onClearExt={() => commit({ ...filter, extensions: [] })}
              onResetPins={() => commit(filter, true)}
            />

            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.35fr)] lg:h-[76vh] lg:min-h-[600px]">
              <FilePanel
                files={files}
                skippedDirs={skippedDirs}
                evicted={plan?.evictedMap}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onReassignLayer={reassignLayer}
              />
              <OutputPanel
                output={output}
                rootName={rootName}
                fileCount={includedCount}
                omittedCount={omittedCount}
                profile={profileName}
                depthLabel={
                  filter.depth === "essentials"
                    ? "Signatures only"
                    : "Full source"
                }
                budget={budget}
                evictedCount={plan?.evicted.length ?? 0}
                protectedOverflow={plan?.protectedOverflow ?? false}
                onBudget={setBudget}
              />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

function Sample({
  title,
  file,
  body,
}: {
  title: string;
  file: string;
  body: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <span className="text-xs font-semibold text-amber-200">{title}</span>
        <span className="font-mono text-[11px] text-zinc-500">{file}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
        {body}
      </pre>
    </div>
  );
}
