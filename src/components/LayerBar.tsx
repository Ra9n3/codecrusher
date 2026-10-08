import { useState } from "react";
import { ClassifiedFile, layerStats } from "../lib/filters";
import { LAYERS, LAYER_PRESETS, LayerId, matchingLayerPreset } from "../lib/layers";
import { formatTokens } from "../lib/budget";

interface Props {
  files: ClassifiedFile[];
  layers: LayerId[];
  tokensOf: (f: ClassifiedFile) => number;
  onToggleLayer: (id: LayerId) => void;
  onPreset: (id: string) => void;
  /** Current shareable URL (layers encoded as ?layers=…). */
  shareUrl: string;
}

export default function LayerBar({ files, layers, tokensOf, onToggleLayer, onPreset, shareUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const stats = layerStats(files, tokensOf);
  const activePreset = matchingLayerPreset(layers);
  const selectedFiles = files.filter((f) => layers.includes(f.layerOverride ?? f.layer)).length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5" aria-label="Layer filters">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">Layers</p>
          <h2 className="mt-1 text-sm text-zinc-400">
            Every file sits in exactly one layer. Pick any combination —{" "}
            <span className="text-zinc-200">{selectedFiles} files</span> in the selected layers.
          </h2>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500"
          title={shareUrl}
        >
          {copied ? "✓ Link copied" : "Copy share link"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {LAYER_PRESETS.map((p) => {
          const on = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              title={p.hint}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                on
                  ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                  : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {p.name}
            </button>
          );
        })}
        {activePreset === "custom" && (
          <span className="self-center rounded-lg border border-dashed border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-500">
            custom mix
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {LAYERS.map((l) => {
          const on = layers.includes(l.id);
          const s = stats.get(l.id)!;
          return (
            <label
              key={l.id}
              title={l.hint}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                on ? l.chip : "border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggleLayer(l.id)}
                className="h-3.5 w-3.5 shrink-0 accent-amber-500"
                aria-label={`${l.label} layer`}
              />
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? l.dot : "bg-zinc-600"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">
                  <span className="mr-1 font-mono text-[10px] opacity-50">{String(l.order).padStart(2, "0")}</span>
                  {l.label}
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-[10px] tabular-nums opacity-70">
                {s.files} · ≈{formatTokens(s.tokens)}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
