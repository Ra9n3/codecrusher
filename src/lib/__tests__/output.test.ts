import { describe, expect, it } from "vitest";
import { RepoFile, buildTree, finalizeRepoFile, generateOutput } from "../processor";

function file(path: string, content: string | null, extra: Partial<RepoFile> = {}): RepoFile {
  const raw = { path, size: content?.length ?? 1234, content, skippedReason: content === null ? "binary" : undefined };
  return { ...finalizeRepoFile(raw), ...extra };
}

const meta = { rootName: "demo", profile: "Everything", intent: "Explain.", depth: "full" as const };

describe("finalizeRepoFile", () => {
  it("collapses junk by default and counts lines", () => {
    const lock = finalizeRepoFile({ path: "yarn.lock", size: 10, content: "a\nb\nc" });
    expect(lock.junk).toBe("lockfile");
    expect(lock.collapsed).toBe(true);
    expect(lock.included).toBe(true);
    expect(lock.lines).toBe(3);
    const src = finalizeRepoFile({ path: "src/a.ts", size: 1, content: "x" });
    expect(src.junk).toBeNull();
    expect(src.collapsed).toBe(false);
  });
});

describe("generateOutput placeholders", () => {
  const files: RepoFile[] = [
    file("README.md", "# Hi"),
    file("logo.png", null),
    file("package-lock.json", "{\n}\n"),
    file("src/index.ts", "export {}"),
    file("src/secret.ts", "nope", { included: false }),
  ];

  it("inserts one-line placeholders at the file's sorted position", () => {
    const out = generateOutput(files, meta);
    const readme = out.indexOf("FILE: README.md");
    const logo = out.indexOf("FILE: logo.png  [1.2 KB omitted: logo.png (binary)]");
    const lock = out.indexOf("FILE: package-lock.json  [2 lines omitted: package-lock.json (lockfile)]");
    const index = out.indexOf("FILE: src/index.ts");
    expect(readme).toBeGreaterThan(-1);
    expect(logo).toBeGreaterThan(readme);
    expect(lock).toBeGreaterThan(logo);
    expect(index).toBeGreaterThan(lock);
    expect(out).not.toContain("src/secret.ts");
    expect(out).not.toContain("{\n}\n```"); // lockfile body is not emitted
  });

  it("annotates the directory tree and the header", () => {
    const out = generateOutput(files, { ...meta, skippedDirs: ["node_modules"] });
    expect(out).toContain("Files included: 2");
    expect(out).toContain("Files omitted (placeholders): 2");
    expect(out).toContain("package-lock.json  (omitted: lockfile, 2 lines)");
    expect(out).toContain("logo.png  (omitted: binary)");
    expect(out).toContain("node_modules/  (not scanned)");
    expect(out).toContain("Not scanned at all: node_modules/.");
  });

  it("emits budget placeholders for evicted files and keeps expanded junk in full", () => {
    const expanded = files.map((f) => (f.path === "package-lock.json" ? { ...f, collapsed: false } : f));
    const out = generateOutput(expanded, { ...meta, evicted: new Map([["src/index.ts", "token budget"]]), budget: 50_000 });
    expect(out).toContain("FILE: src/index.ts  [1 line omitted: src/index.ts (token budget)]");
    expect(out).not.toContain("export {}");
    expect(out).toContain("```json\n{\n}\n```"); // expanded lockfile is included in full
    expect(out).toContain("Token budget: 50,000");
  });
});

describe("buildTree", () => {
  it("renders notes and directory markers", () => {
    const tree = buildTree(["src/a.ts", { path: "src/b.min.js", note: "omitted: minified" }, { path: "node_modules", dir: true, note: "not scanned" }], "repo");
    expect(tree).toBe(["repo/", "├── node_modules/  (not scanned)", "└── src/", "    ├── a.ts", "    └── b.min.js  (omitted: minified)"].join("\n"));
  });
});
