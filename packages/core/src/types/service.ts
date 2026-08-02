import type { ResourceMetadata } from "./resource.js";

export type AuthStrategyName = "apiKey" | "serviceToken" | "oauth2";

export interface ServiceIdentityInfo {
  name: string;
  version: string;
  description?: string;
  baseUrl?: string;
}

export interface ServiceAuthentication {
  required: boolean;
  strategies: AuthStrategyName[];
}

export interface ServiceFeatures {
  realtime?: boolean;
  events?: boolean;
  [futurePluginFeatureFlag: string]: boolean | undefined;
}

/**
 * The full Metadata Manifest a service exposes via its discovery endpoint
 * (architecture doc §10). This is the single artifact `@ecorpin/client`
 * consumes to build `sdk.<service>.*`.
 */
export interface ServiceMetadata {
  protocolVersion: string;
  service: ServiceIdentityInfo;
  authentication: ServiceAuthentication;
  features: ServiceFeatures;
  resources: ResourceMetadata[];
  generatedAt: string;
  metadataHash: string;
}
