type RateEntry = { count: number; ts: number };

const IP_V4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_RE = /^[a-f0-9:]+$/i;

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

function extractIpFromHeader(value: string | null): string | null {
  if (!value) return null;
  const ip = value.split(",")[0]?.trim();
  if (!ip) return null;
  if (IP_V4_RE.test(ip) || IP_V6_RE.test(ip)) return ip;
  return null;
}

export function getClientIp(request: Request): string {
  // Prefer platform-provided client IP headers where available.
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for"),
  ];
  for (const candidate of candidates) {
    const ip = extractIpFromHeader(candidate);
    if (ip) return ip;
  }
  return "unknown";
}

export function isAllowedRequestOrigin(
  request: Request,
  allowedOrigin: string,
  isDev: boolean
): boolean {
  if (isDev) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return normalizeOrigin(origin) === normalizeOrigin(allowedOrigin);
}

export function isTrustedBrowserRequest(request: Request, isDev: boolean): boolean {
  if (isDev) return true;
  const site = (request.headers.get("sec-fetch-site") ?? "").toLowerCase();
  const mode = (request.headers.get("sec-fetch-mode") ?? "").toLowerCase();
  // Blocks basic cross-site and most scripted abuse lacking browser metadata.
  if (!site || !mode) return false;
  return (site === "same-origin" || site === "same-site") && mode === "cors";
}

export function checkRateLimit(
  rateMap: Map<string, RateEntry>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();

  // Opportunistic cleanup to keep memory bounded over time.
  if (rateMap.size > 5000) {
    for (const [k, v] of rateMap.entries()) {
      if (now - v.ts > windowMs) rateMap.delete(k);
    }
  }

  const entry = rateMap.get(key);
  if (!entry || now - entry.ts > windowMs) {
    rateMap.set(key, { count: 1, ts: now });
    return false;
  }

  if (entry.count >= limit) return true;
  entry.count++;
  return false;
}

export function buildRateKey(request: Request): string {
  const ip = getClientIp(request);
  // IP only: keying on User-Agent lets a client dodge the limit by rotating it.
  return ip;
}

export function isContentLengthTooLarge(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const size = Number(raw);
  if (!Number.isFinite(size) || size < 0) return false;
  return size > maxBytes;
}

/** Session ids are client-generated; accept only UUID-like tokens so nobody can target arbitrary rows. */
export function parseSessionId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : null;
}

/** Read a JSON body while enforcing a real byte cap (Content-Length can be absent or lie, e.g. chunked). */
export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown | null | "too_large"> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}
