/**
 * Reads a process environment variable, guarded so `@ecorpin/client`'s
 * discovery/auth modules don't hard-crash if ever loaded in a runtime
 * without `process.env` (e.g. a future browser build) — they simply
 * behave as if the variable is unset.
 */
export function readEnvVar(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    return process.env[name];
  }
  return undefined;
}

/**
 * `SDK_SERVICE_<NAME>_URL` / `SDK_SERVICE_<NAME>_TOKEN` naming convention
 * from architecture doc §8/§13.3.
 */
export function serviceEnvVarName(serviceName: string, suffix: "URL" | "TOKEN"): string {
  const normalized = serviceName.toUpperCase().replace(/-/g, "_");
  return `SDK_SERVICE_${normalized}_${suffix}`;
}
