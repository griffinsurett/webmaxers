/** Engine-owned relationships cannot be replaced by free-form overrides. */
const reserved = new Set([
  "@context", "@id", "@type", "@graph", "url", "mainEntity", "acceptedAnswer",
  "review", "reviewRating", "aggregateRating", "ratingCount", "reviewCount",
]);

export function assertOverrideKeys(overrides: Record<string, unknown> | undefined, label: string, locked: string[] = []) {
  for (const key of Object.keys(overrides ?? {})) {
    if (reserved.has(key) || locked.includes(key)) {
      throw new Error(`[schema] ${label}: "${key}" is derived from identity/rendered content and cannot be overridden.`);
    }
  }
}

const numeric = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

/** Check the final composed graph, including values supplied after transforms. */
export function validateSchemaNode(value: unknown, label = "output"): void {
  const fail = (path: string, message: string): never => {
    throw new Error(`[schema] ${label} ${path}: ${message}`);
  };
  function visit(current: unknown, path: string): void {
    if (typeof current === "number" && !Number.isFinite(current)) fail(path, "non-finite number");
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!current || typeof current !== "object") return;
    const node = current as Record<string, unknown>;
    for (const key of ["price", "lowPrice", "highPrice"]) {
      if (node[key] !== undefined) {
        const amount = numeric(node[key]);
        if (amount === undefined || amount < 0) fail(`${path}.${key}`, "expected an exact nonnegative numeric price");
        if (typeof node.priceCurrency !== "string" || !/^[A-Z]{3}$/.test(node.priceCurrency)) {
          fail(path, "a numeric price needs a three-letter priceCurrency");
        }
      }
    }
    if (node.lowPrice !== undefined && node.highPrice !== undefined && Number(node.lowPrice) > Number(node.highPrice)) {
      fail(path, "lowPrice exceeds highPrice");
    }
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    if (types.includes("Rating") || types.includes("AggregateRating")) {
      const rating = numeric(node.ratingValue);
      const low = numeric(node.worstRating ?? 1);
      const high = numeric(node.bestRating ?? 5);
      if (rating === undefined || low === undefined || high === undefined || low >= high || rating < low || rating > high) {
        fail(path, "ratingValue must fall within the declared rating scale");
      }
    }
    for (const key of ["ratingCount", "reviewCount"]) {
      if (node[key] !== undefined) {
        const count = numeric(node[key]);
        if (count === undefined || count < 0 || !Number.isInteger(count)) fail(`${path}.${key}`, "expected a nonnegative integer");
      }
    }
    if (node.offers !== undefined) {
      const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
      for (const offer of offers) {
        if (!offer || typeof offer !== "object") fail(`${path}.offers`, "expected Offer objects or references");
        const record = offer as Record<string, unknown>;
        const offerTypes = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
        if (!record["@id"] && !offerTypes.some((type) => type === "Offer" || type === "AggregateOffer")) {
          fail(`${path}.offers`, "expected an Offer/AggregateOffer type or an @id reference");
        }
      }
    }
    for (const [key, child] of Object.entries(node)) visit(child, `${path}.${key}`);
  }
  visit(value, "$");
}
