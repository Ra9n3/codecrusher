import {
  CATEGORIES,
  CategoryId,
  ClassifiedFile,
  Depth,
  PRESETS,
  categoryMeta,
  extensionCounts,
  matchingPreset,
} from "../lib/filters";

interface Props {
  files: ClassifiedFile[];
  categories: CategoryId[];
  depth: Depth;
  intent: string;
  pathInclude: string;
  pathExclude: string;
  extensions: string[];
  pinnedCount: number;
  onPreset: (id: string) => void;
  onToggleCategory: (id: CategoryId) => void;
  onDepth: (d: Depth) => void;
  onIntent: (s: string) => void;
  onPathInclude: (s: string) => void;
  onPathExclude: (s: string) => void;
  onToggleExt: (ext: string) => void;
  onClearExt: () => void;
  onResetPins: () => void;
}

export default function FilterBar(props: Props) {
  const activePreset = matchingPreset(props.categories);
  const counts = new Map<CategoryId, number>();
  for (const f of props.files) {
    if (f.content === null) continue;
    for (const c of f.categories) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const exts = extensionCounts(props.files).slice(0, 14);
  const included = props.files.filter((f) => f.included && f.content !== null).length;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">Crush profile</p>
          <h2 className="mt-1 text-sm text-zinc-400">
            What should the AI see?{" "}
            <span className="text-zinc-200">{included} files</span> match.
          </h2>
        </div>
        {props.pinnedCount > 0 && (
          <button
            type="button"
            onClick={props.onResetPins}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Reset {props.pinnedCount} manual pick{props.pinnedCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {PRESETS.map((p) => {
          const on = activePreset === p.id;
          const n = props.files.filter(
            (f) => f.content !== null && f.categories.some((c) => p.categories.includes(c))
          ).length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => props.onPreset(p.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                on
                  ? "border-amber-400/70 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
                  : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[13px] font-semibold ${on ? "text-amber-200" : "text-zinc-100"}`}>{p.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">{n}</span>
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{p.kicker}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{p.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Fine-tune categories</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = props.categories.includes(c.id);
            const n = counts.get(c.id) || 0;
            return (
              <button
                key={c.id}
                type="button"
                title={c.hint}
                onClick={() => props.onToggleCategory(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                  on ? c.chip : "border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? c.dot : "bg-zinc-600"}`} />
                {c.label}
                <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {exts.length > 1 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Extensions {props.extensions.length === 0 ? "· all" : `· ${props.extensions.length} selected`}
            </p>
            {props.extensions.length > 0 && (
              <button type="button" onClick={props.onClearExt} className="text-[11px] text-zinc-400 hover:text-zinc-200">
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exts.map(({ ext, count }) => {
              const on = props.extensions.includes(ext);
              return (
                <button
                  key={ext}
                  type="button"
                  onClick={() => props.onToggleExt(ext)}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                    on
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  .{ext} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Depth</p>
          <div className="mt-2 grid gap-1.5">
            {(
              [
                ["full", "Full source", "Keep every line of matching files."],
                ["essentials", "Signatures only", "Crush bodies. Keep how it works, drop the noise."],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => props.onDepth(id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  props.depth === id
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span className={`block text-[13px] font-semibold ${props.depth === id ? "text-amber-100" : "text-zinc-200"}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Intent — pasted at the top of the file
            </span>
            <textarea
              value={props.intent}
              onChange={(e) => props.onIntent(e.target.value)}
              rows={3}
              className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Only paths containing</span>
              <input
                value={props.pathInclude}
                onChange={(e) => props.onPathInclude(e.target.value)}
                placeholder="src/api, services"
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Exclude paths containing</span>
              <input
                value={props.pathExclude}
                onChange={(e) => props.onPathExclude(e.target.value)}
                placeholder="legacy, generated, stories"
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60"
              />
            </label>
          </div>
          <p className="text-[11px] text-zinc-600">
            Comma-separated. Active lens:{" "}
            {props.categories.length === 0
              ? "nothing selected"
              : props.categories.map((id) => categoryMeta(id).label).join(" · ")}
            {activePreset === "custom" ? " · custom mix" : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
