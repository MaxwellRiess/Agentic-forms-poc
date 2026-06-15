/**
 * A deliberately small JSON Schema type. We target draft-07 features that are
 * also valid in OpenAPI 3.1 (which adopts JSON Schema), so the very same
 * fragments serve REST request bodies, the `/schema` endpoint and MCP
 * `inputSchema`.
 */
export interface JSONSchema {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  // string
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
  // number
  minimum?: number;
  // object
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  // array
  items?: JSONSchema;
  uniqueItems?: boolean;
  minItems?: number;
  // conditional / combinators (used for branch-aware routing)
  const?: string;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  // meta
  $schema?: string;
  title?: string;
}
