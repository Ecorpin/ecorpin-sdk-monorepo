import type { Request, Response } from "express";
import type { ServiceRegistry } from "../register/serviceRegistry.js";

/**
 * `GET /discovery` — returns this service's Metadata Manifest, with `ETag`
 * support so `@ecorpin/client` can revalidate with `If-None-Match` instead
 * of re-downloading an unchanged manifest (architecture doc §9.2, §17.1).
 */
export function createDiscoveryHandler(registry: ServiceRegistry) {
  return function discoveryHandler(req: Request, res: Response): void {
    const manifest = registry.buildManifest();
    const etag = `"${manifest.metadataHash}"`;

    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", etag);

    if (req.header("if-none-match") === etag) {
      res.status(304).end();
      return;
    }

    res.status(200).json(manifest);
  };
}
