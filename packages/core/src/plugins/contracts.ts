import type { EcorpinError } from "../errors/base.js";
import type { RequestContext } from "../types/request.js";
import type { ServiceMetadata, ServiceIdentityInfo } from "../types/service.js";
import type { ResourceMetadata } from "../types/resource.js";
import type { SDKConfig } from "../types/sdkConfig.js";

/**
 * Generic "onion" middleware signature shared by both client and server
 * pipelines. Deliberately transport-agnostic (no Express/fetch types) so
 * `@ecorpin/core` never depends on either adapter — see architecture doc
 * §14.1. `@ecorpin/client`/`@ecorpin/server` narrow `TContext` to their own
 * concrete request context when wiring a plugin's middleware into the
 * real pipeline.
 */
export type PipelineMiddleware<TContext = unknown, TResult = unknown> = (
  context: TContext,
  next: () => Promise<TResult>
) => Promise<TResult>;

export interface ClientInitContext {
  config: SDKConfig;
}

/**
 * Extension point a plugin uses to add a new top-level namespace to the
 * SDK object graph (e.g. `sdk.realtime`, `sdk.storage`) alongside the
 * per-service namespaces built from metadata — architecture doc §14.3.
 */
export interface SDKNamespaceBuilder {
  /**
   * Registers `factory` under `sdk.<name>`. Throws at SDK build time if
   * `name` collides with another plugin's namespace or a discovered
   * service name — collisions are a boot-time error, never a silent
   * runtime surprise (architecture doc §14.4).
   */
  addNamespace(name: string, factory: () => unknown): void;
}

export interface ClientPluginHooks {
  onInit?(ctx: ClientInitContext): void | Promise<void>;
  extendNamespace?(builder: SDKNamespaceBuilder): void;
  middleware?: PipelineMiddleware[];
  onServiceDiscovered?(service: ServiceMetadata): void;
  onError?(error: EcorpinError, ctx: RequestContext): EcorpinError | void;
}

export interface ActionInvocationContext {
  service: string;
  resource: string;
  action: string;
  input?: unknown;
  output?: unknown;
  success: boolean;
  error?: EcorpinError;
  durationMs: number;
  correlationId: string;
}

export interface ServerPluginHooks {
  onServiceRegistered?(service: ServiceIdentityInfo): void;
  onResourceRegistered?(resource: ResourceMetadata): void;
  onActionInvoked?(ctx: ActionInvocationContext): void;
  /** Lets a plugin add `features.*` flags (or other additive fields) to the outgoing manifest. */
  extendMetadata?(manifest: ServiceMetadata): ServiceMetadata;
  middleware?: PipelineMiddleware[];
}

/**
 * The single contract every future package (`@ecorpin/events`,
 * `@ecorpin/realtime`, `@ecorpin/storage`, ...) implements to extend the
 * platform without a breaking change to `core`, `server`, or `client`
 * (architecture doc §14).
 */
export interface EcorpinPlugin {
  name: string;
  version: string;
  client?: ClientPluginHooks;
  server?: ServerPluginHooks;
}
