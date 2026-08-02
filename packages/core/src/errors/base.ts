export interface EcorpinErrorContext {
  service?: string;
  resource?: string;
  action?: string;
  correlationId?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * Base class for every error the Ecorpin SDK Framework raises or
 * reconstructs. See architecture doc §16 for the full taxonomy and the
 * rationale for a stable, machine-readable `code` + `retryable` flag.
 */
export abstract class EcorpinError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  abstract readonly retryable: boolean;

  readonly service?: string;
  readonly resource?: string;
  readonly action?: string;
  readonly correlationId?: string;
  readonly details?: unknown;

  constructor(message: string, context: EcorpinErrorContext = {}) {
    super(message, context.cause !== undefined ? { cause: context.cause } : undefined);
    this.name = new.target.name;
    this.service = context.service;
    this.resource = context.resource;
    this.action = context.action;
    this.correlationId = context.correlationId;
    this.details = context.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): { code: string; message: string; details?: unknown; correlationId?: string } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      correlationId: this.correlationId,
    };
  }
}
