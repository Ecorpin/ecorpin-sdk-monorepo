import express, { type Request, type RequestHandler, type Response, type NextFunction, type Router } from "express";
import { DEFAULT_MOUNT_PATH, type ResponseEnvelope } from "@ecorpin/core";
import { getCurrentRegistry } from "../register/registerService.js";
import type { ServiceRegistry } from "../register/serviceRegistry.js";
import type { ResolvedAction } from "../register/action.js";
import { createDiscoveryHandler } from "../discovery/discoveryEndpoint.js";
import { createHealthHandler } from "../health/healthEndpoint.js";
import { createAuthMiddleware } from "../auth/authMiddleware.js";
import { createValidateMiddleware } from "../validation/validateMiddleware.js";
import { correlationIdMiddleware, requestLogger } from "../observability/logging.js";
import { MetricsCollector, actionMetricsKey } from "../observability/metrics.js";
import { mapThrownError } from "../errors/mapThrownError.js";
import type { ActionContext } from "../register/types.js";

export interface CreateEcorpinRouterOptions {
  /** Defaults to the registry created by the most recent `registerService()` call. */
  registry?: ServiceRegistry;
  /** Opt out of the built-in request logger (e.g. if the host app has its own). */
  logging?: boolean;
}

function expressPathFor(action: ResolvedAction): string {
  // Express uses the same `:param` syntax our convention table already
  // produces (e.g. "/:id/archive"), so no translation is needed here.
  return action.path;
}

function mountAction(router: Router, registry: ServiceRegistry, resourceName: string, action: ResolvedAction, metrics: MetricsCollector): void {
  const routePath = `/${resourceName}${expressPathFor(action)}`.replace(/\/$/, "") || `/${resourceName}`;

  const handlers: RequestHandler[] = [
    createAuthMiddleware(registry.auth, action),
    createValidateMiddleware(action),
    async (req: Request, res: Response) => {
      const startedAt = Date.now();
      const correlationId = req.ecorpinCorrelationId ?? "unknown";
      const metricsKey = actionMetricsKey(registry.name, resourceName, action.name);

      const ctx: ActionContext = {
        input: req.ecorpinValidatedInput,
        params: req.params,
        query: req.query as Record<string, unknown>,
        auth: req.ecorpinAuth,
        correlationId,
        req,
        res,
      };

      try {
        const result = await action.definition.handler(ctx);
        const durationMs = Date.now() - startedAt;
        metrics.record(metricsKey, durationMs, true);
        for (const plugin of registry.plugins) {
          plugin.server?.onActionInvoked?.({
            service: registry.name,
            resource: resourceName,
            action: action.name,
            input: ctx.input,
            output: result,
            success: true,
            durationMs,
            correlationId,
          });
        }

        const envelope: ResponseEnvelope = { data: result };
        res.status(action.method === "POST" ? 201 : 200).json(envelope);
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        metrics.record(metricsKey, durationMs, false);
        const mapped = mapThrownError(err, correlationId);
        for (const plugin of registry.plugins) {
          plugin.server?.onActionInvoked?.({
            service: registry.name,
            resource: resourceName,
            action: action.name,
            input: ctx.input,
            success: false,
            durationMs,
            correlationId,
          });
        }
        // Errors are always fully handled here (mapped + responded to) —
        // `next(err)` is intentionally not called so a host app's own
        // Express error handler never sees (and can't double-format) an
        // Ecorpin action's error response.
        res.status(mapped.httpStatus).json(mapped.envelope);
      }
    },
  ];

  switch (action.method) {
    case "GET":
      router.get(routePath, ...handlers);
      break;
    case "POST":
      router.post(routePath, ...handlers);
      break;
    case "PUT":
      router.put(routePath, ...handlers);
      break;
    case "PATCH":
      router.patch(routePath, ...handlers);
      break;
    case "DELETE":
      router.delete(routePath, ...handlers);
      break;
    default:
      throw new Error(`Unsupported HTTP method "${action.method}" for resource "${resourceName}" action "${action.name}".`);
  }
}

/**
 * Builds a mountable Express `Router` from whatever has been registered so
 * far via `registerService()`/`registerResource()` (architecture doc §5.2,
 * §6). The host app decides where to mount it — see `mountEcorpinRouter()`
 * for the common case and `docs/SDK_PLATFORM_ARCHITECTURE.md` §9.1/§11.2
 * for why the mount path is deliberately not hardcoded here.
 */
export function createEcorpinRouter(options: CreateEcorpinRouterOptions = {}): Router {
  const registry = options.registry ?? getCurrentRegistry();
  const router = express.Router();
  const metrics = new MetricsCollector();

  router.use(express.json());
  router.use(correlationIdMiddleware);
  if (options.logging !== false) {
    router.use(requestLogger);
  }

  router.get("/discovery", createDiscoveryHandler(registry));
  router.get("/health", createHealthHandler(registry));

  for (const resource of registry.listResources()) {
    for (const action of resource.actions) {
      mountAction(router, registry, resource.name, action, metrics);
    }
  }

  // Catches errors passed via `next(err)` from the auth/validation
  // middleware (action handlers map + respond to their own errors
  // directly, see `mountAction()`) — kept as a real 4-arg Express error
  // handler (arity matters: Express detects error middleware by
  // `fn.length === 4`) so a host app's own error handler never sees an
  // Ecorpin request fail through it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const correlationId = req.ecorpinCorrelationId ?? "unknown";
    const mapped = mapThrownError(err, correlationId);
    res.status(mapped.httpStatus).json(mapped.envelope);
  });

  return router;
}

/**
 * Convenience helper: `app.use(mountPath, createEcorpinRouter())` in one
 * call. `mountPath` defaults to `DEFAULT_MOUNT_PATH` ("/__ecorpin"); pass
 * an explicit path (e.g. "/api/ecorpin") when the host app wants discovery
 * to fall under an existing prefix (e.g. to reuse that prefix's CSRF/rate-
 * limit exemptions, as ecorpin-app's pilot integration does).
 */
export function mountEcorpinRouter(
  app: { use: (path: string, router: Router) => void },
  options?: CreateEcorpinRouterOptions & { mountPath?: string }
): Router {
  const router = createEcorpinRouter(options);
  app.use(options?.mountPath ?? DEFAULT_MOUNT_PATH, router);
  return router;
}
