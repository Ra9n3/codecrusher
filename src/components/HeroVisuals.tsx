export function HeroTerminal() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-4 bg-amber-500/20 blur-3xl rounded-full" />
      <div className="relative rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl overflow-hidden backdrop-blur-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-mono text-zinc-500">
            bash — 80x24
          </span>
        </div>
        <div className="p-5 font-mono text-[13px] leading-relaxed min-h-[220px] text-zinc-400">
          <div className="mb-1.5">
            <div className="text-amber-400">
              <span className="text-zinc-500 mr-2"></span>
              codecrusher ./my-repo
            </div>
          </div>
          <div className="mb-1.5 text-zinc-400">
            ↳ Evicting node_modules (12,400 files)
          </div>
          <div className="mb-1.5 text-zinc-400">
            ↳ Collapsing package-lock.json (placeholder)
          </div>
          <div className="mb-1.5 text-amber-400">
            ✓ Crushed to 1 file (42,000 tokens)
          </div>
          <div className="mt-2 flex items-center">
            <span className="text-zinc-500 mr-2">➜</span>
            <span className="w-2 h-4 bg-amber-400 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// OPTION 2: Pure CSS Abstract (Linear/Vercel Style)
export function HeroAbstract() {
  return (
    <div className="relative w-full aspect-[4/3] max-w-lg mx-auto overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/50">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/30 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-orange-600/20 rounded-full blur-[120px]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-40 rounded-2xl border border-zinc-700/50 bg-zinc-900/40 backdrop-blur-md shadow-2xl flex flex-col p-4 gap-3">
        <div className="flex gap-2">
          <div className="h-2 w-12 rounded-full bg-amber-400/80" />
          <div className="h-2 w-20 rounded-full bg-zinc-700" />
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800" />
        <div className="h-2 w-3/4 rounded-full bg-zinc-800" />
        <div className="h-2 w-5/6 rounded-full bg-zinc-800" />
      </div>

      <div className="absolute top-[30%] left-[15%] w-48 h-32 rounded-xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-sm shadow-xl flex flex-col p-3 gap-2 -rotate-6">
        <div className="h-1.5 w-10 rounded-full bg-rose-400/60" />
        <div className="h-1.5 w-full rounded-full bg-zinc-800" />
        <div className="h-1.5 w-2/3 rounded-full bg-zinc-800" />
      </div>

      <div className="absolute bottom-[25%] right-[15%] w-52 h-36 rounded-xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-sm shadow-xl flex flex-col p-3 gap-2 rotate-6">
        <div className="h-1.5 w-14 rounded-full bg-sky-400/60" />
        <div className="h-1.5 w-full rounded-full bg-zinc-800" />
        <div className="h-1.5 w-4/5 rounded-full bg-zinc-800" />
        <div className="h-1.5 w-3/4 rounded-full bg-zinc-800" />
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/40 z-10">
        <svg
          className="w-8 h-8 text-zinc-950"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75"
          />
        </svg>
      </div>
    </div>
  );
}

// OPTION 3: Clean SVG Illustration
export function HeroSVG() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full" />
      <div className="relative aspect-[4/3] w-full rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 400 300" className="w-full h-full drop-shadow-2xl">
          <defs>
            <linearGradient id="pressGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#27272a" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>

          <g>
            <rect
              x="60"
              y="40"
              width="120"
              height="80"
              rx="8"
              fill="#27272a"
              stroke="#3f3f46"
              strokeWidth="2"
            />
            <rect
              x="80"
              y="60"
              width="60"
              height="6"
              rx="3"
              fill="#fbbf24"
              opacity="0.8"
            />
            <rect x="80" y="75" width="80" height="6" rx="3" fill="#52525b" />
            <rect x="80" y="90" width="40" height="6" rx="3" fill="#52525b" />
          </g>

          <g>
            <rect
              x="220"
              y="50"
              width="120"
              height="70"
              rx="8"
              fill="#27272a"
              stroke="#3f3f46"
              strokeWidth="2"
            />
            <rect
              x="240"
              y="70"
              width="50"
              height="6"
              rx="3"
              fill="#38bdf8"
              opacity="0.8"
            />
            <rect x="240" y="85" width="70" height="6" rx="3" fill="#52525b" />
          </g>

          <path
            d="M120 140 L280 140 L220 200 L180 200 Z"
            fill="url(#pressGrad)"
            opacity="0.9"
          />
          <rect x="150" y="120" width="100" height="20" rx="4" fill="#fbbf24" />

          <rect
            x="140"
            y="210"
            width="120"
            height="70"
            rx="6"
            fill="url(#docGrad)"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          <rect
            x="155"
            y="225"
            width="90"
            height="4"
            rx="2"
            fill="#fbbf24"
            opacity="0.9"
          />
          <rect x="155" y="237" width="70" height="4" rx="2" fill="#a1a1aa" />
          <rect x="155" y="249" width="80" height="4" rx="2" fill="#a1a1aa" />
          <rect x="155" y="261" width="50" height="4" rx="2" fill="#a1a1aa" />

          <circle cx="130" cy="180" r="3" fill="#fbbf24" />
          <circle cx="270" cy="170" r="2" fill="#fbbf24" />
          <circle cx="200" cy="190" r="4" fill="#fbbf24" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
