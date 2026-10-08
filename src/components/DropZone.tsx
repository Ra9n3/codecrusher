import { useCallback, useRef, useState } from "react";
import { NEVER_SCAN_DIRS } from "../lib/junk";

interface Props {
  /** @param skippedDirs directories the traversal refused to enter (node_modules, .git, …) */
  onFiles: (files: File[], skippedDirs?: string[]) => void;
  busy: boolean;
}

async function readEntry(entry: any, path: string, out: File[], skipped: string[]): Promise<void> {
  if (entry.isFile) {
    const file: File = await new Promise((res, rej) => entry.file(res, rej));
    // attach relative path
    Object.defineProperty(file, "webkitRelativePath", {
      value: path + file.name,
      writable: false,
    });
    out.push(file);
  } else if (entry.isDirectory) {
    // Never descend into package/VCS/cache dirs — record them so the output can say they exist.
    if (NEVER_SCAN_DIRS.has(entry.name)) {
      skipped.push(path + entry.name);
      return;
    }
    const reader = entry.createReader();
    let batch: any[];
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const child of batch) {
        await readEntry(child, path + entry.name + "/", out, skipped);
      }
    } while (batch.length > 0);
  }
}

export default function DropZone({ onFiles, busy }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const items = Array.from(e.dataTransfer.items || []);
      const entries = items
        .map((it) => (it as any).webkitGetAsEntry?.())
        .filter(Boolean);

      if (entries.length > 0 && entries.some((en: any) => en.isDirectory)) {
        const out: File[] = [];
        const skipped: string[] = [];
        for (const entry of entries) {
          await readEntry(entry, "", out, skipped);
        }
        if (out.length) onFiles(out, skipped);
        return;
      }
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-3xl border-2 border-dashed p-10 sm:p-16 text-center transition-all duration-200 ${
        dragOver
          ? "border-amber-400 bg-amber-400/10 scale-[1.01]"
          : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500"
      }`}
    >
      <input
        ref={folderInput}
        type="file"
        // @ts-expect-error non-standard attr
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <input
        ref={zipInput}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />

      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/20">
        {busy ? (
          <svg className="h-9 w-9 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            <path d="M12 16v-5" />
            <path d="M9.5 13.5 12 11l2.5 2.5" />
          </svg>
        )}
      </div>

      <h2 className="text-xl font-semibold text-white">
        {busy ? "Crushing your repository…" : "Drop a repo on the press"}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Drag a project folder or a <span className="text-zinc-200 font-medium">.zip</span> file — everything stays in your browser.
      </p>

      {!busy && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => folderInput.current?.click()}
            className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300"
          >
            Select folder
          </button>
          <button
            onClick={() => zipInput.current?.click()}
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700/80"
          >
            Upload .zip
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        node_modules, .git, lockfiles, binaries &amp; secrets are stripped before you pick a lens
      </p>
    </div>
  );
}
