import type { ServiceMetadata } from "../types/service.js";

/**
 * Current major.minor of the Ecorpin metadata protocol (architecture doc
 * §10/§18.2). `@ecorpin/client` refuses to build a namespace from a
 * manifest whose major segment it doesn't understand.
 */
export const METADATA_PROTOCOL_VERSION = "1.0";

function parseMajor(version: string): number | undefined {
  const major = version.split(".")[0];
  if (!major) return undefined;
  const parsed = Number.parseInt(major, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * True if a client running `METADATA_PROTOCOL_VERSION` can safely parse a
 * manifest advertising `manifestProtocolVersion` — i.e. same major segment.
 * Minor/patch differences are always additive and backward-compatible
 * (architecture doc §18.2).
 */
export function isProtocolVersionCompatible(manifestProtocolVersion: string): boolean {
  const clientMajor = parseMajor(METADATA_PROTOCOL_VERSION);
  const manifestMajor = parseMajor(manifestProtocolVersion);
  if (clientMajor === undefined || manifestMajor === undefined) return false;
  return clientMajor === manifestMajor;
}

/**
 * Structural (not deep schema) validation that a fetched JSON payload has
 * the shape of a `ServiceMetadata` manifest, before it's trusted to build
 * an SDK namespace. Intentionally permissive on unknown/optional fields so
 * additive manifest changes never break older clients.
 */
export function isServiceMetadata(value: unknown): value is ServiceMetadata {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.protocolVersion === "string" &&
    typeof v.service === "object" &&
    v.service !== null &&
    typeof (v.service as Record<string, unknown>).name === "string" &&
    typeof (v.service as Record<string, unknown>).version === "string" &&
    typeof v.authentication === "object" &&
    v.authentication !== null &&
    Array.isArray(v.resources) &&
    typeof v.metadataHash === "string" &&
    typeof v.generatedAt === "string"
  );
}
