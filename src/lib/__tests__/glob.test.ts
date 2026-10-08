import { describe, expect, it } from "vitest";
import { globToRegExp, hasGlobChars, matchGlob, matchesAny, splitPatterns } from "../glob";

describe("glob matching", () => {
  it("falls back to substring matching when no glob characters are present", () => {
    expect(hasGlobChars("src/api")).toBe(false);
    expect(matchGlob("src/api", "src/api/users.ts")).toBe(true);
    expect(matchGlob("API", "src/api/users.ts")).toBe(true); // case-insensitive
    expect(matchGlob("services", "src/api/users.ts")).toBe(false);
  });

  it("matches * within a single path segment", () => {
    expect(matchGlob("src/*.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("src/*.ts", "src/lib/index.ts")).toBe(false);
  });

  it("matches ** across directories", () => {
    expect(matchGlob("src/**/*.test.ts", "src/lib/__tests__/a.test.ts")).toBe(true);
    expect(matchGlob("src/**/*.test.ts", "src/a.test.ts")).toBe(true); // "**/" matches zero dirs
    expect(matchGlob("src/api/**", "src/api/v1/users.ts")).toBe(true);
    expect(matchGlob("src/api/**", "src/apis/users.ts")).toBe(false);
  });

  it("matches basename-only patterns anywhere in the tree", () => {
    expect(matchGlob("*.stories.tsx", "src/components/Button.stories.tsx")).toBe(true);
    expect(matchGlob("*.stories.tsx", "Button.stories.tsx")).toBe(true);
    expect(matchGlob("*.stories.tsx", "src/components/Button.tsx")).toBe(false);
  });

  it("supports ? and {a,b} alternation", () => {
    expect(matchGlob("src/file?.ts", "src/file1.ts")).toBe(true);
    expect(matchGlob("src/file?.ts", "src/file10.ts")).toBe(false);
    expect(matchGlob("*.{ts,tsx}", "src/App.tsx")).toBe(true);
    expect(matchGlob("*.{ts,tsx}", "src/App.css")).toBe(false);
  });

  it("escapes regex metacharacters in literals", () => {
    expect(globToRegExp("src/a.b/*.ts").test("src/aXb/c.ts")).toBe(false);
    expect(globToRegExp("src/a.b/*.ts").test("src/a.b/c.ts")).toBe(true);
  });

  it("splits comma / newline separated pattern lists", () => {
    expect(splitPatterns("src/api, *.test.ts\n legacy ")).toEqual(["src/api", "*.test.ts", "legacy"]);
    expect(matchesAny(["legacy", "*.snap"], "src/__snapshots__/a.snap")).toBe(true);
    expect(matchesAny([], "anything")).toBe(false);
  });
});
