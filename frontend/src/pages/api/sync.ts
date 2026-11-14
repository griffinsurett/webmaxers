// src/pages/api/sync.ts
import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { syncSupabaseKnowledge } from "@/utils/knowledgeSync";

export const prerender = false;

function safeEqual(a: string, b: string): boolean {
  const ea = Buffer.from(a);
  const eb = Buffer.from(b);
  return ea.length === eb.length && timingSafeEqual(ea, eb);
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized." }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const GET: APIRoute = async ({ request }) => {
  // Fail closed: if CRON_SECRET isn't configured, nobody gets in.
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
  const expectedSecret = import.meta.env.CRON_SECRET || process.env.CRON_SECRET;
  if (!expectedSecret) return unauthorized();

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, expectedSecret)) return unauthorized();

  try {
    console.log("[Sync API] Triggering automated background sync...");
    await syncSupabaseKnowledge();
    return new Response(
      JSON.stringify({ success: true, message: "Knowledge base sync completed successfully." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[Sync API] Exception during background sync:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: "Sync failed." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
