import { useEffect, useState } from "react";
import { BUDGET_PRESETS, formatTokens, parseBudgetInput } from "../lib/budget";

interface Props {
  budget: number | null;
  /** Measured tokens of the current output (after eviction). */
  used: number;
  evictedCount: number;
  protectedOverflow: boolean;
  onBudget: (budget: number | null) => void;
}

export default function BudgetBar({ budget, used, evictedCount, protectedOverflow, onBudget }: Props) {
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState(false);
  const isPreset = budget !== null && (BUDGET_PRESETS as readonly number[]).includes(budget);

  useEffect(() => {
    if (budget === null || isPreset) setCustom("");
  }, [budget, isPreset]);

  const over = budget !== null && used > budget;
  const pct = budget ? Math.min(100, Math.round((used / budget) * 100)) : 0;

  const applyCustom = () => {
    if (!custom.trim()) return;
    const n = parseBudgetInput(custom);
    if (n === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onBudget(n);
  };

  return (
    <div className="border-b border-zinc-800 px-4 py-3" aria-label="Token budget">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Token budget</p>
        <p
          className={`font-mono text-[12px] font-semibold tabular-nums ${
            budget === null ? "text-zinc-400" : over ? "text-red-400" : "text-emerald-300"
          }`}
          aria-live="polite"
          data-testid="budget-indicator"
        >
          {budget === null ? `${used.toLocaleString("en-US")} tokens` : `${used.toLocaleString("en-US")} / ${budget.toLocaleString("en-US")} tokens used`}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onBudget(null)}
          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
            budget === null ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
          }`}
        >
          Off
        </button>
        {BUDGET_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onBudget(n)}
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
              budget === n ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {formatTokens(n)}
          </button>
        ))}
        <input
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setInvalid(false);
          }}
          onBlur={applyCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustom();
          }}
          placeholder={budget !== null && !isPreset ? formatTokens(budget) : "custom (e.g. 150k)"}
          aria-label="Custom token budget"
          className={`w-32 rounded-md border bg-zinc-950/70 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60 ${
            invalid ? "border-red-500/60" : budget !== null && !isPreset ? "border-amber-400/70" : "border-zinc-800"
          }`}
        />
      </div>

      {budget !== null && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full ${over ? "bg-red-500" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {evictedCount > 0 && (
              <span className="text-amber-300/90">
                {evictedCount} file{evictedCount === 1 ? "" : "s"} auto-evicted (placeholders left in place) ·{" "}
              </span>
            )}
            {protectedOverflow && <span className="text-red-300">README / entry points alone exceed the budget · </span>}
            estimate ≈ characters ÷ 4
          </p>
        </div>
      )}
      {budget === null && <p className="mt-1.5 text-[10px] text-zinc-600">estimate ≈ characters ÷ 4</p>}
    </div>
  );
}
