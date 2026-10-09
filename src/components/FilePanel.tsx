import { useMemo, useState } from "react";
import { ClassifiedFile, categoryMeta, effectiveLayer } from "../lib/filters";
import { EXPANDABLE_JUNK, JUNK_LABEL, omittedLabel } from "../lib/junk";
import { LAYERS, LayerId, layerMeta } from "../lib/layers";
import { formatBytes } from "../lib/processor";

interface Props {
  files: ClassifiedFile[];
  skippedDirs?: string[];
  /** Paths currently evicted by the token budget. */
  evicted?: ReadonlyMap<string, string>;
  onToggle: (path: string) => void;
  onToggleAll: (include: boolean) => void;
  onReassignLayer?: (path: string, layer: LayerId | null) => void;
}

export default function FilePanel({ files, skippedDirs = [], evicted, onToggle, onToggleAll, onReassignLayer }: Props) {
  const [query, setQuery] = useState("");
  const [showExcluded, setShowExcluded] = useState(true);
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return files.filter((f) => {
      if (!showExcluded && f.content === null) return false;
      if (onlyIncluded && !(f.included && !f.collapsed && f.content !== null)) return false;
      return !q || f.path.toLowerCase().includes(q);
    });
  }, [files, query, showExcluded, onlyIncluded]);

  const fullCount = files.filter((f) => f.included && !f.collapsed && f.content !== null).length;
  const collapsedCount = files.filter((f) => f.included && (f.collapsed || f.content === null)).length;
  const isListTooShort = visible.length <= 5;

  // Derive the All/None mirrors from the same list the buttons act on — never from "last pressed".
  const allIncluded = files.length > 0 && files.every((f) => f.included);
  const noneIncluded = files.length > 0 && files.every((f) => !f.included);
  const mixedSelection = files.length > 0 && !allIncluded && !noneIncluded;
  const selectorButton = (active: boolean) =>
    `rounded-md border px-2 py-1 text-[11px] font-medium ${
      active
        ? "border-amber-400/70 bg-amber-400/10 text-amber-100 transition-colors duration-150"
        : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
    }`;

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">
            Files{" "}
            <span className="font-normal text-zinc-500">
              ({fullCount} in the crush{collapsedCount ? ` · ${collapsedCount} collapsed` : ""})
            </span>
          </h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onToggleAll(true)}
              aria-pressed={allIncluded}
              className={selectorButton(allIncluded)}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onToggleAll(false)}
              aria-pressed={noneIncluded}
              className={selectorButton(noneIncluded)}
            >
              None
            </button>
            {mixedSelection && (
              <span
                className="cursor-default rounded-md border border-amber-400/70 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-100 transition-colors duration-150"
                title="Custom selection — some files included"
              >
                custom
              </span>
            )}
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by path…"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/60"
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={onlyIncluded}
              onChange={(e) => setOnlyIncluded(e.target.checked)}
              className="h-3 w-3 accent-amber-500"
            />
            Only included
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={(e) => setShowExcluded(e.target.checked)}
              className="h-3 w-3 accent-amber-500"
            />
            Show binary / unreadable
          </label>
        </div>
      </div>

      {skippedDirs.length > 0 && (
        <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-2 text-[11px] text-zinc-500" data-testid="skipped-dirs">
          <span className="font-semibold uppercase tracking-wider text-zinc-600">Not scanned</span>{" "}
          {skippedDirs.map((d) => (
            <span key={d} className="mr-1.5 font-mono text-zinc-400">
              {d}/
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          File List ({visible.length})
        </span>
        <button
          type="button"
          onClick={() => setIsListExpanded(!isListExpanded)}
          disabled={isListTooShort}
          className={`text-[11px] font-medium transition-colors ${
            isListTooShort
              ? "text-zinc-600 cursor-not-allowed"
              : "text-amber-400 hover:text-amber-300 cursor-pointer"
          }`}
        >
          {isListExpanded ? "Collapse list" : "Expand list"}
        </button>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-2 ${!isListExpanded ? "max-h-[350px]" : ""}`}>
        {visible.map((f) => {
          const unreadable = f.content === null;
          const isJunk = f.junk !== null;
          const expandable = isJunk && !unreadable && EXPANDABLE_JUNK.has(f.junk!);
          const checked = f.included && !f.collapsed && !unreadable;
          const collapsed = f.included && !unreadable && f.collapsed;
          const evictedReason = evicted?.get(f.path);
          const layer = effectiveLayer(f);
          const lm = layerMeta(layer);
          const primary = f.categories[0];
          const cm = primary ? categoryMeta(primary) : null;
          const dim = unreadable || collapsed || (!f.included && isJunk);

          return (
            <div
              key={f.path}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${
                unreadable ? "opacity-40" : dim ? "opacity-60 hover:opacity-90" : ""
              } ${unreadable ? "" : "hover:bg-zinc-800/70"}`}
              data-testid="file-row"
              data-collapsed={collapsed ? "true" : undefined}
            >
              <input
                type="checkbox"
                disabled={unreadable}
                checked={checked}
                onChange={() => onToggle(f.path)}
                title={
                  unreadable
                    ? `${JUNK_LABEL[f.junk ?? "binary"]} — cannot be included`
                    : collapsed
                      ? "Collapsed to a placeholder — check to include the full content"
                      : expandable
                        ? "Uncheck to collapse back to a placeholder"
                        : undefined
                }
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-amber-500 disabled:cursor-not-allowed"
                aria-label={`Include ${f.path}`}
              />

              {editing === f.path && onReassignLayer ? (
                <select
                  autoFocus
                  defaultValue={layer}
                  onBlur={() => setEditing(null)}
                  onChange={(e) => {
                    const v = e.target.value;
                    onReassignLayer(f.path, v === "__auto__" ? null : (v as LayerId));
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="shrink-0 rounded-md border border-amber-400/60 bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-100 outline-none"
                  aria-label={`Layer for ${f.path}`}
                >
                  <option value="__auto__">auto ({layerMeta(f.layer).short})</option>
                  {LAYERS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.order}. {l.label}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => onReassignLayer && setEditing(f.path)}
                  title={`Layer: ${lm.label}${f.layerOverride ? " (reassigned)" : ""}${onReassignLayer ? " — click to reassign" : ""}`}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none ${lm.badge} ${
                    f.layerOverride ? "ring-1 ring-amber-400/60" : ""
                  } ${onReassignLayer ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
                  data-testid="layer-badge"
                >
                  {lm.short}
                </button>
              )}

              {cm && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cm.dot}`} title={cm.label} />}
              <span className={`min-w-0 flex-1 truncate font-mono text-zinc-300 ${collapsed ? "italic" : ""}`} title={f.path}>
                {f.path}
                {f.pinned && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-amber-500/80">pinned</span>}
              </span>

              <span className="shrink-0 text-[10px] tabular-nums">
                {evictedReason ? (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-semibold text-red-300" title="Omitted to fit the token budget; a placeholder is left in the output">
                    evicted · budget
                  </span>
                ) : unreadable ? (
                  <span className="text-zinc-500">{omittedLabel(f, f.junk ?? "binary")}</span>
                ) : collapsed ? (
                  <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-300/90">{omittedLabel(f, f.junk!)}</span>
                ) : isJunk ? (
                  <span className="text-zinc-500">
                    {JUNK_LABEL[f.junk!]} · {formatBytes(f.size)}
                  </span>
                ) : (
                  <span className="text-zinc-600">{formatBytes(f.size)}</span>
                )}
              </span>
            </div>
          );
        })}
        {visible.length === 0 && <p className="p-4 text-center text-xs text-zinc-600">No matching files</p>}
      </div>
    </div>
  );
}
