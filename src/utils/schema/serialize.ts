import { validateSchemaNode } from "./validation.ts";

/** Serialize JSON-LD for an HTML script element without changing its data. */
export function serializeJsonLd(value: object): string {
  validateSchemaNode(value);
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
