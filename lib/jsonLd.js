export function jsonLd(schema) {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
