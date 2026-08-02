import {
  assertUrlSafeName,
  contentHash,
  METADATA_PROTOCOL_VERSION,
  type ActionMetadata,
  type EcorpinPlugin,
  type ResourceMetadata,
  type ServiceMetadata,
} from "@ecorpin/core";
import { resolveAction, type ResolvedAction } from "./action.js";
import type { RegisterResourceOptions } from "./types.js";

export interface ServerAuthConfig {
  /** Static allow-list: API key -> granted scopes, or `true` for unrestricted access. */
  apiKeys: Record<string, string[] | true>;
}

export interface RegisterServiceOptions {
  name: string;
  version: string;
  description?: string;
  auth?: ServerAuthConfig;
  /**
   * Caller-supplied database/dependency check for the health endpoint —
   * `@ecorpin/server` deliberately has no opinion on MySQL/Postgres/etc.
   */
  healthCheck?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  plugins?: EcorpinPlugin[];
}

export interface RegisteredResource {
  name: string;
  description?: string;
  actions: ResolvedAction[];
}

/**
 * Accumulates everything registered via `registerService()`/
 * `registerResource()` for one process and turns it into a Metadata
 * Manifest + the data the Express adapter needs to mount real routes.
 * One `ServiceRegistry` per process — the framework's model is one process
 * is one service (architecture doc §2).
 */
export class ServiceRegistry {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly auth: ServerAuthConfig;
  readonly healthCheck?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  readonly plugins: EcorpinPlugin[];

  private readonly resources = new Map<string, RegisteredResource>();

  constructor(options: RegisterServiceOptions) {
    assertUrlSafeName(options.name, "service");
    this.name = options.name;
    this.version = options.version;
    this.description = options.description;
    this.auth = options.auth ?? { apiKeys: {} };
    this.healthCheck = options.healthCheck;
    this.plugins = options.plugins ?? [];
  }

  registerResource(name: string, definition: RegisterResourceOptions): RegisteredResource {
    assertUrlSafeName(name, "resource");
    if (this.resources.has(name)) {
      throw new Error(`Resource "${name}" is already registered on service "${this.name}".`);
    }

    const actions = Object.entries(definition.actions).map(([actionName, actionDef]) => {
      assertUrlSafeName(actionName, "action");
      return resolveAction(name, actionName, actionDef);
    });

    const resource: RegisteredResource = { name, description: definition.description, actions };
    this.resources.set(name, resource);

    for (const plugin of this.plugins) {
      plugin.server?.onResourceRegistered?.(this.toResourceMetadata(resource));
    }

    return resource;
  }

  getResource(name: string): RegisteredResource | undefined {
    return this.resources.get(name);
  }

  listResources(): RegisteredResource[] {
    return [...this.resources.values()];
  }

  private toActionMetadata(action: ResolvedAction): ActionMetadata {
    return {
      name: action.name,
      method: action.method,
      path: action.path,
      auth: action.definition.auth,
      idempotent: action.idempotent,
      cacheable: action.definition.cacheable,
      timeoutMs: action.definition.timeoutMs,
      deprecated: action.definition.deprecated,
    };
  }

  private toResourceMetadata(resource: RegisteredResource): ResourceMetadata {
    return {
      name: resource.name,
      description: resource.description,
      actions: resource.actions.map((action) => this.toActionMetadata(action)),
    };
  }

  /**
   * Builds the Metadata Manifest advertised at the discovery endpoint
   * (architecture doc §10). `metadataHash` is derived from the structural
   * (non-timestamp) part of the manifest, so it only changes when the
   * actual contract changes — the basis for `ETag`/`If-None-Match` caching
   * on the client (architecture doc §17.1).
   */
  buildManifest(): ServiceMetadata {
    const resourceMetadata = this.listResources().map((resource) => this.toResourceMetadata(resource));

    let manifest: ServiceMetadata = {
      protocolVersion: METADATA_PROTOCOL_VERSION,
      service: { name: this.name, version: this.version, description: this.description },
      authentication: {
        required: true,
        strategies: ["apiKey"],
      },
      features: {},
      resources: resourceMetadata,
      generatedAt: new Date().toISOString(),
      metadataHash: "",
    };

    for (const plugin of this.plugins) {
      if (plugin.server?.extendMetadata) {
        manifest = plugin.server.extendMetadata(manifest);
      }
    }

    const { generatedAt: _generatedAt, metadataHash: _metadataHash, ...structural } = manifest;
    manifest.metadataHash = contentHash(structural);

    return manifest;
  }
}
