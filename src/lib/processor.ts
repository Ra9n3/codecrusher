import JSZip from "jszip";
import {
  JunkKind,
  countLines,
  detectJunk,
  detectLicenseLabel,
  dispositionOf,
  isLockfile,
  isNeverScanPath,
  isSecretsFile,
  neverScanDirOf,
  placeholderText,
} from "./junk";

export interface RepoFile {
  path: string; // normalized, forward slashes, no leading slash
  size: number;
  content: string | null; // null = binary / skipped content
  skippedReason?: string;
  included: boolean; // user toggle
  autoExcluded: boolean; // excluded by default rules
  lines: number; // 0 when content is null
  junk: JunkKind | null; // why the file is collapsed / unreadable
  junkLabel?: string; // dynamic placeholder reason (e.g. the detected license type)
  collapsed: boolean; // true → output shows a one-line placeholder instead of content
}

export interface ProcessResult {
  files: RepoFile[];
  rootName: string;
  /** Directories that were not scanned at all (node_modules, .git, …), relative to root. */
  skippedDirs: string[];
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "icns", "tiff", "avif", "heic",
  "mp3", "wav", "ogg", "flac", "aac", "m4a",
  "mp4", "mov", "avi", "mkv", "webm", "m4v",
  "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "tgz",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "woff", "woff2", "ttf", "otf", "eot",
  "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "jar", "war",
  "pyc", "pyo", "wasm", "node",
  "sqlite", "db", "sqlite3",
  "psd", "ai", "sketch", "fig", "blend",
  "keystore", "p12", "pfx", "der",
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB per file
const MAX_LOCKFILE_SIZE = 5 * 1024 * 1024; // lockfiles are read (collapsed) so we can report line counts

/** @deprecated kept for callers; never-scan paths are now handled by junk.ts */
export function isIgnoredPath(path: string): boolean {
  return isNeverScanPath(path) || isSecretsFile(path);
}

export function isBinaryExt(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

function looksBinary(sample: Uint8Array): boolean {
  const len = Math.min(sample.length, 8000);
  let suspicious = 0;
  for (let i = 0; i < len; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32 && b !== 27)) suspicious++;
  }
  return len > 0 && suspicious / len > 0.1;
}

function normalizePath(raw: string): string {
  let p = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  // strip common root folder later; keep as-is here
  return p;
}

/** Attach junk classification + line count to a raw (path, content) pair. */
export function finalizeRepoFile(
  raw: Pick<RepoFile, "path" | "size" | "content" | "skippedReason">
): RepoFile {
  const junk = detectJunk(raw);
  const lines = raw.content === null ? 0 : countLines(raw.content);
  const junkLabel = junk === "license" && raw.content !== null ? detectLicenseLabel(raw.content) : undefined;
  return {
    ...raw,
    lines,
    junk,
    ...(junkLabel ? { junkLabel } : {}),
    collapsed: junk !== null,
    included: true, // filters recompute this; junk stays included but collapsed (placeholder)
    autoExcluded: junk !== null,
  };
}

async function fileToRepoFile(path: string, blob: Blob): Promise<RepoFile> {
  const size = blob.size;
  const base = { path, size };

  if (isSecretsFile(path)) {
    return finalizeRepoFile({ ...base, content: null, skippedReason: "secrets" });
  }
  if (isBinaryExt(path)) {
    return finalizeRepoFile({ ...base, content: null, skippedReason: "binary" });
  }
  const cap = isLockfile(path) ? MAX_LOCKFILE_SIZE : MAX_FILE_SIZE;
  if (size > cap) {
    return finalizeRepoFile({ ...base, content: null, skippedReason: `too large (>${Math.round(cap / 1024 / 1024)} MB)` });
  }
  try {
    const buf = new Uint8Array(await blob.slice(0, 8000).arrayBuffer());
    if (looksBinary(buf)) {
      return finalizeRepoFile({ ...base, content: null, skippedReason: "binary" });
    }
    const text = await blob.text();
    return finalizeRepoFile({ ...base, content: text });
  } catch {
    return finalizeRepoFile({ ...base, content: null, skippedReason: "unreadable" });
  }
}

/** Collapses never-scan paths into their top-most skipped directory; returns true if the path was skipped. */
function recordNeverScan(path: string, skipped: Set<string>): boolean {
  const dir = neverScanDirOf(path);
  if (dir) {
    skipped.add(dir);
    return true;
  }
  return isNeverScanPath(path); // OS noise files (.DS_Store …)
}

function stripCommonRoot(paths: string[]): { strip: number; rootName: string } {
  if (paths.length === 0) return { strip: 0, rootName: "repository" };
  const first = paths[0].split("/");
  if (first.length < 2) return { strip: 0, rootName: "repository" };
  const root = first[0];
  const allShare = paths.every((p) => p.split("/")[0] === root && p.split("/").length > 1);
  return allShare ? { strip: root.length + 1, rootName: root } : { strip: 0, rootName: "repository" };
}

