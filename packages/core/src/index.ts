/**
 * @ecorpin/core — shared types, errors, metadata schema, auth contracts,
 * and plugin interfaces for the Ecorpin Service SDK Framework.
 *
 * No HTTP logic. No framework dependencies. Every other Ecorpin package
 * depends on this one; this one depends on nothing but the standard
 * library. See docs/SDK_PLATFORM_ARCHITECTURE.md §5.1.
 */
export * from "./types/index.js";
export * from "./errors/index.js";
export * from "./auth/index.js";
export * from "./metadata/index.js";
export * from "./plugins/index.js";
export * from "./utils/index.js";
export * from "./constants.js";
