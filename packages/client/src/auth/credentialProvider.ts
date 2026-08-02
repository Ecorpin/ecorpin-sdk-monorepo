import { AuthenticationError, type AuthHeader, type Credentials } from "@ecorpin/core";
import type { ClientSDKConfig } from "../types.js";
import { readEnvVar, serviceEnvVarName } from "../discovery/env.js";

/**
 * Resolution order (architecture doc §13.3): an explicit `config.credentials`
 * override always wins; otherwise falls back to environment variables —
 * a per-service token (`SDK_SERVICE_<NAME>_TOKEN`) if set, else the global
 * `SDK_API_KEY`.
 */
export function resolveCredentials(serviceName: string, config: ClientSDKConfig): Credentials {
  return config.credentials ?? createEnvApiKeyCredentials(serviceName);
}

function createEnvApiKeyCredentials(serviceName: string): Credentials {
  return {
    strategy: "apiKey",
    async getHeader(): Promise<AuthHeader> {
      const perServiceToken = readEnvVar(serviceEnvVarName(serviceName, "TOKEN"));
      const globalKey = readEnvVar("SDK_API_KEY");
      const key = perServiceToken ?? globalKey;
      if (!key) {
        throw new AuthenticationError(
          `No credentials configured for service "${serviceName}". Set the SDK_API_KEY environment variable ` +
            `(or ${serviceEnvVarName(serviceName, "TOKEN")} for a service-scoped override).`,
          { service: serviceName }
        );
      }
      return { name: "Authorization", value: `Bearer ${key}` };
    },
  };
}