/** Thrown when the caller aborts processing; matches the DOM AbortError shape. */
function abortError(): Error {
  const err = new Error("Cancelled");
  err.name = "AbortError";
  return err;
}

/** Yield to the event loop every N files so the browser can paint and handle clicks mid-read. */
const YIELD_EVERY = 100;
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param fileList files from a folder picker / drag-drop traversal (or a single .zip)
 * @param knownSkippedDirs directories the traversal already refused to enter (relative to the dropped root)
 * @param signal aborts the run between files so the browser stops crunching immediately
 */
export async function processFileList(
  fileList: File[],
  knownSkippedDirs: string[] = [],
  signal?: AbortSignal,
): Promise<ProcessResult> {
  if (signal?.aborted) throw abortError();
  // Zip file dropped alone?
  if (fileList.length === 1 && /\.zip$/i.test(fileList[0].name)) {
    return processZip(fileList[0], signal);
  }

  const entries = fileList.map((f) => ({
    raw: normalizePath((f as any).webkitRelativePath || f.name),
    file: f,
  }));

  const { strip, rootName } = stripCommonRoot(entries.map((e) => e.raw));
  const skipped = new Set<string>();
  for (const d of knownSkippedDirs) {
    const rel = strip && d.startsWith(rootName + "/") ? d.slice(strip) : d;
    if (rel && rel !== rootName) skipped.add(rel);
  }
  const results: RepoFile[] = [];
  let i = 0;
  for (const e of entries) {
    if (signal?.aborted) throw abortError();
    if (i++ % YIELD_EVERY === 0) await yieldToBrowser();
    const path = strip ? e.raw.slice(strip) : e.raw;
    if (!path) continue;
    if (recordNeverScan(path, skipped)) continue; // never read node_modules & co.
    results.push(await fileToRepoFile(path, e.file));
  }
  results.sort((a, b) => a.path.localeCompare(b.path));
  return { files: results, rootName, skippedDirs: [...skipped].sort() };
}

export async function processZip(zipFile: File, signal?: AbortSignal): Promise<ProcessResult> {
  if (signal?.aborted) throw abortError();
  const zip = await JSZip.loadAsync(zipFile);
  const entries: { path: string; obj: JSZip.JSZipObject }[] = [];
  zip.forEach((relPath, obj) => {
    if (!obj.dir) entries.push({ path: normalizePath(relPath), obj });
  });

  const { strip, rootName } = stripCommonRoot(entries.map((e) => e.path));
  const skipped = new Set<string>();
  const results: RepoFile[] = [];
  let i = 0;
  for (const e of entries) {
    if (signal?.aborted) throw abortError();
    if (i++ % YIELD_EVERY === 0) await yieldToBrowser();
    const path = strip ? e.path.slice(strip) : e.path;
    if (!path) continue;
    // Never inflate node_modules, .git & co. — record the directory once.
    if (recordNeverScan(path, skipped)) continue;
    const blob = await e.obj.async("blob");
    results.push(await fileToRepoFile(path, blob));
  }
  results.sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: results,
    rootName: rootName !== "repository" ? rootName : zipFile.name.replace(/\.zip$/i, ""),
    skippedDirs: [...skipped].sort(),
  };
}

// ---------- Output generation ----------

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
  note?: string;
}

export interface TreeEntry {
  path: string;
  /** Annotation appended to the tree line, e.g. "omitted: lockfile, 2,341 lines". */
  note?: string;
  /** Render as a directory (used for not-scanned dirs). */
  dir?: boolean;
}

export function buildTree(entries: (string | TreeEntry)[], rootName: string): string {
  const root: TreeNode = { name: rootName, children: new Map(), isFile: false };
  for (const raw of entries) {
    const e: TreeEntry = typeof raw === "string" ? { path: raw } : raw;
    let node = root;
    const parts = e.path.split("/");
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, children: new Map(), isFile: leaf && !e.dir });
      }
      node = node.children.get(part)!;
      if (leaf && e.note) node.note = e.note;
    });
  }
  const lines: string[] = [root.name + "/"];
  const walk = (node: TreeNode, prefix: string) => {
    const kids = [...node.children.values()].sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    kids.forEach((kid, i) => {
      const last = i === kids.length - 1;
      const note = kid.note ? `  (${kid.note})` : "";
      lines.push(prefix + (last ? "└── " : "├── ") + kid.name + (kid.isFile ? "" : "/") + note);
      if (!kid.isFile) walk(kid, prefix + (last ? "    " : "│   "));
    });
  };
  walk(root, "");
  return lines.join("\n");
}

