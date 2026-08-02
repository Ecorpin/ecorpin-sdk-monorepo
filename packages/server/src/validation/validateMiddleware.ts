import type { NextFunction, Request, Response } from "express";
import type { ResolvedAction } from "../register/action.js";

declare module "express-serve-static-core" {
  interface Request {
    ecorpinValidatedInput?: unknown;
  }
}

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * Validates `req.body` against the action's declared Zod input schema
 * *before* the handler runs (architecture doc §5.2 "Validation", §11.3).
 * On success, the parsed (and Zod-transformed/defaulted) value is stashed
 * on `req.ecorpinValidatedInput` so the handler receives exactly what it
 * declared, not the raw untyped body. Throws (via `next(err)`) a `ZodError`
 * on failure, which `mapThrownError()` turns into `ECORPIN_VALIDATION_ERROR`.
 */
export function createValidateMiddleware(action: ResolvedAction) {
  return function validateMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const schema = action.definition.input;
    if (!schema || !METHODS_WITH_BODY.has(action.method)) {
      req.ecorpinValidatedInput = req.body;
      next();
      return;
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }

    req.ecorpinValidatedInput = result.data;
    next();
  };
}
