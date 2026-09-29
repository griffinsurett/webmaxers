/** Accept an exact nonnegative price; ranges and marketing copy aren't prices. */
export function parsePrice(raw: unknown, currency = "USD"): string | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw.toFixed(2) : undefined;
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  const symbol = value.match(/^[$£€]/)?.[0];
  const expected = ({ USD: "$", CAD: "$", AUD: "$", NZD: "$", GBP: "£", EUR: "€" } as Record<string, string>)[currency];
  if (symbol && symbol !== expected) return undefined;
  if (!/^(?:[$£€]\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return undefined;
  const number = Number(value.replace(/[$£€,\s]/g, ''));
  return Number.isFinite(number) ? number.toFixed(2) : undefined;
}

export function ratingValue(raw: unknown): number | undefined {
  if (typeof raw !== 'number' && typeof raw !== 'string') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : undefined;
}
