/**
 * Minimal structural type for a JSON Schema (Draft 2020-12) document.
 *
 * Kept intentionally loose (no dependency on a JSON Schema package) so
 * `@ecorpin/core` stays dependency-free. `@ecorpin/server` is responsible for
 * producing real JSON Schema documents (e.g. via zod-to-json-schema) that
 * satisfy this shape.
 */
export type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  description?: string;
  additionalProperties?: boolean | JSONSchema;
  [key: string]: unknown;
};
