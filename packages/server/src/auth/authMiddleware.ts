import type { NextFunction, Request, Response } from "express";
import { AuthenticationError, AuthorizationError } from "@ecorpin/core";
import type { ResolvedAuth } from "../register/types.js";
import type { ResolvedAction } from "../register/action.js";
import type { ServerAuthConfig } from "../register/serviceRegistry.js";

declare module "express-serve-static-core" {
  interface Request {
    ecorpinAuth?: ResolvedAuth;
  }
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

function hasScope(scopes: string[] | true, required: string): boolean {
  if (scopes === true) return true;
  return scopes.some((scope) => scope === required || scope === "*" || scope.endsWith(":*"));
}

/**
 * Deny-by-default API-key middleware (architecture doc §13.6): every action
 * requires authentication unless the action explicitly declares
 * `auth: { required: false }`. On success, attaches `req.ecorpinAuth` so
 * handlers (and the metrics/logging layers) can see who called them.
 */
export function createAuthMiddleware(authConfig: ServerAuthConfig, action: ResolvedAction) {
  return function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const authRequired = action.definition.auth?.required ?? true;
    if (!authRequired) {
      next();
      return;
    }

    const header = req.header("authorization");
    const match = header ? BEARER_PATTERN.exec(header) : null;
    if (!match) {
      next(new AuthenticationError("Missing or malformed Authorization header. Expected: Bearer <SDK_API_KEY>."));
      return;
    }

    const key = match[1] ?? "";
    const scopes = authConfig.apiKeys[key];
    if (scopes === undefined) {
      next(new AuthenticationError("Invalid API key."));
      return;
    }

    const requiredScopes = action.definition.auth?.scopes ?? [];
    for (const requiredScope of requiredScopes) {
      if (!hasScope(scopes, requiredScope)) {
        next(
          new AuthorizationError(`API key lacks required scope "${requiredScope}".`, {
            details: { requiredScope },
          })
        );
        return;
      }
    }

    req.ecorpinAuth = { key, scopes };
    next();
  };
}
