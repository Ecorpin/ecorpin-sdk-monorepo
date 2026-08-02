export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)/;

/**
 * Minimal semver parser covering `major.minor.patch` (ignoring any
 * pre-release/build metadata suffix) — enough for the framework's own
 * version-compatibility checks without pulling in the full `semver`
 * package as a dependency of `@ecorpin/core`.
 */
export function parseSemver(version: string): ParsedSemver | undefined {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) return undefined;
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

/** -1 if `a` < `b`, 0 if equal, 1 if `a` > `b`. Throws on unparseable input. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) {
    throw new Error(`Cannot compare invalid semver strings: "${a}", "${b}"`);
  }
  for (const key of ["major", "minor", "patch"] as const) {
    if (parsedA[key] !== parsedB[key]) {
      return parsedA[key] < parsedB[key] ? -1 : 1;
    }
  }
  return 0;
}

/** True if `a` and `b` share the same major version — the platform's compatibility contract (§18.1). */
export function isSameMajor(a: string, b: string): boolean {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  return !!parsedA && !!parsedB && parsedA.major === parsedB.major;
}
