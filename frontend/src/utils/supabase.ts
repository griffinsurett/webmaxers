// src/utils/supabase.ts

// Server-only: this module reads secret keys. Fail loudly if it is ever bundled into client code.
if (typeof window !== "undefined") {
  throw new Error("supabase.ts must never be imported in client code.");
}
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env?.SUPABASE_URL || process.env.SUPABASE_URL;
// Prefer the service role key for listing/downloading from buckets, fallback to anon key
const supabaseKey = import.meta.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase Client] Credentials missing (SUPABASE_URL and/or keys). Supabase knowledge source will be disabled."
  );
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        fetch: (url, options) => {
          const urlStr = typeof url === "string" ? url : (url as any).url || "";
          let targetUrl = url;

          if (urlStr.includes("/storage/v1/")) {
            try {
              const u = new URL(urlStr);
              u.searchParams.set("t", Date.now().toString());
              targetUrl = u.toString();
            } catch (e) {
              // Fallback if URL parsing fails
            }
          }

          const headers = new Headers(options?.headers);
          headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
          headers.set("Pragma", "no-cache");
          headers.set("Expires", "0");

          return fetch(targetUrl, {
            ...options,
            cache: "no-store",
            headers,
          } as RequestInit);
        },
      },
    })
  : null;
