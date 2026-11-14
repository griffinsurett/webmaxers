const GDPR_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB",
]);

function header(request: Request, name: string): string | null {
  return request.headers.get(name)?.trim().toUpperCase() || null;
}

export function createGeoResponse(request: Request): Response {
  const country = header(request, "x-vercel-ip-country");
  const regionCode = header(request, "x-vercel-ip-country-region");

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return Response.json(
      { error: "Geolocation unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const isGDPR = GDPR_COUNTRIES.has(country);
  const isUSPrivacy = country === "US";
  const isCCPA = isUSPrivacy && regionCode === "CA";
  const regulations = isGDPR
    ? ["gdpr"]
    : isCCPA
      ? ["ccpa"]
      : isUSPrivacy
        ? ["us-privacy"]
        : [];

  return Response.json(
    {
      isEU: isGDPR && !["GB", "IS", "LI", "NO"].includes(country),
      isEEA: isGDPR && country !== "GB",
      isGDPR,
      isCCPA,
      isUSPrivacy,
      regulations,
      country,
      ...(regionCode ? { regionCode } : {}),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Type": "application/json; charset=utf-8",
        Vary: "X-Vercel-IP-Country, X-Vercel-IP-Country-Region",
      },
    },
  );
}
