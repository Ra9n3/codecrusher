import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

vi.mock("../lib/processor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/processor")>();
  const files = [
    actual.finalizeRepoFile({ path: "README.md", size: 6, content: "# Demo" }),
    actual.finalizeRepoFile({
      path: "src/App.tsx",
      size: 44,
      content: "export default function App() { return <div /> }",
    }),
    actual.finalizeRepoFile({
      path: "src/store/cartSlice.ts",
      size: 24,
      content: "export const slice = 1;",
    }),
  ];
  return {
    ...actual,
    processFileList: vi.fn(async () => ({
      files,
      rootName: "demo-repo",
      skippedDirs: [],
    })),
  };
});

afterEach(cleanup);

const PATHS = ["README.md", "src/App.tsx", "src/store/cartSlice.ts"];

async function uploadRepo() {
  const { container } = render(<App />);
  const input = container.querySelector(
    "input[webkitdirectory]",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([""], "dummy")] } });
  await screen.findByLabelText(`Include ${PATHS[0]}`);
}

const allBtn = () => screen.getByRole("button", { name: "All" });
const noneBtn = () => screen.getByRole("button", { name: "None" });
const box = (path: string) =>
  screen.getByLabelText(`Include ${path}`) as HTMLInputElement;
const checkedCount = () =>
  screen
    .getAllByLabelText(/^Include /)
    .filter((el) => (el as HTMLInputElement).checked).length;

describe("App All/None deliver their promise over manual picks", () => {
  it("None clears every checkbox even after a file was manually pinned", async () => {
    await uploadRepo();
    fireEvent.click(noneBtn());
    expect(checkedCount()).toBe(0);

    fireEvent.click(box("src/App.tsx"));
    expect(box("src/App.tsx").checked).toBe(true);
    expect(screen.getByText("custom")).toBeTruthy();

    fireEvent.click(noneBtn());
    expect(checkedCount()).toBe(0);
    expect(screen.queryByText("custom")).toBeNull();
    expect(noneBtn().getAttribute("aria-pressed")).toBe("true");
  });

  it("All restores every checkbox even after a file was manually pinned off", async () => {
    await uploadRepo();
    fireEvent.click(box("src/App.tsx"));
    expect(box("src/App.tsx").checked).toBe(false);
    expect(screen.getByText("custom")).toBeTruthy();

    fireEvent.click(allBtn());
    expect(checkedCount()).toBe(PATHS.length);
    expect(screen.queryByText("custom")).toBeNull();
    expect(allBtn().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("App manual picks survive lens changes", () => {
  it("keeps a pinned file checked across category chips and path filters", async () => {
    await uploadRepo();
    fireEvent.click(noneBtn());
    fireEvent.click(box("src/App.tsx"));
    expect(box("src/App.tsx").checked).toBe(true);

    fireEvent.click(screen.getByTitle("READMEs and documentation"));
    expect(box("src/App.tsx").checked).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("src/api, services"), {
      target: { value: "README" },
    });
    expect(box("src/App.tsx").checked).toBe(true);
    expect(screen.getByText("pinned")).toBeTruthy();
  });
});
