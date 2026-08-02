import { PluginError, type SDKNamespaceBuilder } from "@ecorpin/core";

/**
 * Concrete `SDKNamespaceBuilder` (architecture doc §14.1/§14.3): lets a
 * plugin's `extendNamespace` hook add a new top-level `sdk.<name>`
 * namespace (e.g. `sdk.realtime`) alongside the per-service namespaces
 * built from metadata. A name collision — with another plugin, or with a
 * service name once resolved — is a boot-time error, never a silent
 * runtime surprise (architecture doc §14.4).
 */
export class PluginNamespaceRegistry implements SDKNamespaceBuilder {
  private readonly namespaces = new Map<string, unknown>();

  addNamespace(name: string, factory: () => unknown): void {
    if (this.namespaces.has(name)) {
      throw new PluginError(`Plugin namespace "sdk.${name}" is already registered by another plugin.`);
    }
    this.namespaces.set(name, factory());
  }

  has(name: string): boolean {
    return this.namespaces.has(name);
  }

  get(name: string): unknown {
    return this.namespaces.get(name);
  }
}