export function languageFor(path: string): string {
  const name = path.split("/").pop() || "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
    c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", php: "php",
    html: "html", css: "css", scss: "scss", sass: "sass", less: "less",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml", md: "markdown",
    sh: "bash", bash: "bash", zsh: "bash", sql: "sql", graphql: "graphql", prisma: "prisma",
    vue: "vue", svelte: "svelte", dart: "dart", r: "r", lua: "lua", ex: "elixir", exs: "elixir",
    dockerfile: "dockerfile",
  };
  if (name.toLowerCase() === "dockerfile") return "dockerfile";
  if (name.toLowerCase() === "makefile") return "makefile";
  return map[ext] || "";
}

export interface OutputMeta {
  rootName: string;
  profile: string;
  intent: string;
  depth: "full" | "essentials";
  /** Optional per-file transform. Defaults to raw content. */
  render?: (file: RepoFile) => string;
  fileTags?: (file: RepoFile) => string;
  /** Files evicted by the token budget: path → reason shown in the placeholder. */
  evicted?: ReadonlyMap<string, string>;
  /** Directories that were never scanned (node_modules, .git, …). */
  skippedDirs?: readonly string[];
  /** Active token budget, for the header. */
  budget?: number | null;
}

const RULE = "================================================================";
const THIN = "----------------------------------------------------------------";

/** Full-content block for one file. Exported so the budget planner measures the exact same text. */
export function renderFileBlock(f: RepoFile, meta: Pick<OutputMeta, "render" | "fileTags">): string {
  const lang = languageFor(f.path);
  const tags = meta.fileTags?.(f);
  const bodyText = meta.render ? meta.render(f) : (f.content || "").replace(/\r\n/g, "\n").trimEnd();
  return [RULE, `FILE: ${f.path}${tags ? `  [${tags}]` : ""}`, RULE, "```" + lang, bodyText, "```", ""].join("\n");
}

/** One-line placeholder block, e.g. "FILE: package-lock.json  [2,341 lines omitted: package-lock.json (lockfile)]". */
export function renderPlaceholderBlock(f: RepoFile, reason: string): string {
  return [THIN, `FILE: ${f.path}  [${placeholderText(f, reason)}]`, THIN, ""].join("\n");
}

export function generateOutput(files: RepoFile[], meta: OutputMeta): string {
  const full: RepoFile[] = [];
  const omitted: { file: RepoFile; reason: string }[] = [];
  const blocks: string[] = [];

  // Walk in path order so placeholders land exactly where the file would have been.
  for (const f of files) {
    const d = dispositionOf(f, meta.evicted?.get(f.path) ?? null);
    if (d.kind === "full") {
      full.push(f);
      blocks.push(renderFileBlock(f, meta));
    } else if (d.kind === "placeholder") {
      omitted.push({ file: f, reason: d.reason });
      blocks.push(renderPlaceholderBlock(f, d.reason));
    }
  }

  const now = new Date().toISOString().slice(0, 10);
  const depthNote =
    meta.depth === "essentials"
      ? "Each file has been crushed to imports, types, and signatures. Bodies are omitted."
      : "Each file is included in full, delimited by a header showing its path.";
  const omittedNote =
    omitted.length > 0
      ? `${omitted.length} file(s) appear only as one-line placeholders (lockfiles, build output, minified or generated code, binaries, or files dropped to fit the token budget). They exist in the repository but their content was intentionally left out.`
      : "";
  const skippedNote =
    meta.skippedDirs && meta.skippedDirs.length > 0
      ? `Not scanned at all: ${meta.skippedDirs.map((d) => d + "/").join(", ")}.`
      : "";

  const treeEntries: TreeEntry[] = [
    ...full.map((f) => ({ path: f.path })),
    ...omitted.map(({ file, reason }) => ({
      path: file.path,
      note: file.content !== null && file.lines > 0 ? `omitted: ${reason}, ${file.lines.toLocaleString("en-US")} lines` : `omitted: ${reason}`,
    })),
    ...(meta.skippedDirs ?? []).map((d) => ({ path: d, dir: true, note: "not scanned" })),
  ];

  const header = [
    RULE,
    `Repository: ${meta.rootName}`,
    `Crushed by Code Crusher on ${now}`,
    `Profile: ${meta.profile}`,
    `Depth: ${meta.depth === "essentials" ? "essentials (signatures & structure)" : "full source"}`,
    `Files included: ${full.length}`,
    `Files omitted (placeholders): ${omitted.length}`,
    ...(meta.budget ? [`Token budget: ${meta.budget.toLocaleString("en-US")} (estimate ≈ characters ÷ 4)`] : []),
    RULE,
    "",
    "TASK FOR THE AI",
    THIN,
    meta.intent.trim() || "Analyze this repository.",
    "",
    depthNote,
    ...(omittedNote ? [omittedNote] : []),
    ...(skippedNote ? [skippedNote] : []),
    "",
    THIN,
    "DIRECTORY STRUCTURE",
    THIN,
    "",
    buildTree(treeEntries, meta.rootName),
    "",
  ].join("\n");

  return header + "\n" + blocks.join("\n") + "\n" + RULE + "\nEND OF REPOSITORY — CODE CRUSHER\n" + RULE + "\n";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
