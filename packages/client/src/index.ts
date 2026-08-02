/**
 * @ecorpin/client — turns N services' metadata into one type-safe, fluent
 * SDK. See docs/SDK_PLATFORM_ARCHITECTURE.md §5.3.
 *
 * ```
 * const sdk = createSDK({ registry: { crm: "http://localhost:5602/api/ecorpin" } });
 * const users = await sdk.crm.users.list();
 * ```
 */
export * from "./types.js";
export * from "./sdk/index.js";
export * from "./discovery/index.js";
export * from "./cache/index.js";
export * from "./auth/index.js";
export * from "./pipeline/index.js";
