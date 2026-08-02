import os from "node:os";
import { statfs } from "node:fs/promises";
import type { Request, Response } from "express";
import type { ServiceRegistry } from "../register/serviceRegistry.js";

interface DiskUsage {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

async function getDiskUsage(): Promise<DiskUsage | { error: string }> {
  try {
    // `fs.statfs` (Node >=18.15 / >=19.6) reports the filesystem backing
    // `process.cwd()`. Marked best-effort: some platforms/sandboxes don't
    // support it, so a failure degrades to `{ error }` rather than
    // breaking the whole health response.
    const stats = await statfs(process.cwd());
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    return { path: process.cwd(), totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "disk usage unavailable" };
  }
}

interface NetworkSummary {
  interfaces: Array<{ name: string; family: string; address: string }>;
}

function getNetworkSummary(): NetworkSummary | { error: string } {
  try {
    // Best-effort, like `getDiskUsage()`: some sandboxes/containers deny
    // the underlying `uv_interface_addresses` syscall entirely, which
    // would otherwise crash the whole health response over a field that's
    // "nice to have" rather than essential.
    const interfaces: NetworkSummary["interfaces"] = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (!address.internal) {
          interfaces.push({ name, family: address.family, address: address.address });
        }
      }
    }
    return { interfaces };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "network usage unavailable" };
  }
}

async function runHealthCheckSafely(
  healthCheck: (() => Promise<Record<string, unknown>> | Record<string, unknown>) | undefined
): Promise<Record<string, unknown>> {
  if (!healthCheck) return { status: "not_configured" };
  try {
    return await healthCheck();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "database health check failed" };
  }
}

/**
 * `GET /health` matching the spec captured in the workspace's `tasks.todo`:
 * status, version (from the host app's own `package.json`, passed in via
 * `registerService({ version })`), timestamp, uptime, memory, cpu, disk,
 * network, and database. Database is a caller-supplied callback since
 * `@ecorpin/server` has no opinion on a service's specific DB driver.
 */
export function createHealthHandler(registry: ServiceRegistry) {
  return async function healthHandler(_req: Request, res: Response): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const [disk, database] = await Promise.all([getDiskUsage(), runHealthCheckSafely(registry.healthCheck)]);

    res.status(200).json({
      status: "OK",
      version: registry.version,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        systemFreeBytes: os.freemem(),
        systemTotalBytes: os.totalmem(),
      },
      cpu: {
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
      },
      disk,
      network: getNetworkSummary(),
      database,
    });
  };
}
