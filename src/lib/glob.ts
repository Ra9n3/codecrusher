/**
 * Minimal glob matching for path filters. Supports:
 *   *   any run of characters except "/"
 *   **  any run of characters including "/"
 *   ?   a single character except "/"
 *   {a,b} alternation
 * Patterns without glob characters fall back to case-insensitive substring match,
 * which keeps the original "comma-separated terms" behaviour intact.
 */

const GLOB_CHARS = /[*?{]/;

export function hasGlobChars(pattern: string): boolean {
  return GLOB_CHARS.test(pattern);
}

export function globToRegExp(pattern: string): RegExp {
  let re = "";
  let i = 0;
  const p = pattern.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  while (i < p.length) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        // "**/" matches zero or more directories; bare "**" matches anything.
        if (p[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c === "{") {
      const end = p.indexOf("}", i);
      if (end === -1) {
        re += "\\{";
        i++;
      } else {
        const alts = p
          .slice(i + 1, end)
          .split(",")
          .map((a) => a.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"));
        re += "(?:" + alts.join("|") + ")";
        i = end + 1;
      }
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  // A pattern without a slash matches against the basename anywhere in the tree
  // ("*.test.ts" → any test file); a pattern with a slash anchors at the repo root.
  const anchored = p.includes("/") ? `^${re}$` : `(?:^|/)${re}$`;
  return new RegExp(anchored, "i");
}

/** True when `path` matches the glob (or contains the term when it has no glob characters). */
export function matchGlob(pattern: string, path: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (!hasGlobChars(trimmed)) {
    // Directory-style terms ("src/api/") match as prefixes or path segments.
    return path.toLowerCase().includes(trimmed.toLowerCase().replace(/^\.\//, ""));
  }
  const re = globToRegExp(trimmed);
  // Directory globs like "src/api/**" should also match the directory's files when
  // the user wrote "src/api/*" expecting recursion — "*" stays non-recursive on purpose.
  return re.test(path);
}

/** Splits a comma/newline-separated list of patterns. */
export function splitPatterns(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function matchesAny(patterns: string[], path: string): boolean {
  return patterns.some((p) => matchGlob(p, path));
}
