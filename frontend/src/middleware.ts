import { defineMiddleware } from "astro:middleware";

// Payload limit for the live /api/chat route. (/api/estimate was removed.)
const LIMITS: Record<string, number> = {
  "/api/chat": 32 * 1024,
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (context.request.method === "POST" && pathname in LIMITS) {
    const raw = context.request.headers.get("content-length");
    const size = raw ? Number(raw) : NaN;
    if (Number.isFinite(size) && size > LIMITS[pathname]) {
      return new Response(
        JSON.stringify({ error: "Payload too large." }),
        {
          status: 413,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  return next();
});
