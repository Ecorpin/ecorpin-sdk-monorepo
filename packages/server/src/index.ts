/**
 * @ecorpin/server — turns an Express service into a self-describing
 * Ecorpin node. See docs/SDK_PLATFORM_ARCHITECTURE.md §5.2.
 *
 * Minimal usage:
 *
 * ```
 * const { registerService, registerResource, createEcorpinRouter } = require("@ecorpin/server");
 *
 * registerService({ name: "crm", version: "1.0.0" });
 * registerResource("users", { actions: { list: { handler: ... } } });
 *
 * app.use("/api/ecorpin", createEcorpinRouter());
 * ```
 */
export * from "./register/index.js";
export * from "./discovery/index.js";
export * from "./health/index.js";
export * from "./auth/index.js";
export * from "./validation/index.js";
export * from "./observability/index.js";
export * from "./errors/index.js";
export * from "./adapters/index.js";
