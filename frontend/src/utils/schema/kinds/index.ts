// src/utils/schema/kinds/index.ts
/**
 * The registry: every schema kind a component or layout can declare.
 * To support a new schema.org type, add a kind file and list it here.
 */
import { course, product, service } from "./offerings";
import { faq, reviews } from "./sections";
import type { SchemaKind } from "../types";

export const kinds = { service, course, product, faq, reviews } satisfies Record<string, SchemaKind>;

export type KindName = keyof typeof kinds;
