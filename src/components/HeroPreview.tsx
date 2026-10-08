export default function HeroSVG() {
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

          {/* Background Code Blocks (Being crushed) */}
          <g className="animate-pulse" style={{ animationDuration: "3s" }}>
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

          <g
            className="animate-pulse"
            style={{ animationDuration: "3s", animationDelay: "0.5s" }}
          >
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

          {/* The Press / Funnel */}
          <path
            d="M120 140 L280 140 L220 200 L180 200 Z"
            fill="url(#pressGrad)"
            opacity="0.9"
          />
          <rect x="150" y="120" width="100" height="20" rx="4" fill="#fbbf24" />

          {/* The Crushed Document (Result) */}
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

          {/* Sparkles / Action lines */}
          <circle cx="130" cy="180" r="3" fill="#fbbf24" />
          <circle cx="270" cy="170" r="2" fill="#fbbf24" />
          <circle cx="200" cy="190" r="4" fill="#fbbf24" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
