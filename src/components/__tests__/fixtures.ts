import { ClassifiedFile, classifyFile } from "../../lib/filters";
import { classifyLayer } from "../../lib/layers";
import { finalizeRepoFile } from "../../lib/processor";

/** Builds a fully classified file the way App.tsx does after ingestion. */
export function mkFile(path: string, content: string | null, extra: Partial<ClassifiedFile> = {}): ClassifiedFile {
  const raw = finalizeRepoFile({
    path,
    size: content?.length ?? 2048,
    content,
    skippedReason: content === null ? "binary" : undefined,
  });
  return {
    ...raw,
    categories: classifyFile(raw),
    pinned: false,
    layer: classifyLayer(raw),
    ...extra,
  };
}

export const demoFiles: ClassifiedFile[] = [
  mkFile("README.md", "# Demo"),
  mkFile("package-lock.json", "{\n}\n"),
  mkFile("src/App.tsx", "export default function App() { return <div /> }"),
  mkFile("src/store/cartSlice.ts", "export const slice = 1"),
  mkFile("public/logo.png", null),
];
