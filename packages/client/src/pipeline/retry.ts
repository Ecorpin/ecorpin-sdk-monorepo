import { EcorpinError, type ActionMetadata } from "@ecorpin/core";

const SAFE_METHODS = new Set(["GET"]);

/**
 * An error is retried only if the taxonomy marks it `retryable` *and* the
 * action is either a safe HTTP method (GET) or explicitly `idempotent`
 * (architecture doc §16.5) — never on an ambiguous mutating outcome.
 */
export function isRetryable(err: unknown, action: ActionMetadata): boolean {
  if (!(err instanceof EcorpinError) || !err.retryable) return false;
  return SAFE_METHODS.has(action.method) || Boolean(action.idempotent);
}

function computeBackoffMs(attemptNumber: number): number {
  const base = 200 * 2 ** (attemptNumber - 1);
  const jitter = Math.random() * base * 0.3;
  return Math.min(base + jitter, 5000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Runs `attempt` up to `maxRetries + 1` times total, backing off with
 * jitter between attempts, stopping as soon as `shouldRetry` returns false
 * for the error just thrown (architecture doc §7 failure branch).
 */
export async function withRetry<T>(
  attempt: (attemptNumber: number) => Promise<T>,
  maxRetries: number,
  shouldRetry: (err: unknown) => boolean
): Promise<T> {
  let lastError: unknown;
  for (let attemptNumber = 1; attemptNumber <= maxRetries + 1; attemptNumber += 1) {
    try {
      return await attempt(attemptNumber);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attemptNumber > maxRetries;
      if (isLastAttempt || !shouldRetry(err)) {
        throw err;
      }
      await sleep(computeBackoffMs(attemptNumber));
    }
  }
  // Unreachable (the loop always returns or throws), kept for type-narrowing.
  throw lastError;
}
