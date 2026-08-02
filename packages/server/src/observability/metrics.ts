export interface ActionMetricsSnapshot {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

/**
 * Minimal in-memory per-action counters — deliberately not a full
 * Prometheus `/metrics` endpoint yet (that's a later hardening phase per
 * the architecture doc's roadmap §22 Phase 7). Exposed via
 * `registry.metrics` mainly so tests and `ecorpin doctor`-style tooling
 * have something real to assert against today.
 */
export class MetricsCollector {
  private readonly counters = new Map<string, { count: number; errorCount: number; totalDurationMs: number }>();

  record(key: string, durationMs: number, success: boolean): void {
    const existing = this.counters.get(key) ?? { count: 0, errorCount: 0, totalDurationMs: 0 };
    existing.count += 1;
    existing.totalDurationMs += durationMs;
    if (!success) existing.errorCount += 1;
    this.counters.set(key, existing);
  }

  snapshot(key: string): ActionMetricsSnapshot | undefined {
    const existing = this.counters.get(key);
    if (!existing) return undefined;
    return {
      ...existing,
      averageDurationMs: existing.count === 0 ? 0 : existing.totalDurationMs / existing.count,
    };
  }

  snapshotAll(): Record<string, ActionMetricsSnapshot> {
    const result: Record<string, ActionMetricsSnapshot> = {};
    for (const key of this.counters.keys()) {
      const snap = this.snapshot(key);
      if (snap) result[key] = snap;
    }
    return result;
  }
}

export function actionMetricsKey(service: string, resource: string, action: string): string {
  return `${service}.${resource}.${action}`;
}
