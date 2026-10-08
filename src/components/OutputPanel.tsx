import { useMemo, useState } from "react";
import { estimateTokens, formatBytes, formatCount } from "../lib/processor";
import BudgetBar from "./BudgetBar";

interface Props {
  output: string;
  rootName: string;
  fileCount: number;
  /** Files that appear only as placeholders (junk + budget-evicted). */
  omittedCount?: number;
  profile: string;
  depthLabel: string;
  budget?: number | null;
  evictedCount?: number;
  protectedOverflow?: boolean;
  onBudget?: (budget: number | null) => void;
}

const CONTEXTS = [
  { name: "GPT-5", limit: 400_000 },
  { name: "Claude", limit: 200_000 },
  { name: "Gemini", limit: 1_000_000 },
];

export default function OutputPanel({
  output,
  rootName,
  fileCount,
  omittedCount = 0,
  profile,
  depthLabel,
  budget = null,
  evictedCount = 0,
  protectedOverflow = false,
  onBudget,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const tokens = useMemo(() => estimateTokens(output), [output]);
  const preview = useMemo(
    () => (output.length > 60_000 ? output.slice(0, 60_000) + "\n\n… (preview truncated — full content in copy/download)" : output),
    [output]
  );
  const isPreviewTooShort = output.length < 5000;

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rootName}-crushed.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-px border-b border-zinc-800 bg-zinc-800/50 rounded-t-2xl overflow-hidden">
        <div className="bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Files</p>
          <p className="text-lg font-semibold text-white tabular-nums">{fileCount}</p>
        </div>
        <div className="bg-zinc-900 px-4 py-3" title="Files present only as one-line placeholders">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Omitted</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-300">{omittedCount}</p>
        </div>
        <div className="bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Size</p>
          <p className="text-lg font-semibold text-white tabular-nums">{formatBytes(output.length)}</p>
        </div>
        <div className="bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">≈ Tokens</p>
          <p className={`text-lg font-semibold tabular-nums ${budget !== null && tokens > budget ? "text-red-400" : "text-amber-400"}`}>
            {formatCount(tokens)}
          </p>
        </div>
      </div>

      {onBudget && (
        <BudgetBar
          budget={budget}
          used={tokens}
          evictedCount={evictedCount}
          protectedOverflow={protectedOverflow}
          onBudget={onBudget}
        />
      )}

      {/* Context fit */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-2.5">
        {CONTEXTS.map((c) => {
          const fits = tokens <= c.limit;
          const pct = Math.min(100, Math.round((tokens / c.limit) * 100));
          return (
            <span
              key={c.name}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                fits
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
              title={`${formatCount(c.limit)} token context window`}
            >
              {fits ? "✓" : "✕"} {c.name} <span className="opacity-60">{pct}%</span>
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2 text-[11px] text-zinc-500">
        <span>
          Profile <span className="text-zinc-300">{profile}</span>
        </span>
        <span>{depthLabel}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 border-b border-zinc-800 p-4">
        <button
          onClick={copy}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            copied
              ? "bg-amber-600 text-white"
              : "bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300"
          }`}
        >
          {copied ? "✓ Copied" : "Copy crush"}
        </button>
        <button
          onClick={download}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700/80"
        >
          Download .txt
        </button>
      </div>

      {/* Preview */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Preview</span>
          <button
            type="button"
            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            disabled={isPreviewTooShort}
            className={`text-[11px] font-medium transition-colors ${
              isPreviewTooShort
                ? "text-zinc-600 cursor-not-allowed"
                : "text-amber-400 hover:text-amber-300 cursor-pointer"
            }`}
          >
            {isPreviewExpanded ? "Collapse preview" : "Expand preview"}
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-auto ${!isPreviewExpanded ? "max-h-[350px]" : ""}`}>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-400">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}
