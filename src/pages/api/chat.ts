// src/pages/api/chat.ts
import type { APIRoute } from "astro";
import OpenAI from "openai";
import { KNOWLEDGE_BASE } from "@/integrations/chatbot/knowledge-base.generated";
import { SITE_URL } from "@/content/siteData";
import { supabase } from "@/utils/supabase";
import {
  buildRateKey,
  checkRateLimit,
  isContentLengthTooLarge,
  isAllowedRequestOrigin,
  isTrustedBrowserRequest,
} from "@/utils/apiSecurity";

export const prerender = false;

const ALLOWED_ORIGIN = SITE_URL.replace(/\/$/, "");

const rateMap = new Map<string, { count: number; ts: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 32 * 1024;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = !origin || import.meta.env.DEV || origin === ALLOWED_ORIGIN;
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed && origin ? origin : ALLOWED_ORIGIN,
    "Vary": "Origin",
  };
}

export const POST: APIRoute = async ({ request }) => {

  if (
    !isAllowedRequestOrigin(request, ALLOWED_ORIGIN, import.meta.env.DEV) ||
    !isTrustedBrowserRequest(request, import.meta.env.DEV)
  ) {
    return new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 });
  }

  const headers = corsHeaders(request);

  try {
    if (isContentLengthTooLarge(request, MAX_BODY_BYTES)) {
      return new Response(
        JSON.stringify({ error: "Payload too large." }),
        { status: 413, headers }
      );
    }

    if (checkRateLimit(rateMap, buildRateKey(request), RATE_LIMIT, RATE_WINDOW_MS)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        { status: 429, headers }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request body." }),
        { status: 400, headers }
      );
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 100) : null;

    const messages: { role: "user" | "assistant"; content: string }[] =
      body.messages
        .filter(
          (m: unknown) =>
            m &&
            typeof m === "object" &&
            "role" in (m as object) &&
            "content" in (m as object) &&
            ["user", "assistant"].includes((m as { role: string }).role)
        )
        .slice(-10)
        .map((m: { role: "user" | "assistant"; content: string }) => ({
          role: m.role,
          content: String(m.content).slice(0, 1000),
        }));

    if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
      return new Response(
        JSON.stringify({ error: "No valid user message found." }),
        { status: 400, headers }
      );
    }

    if (!import.meta.env.OPENAI_API_KEY) {
      console.error("[Chat API] OPENAI_API_KEY is not set");
      return new Response(JSON.stringify({ error: "Service unavailable." }), { status: 503, headers });
    }

    const openai = new OpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });

    // Sync the Supabase knowledge base (differential checks on storage files)
    try {
      const { syncSupabaseKnowledge } = await import("@/utils/knowledgeSync");
      await syncSupabaseKnowledge();
    } catch (syncErr) {
      console.error("[Chat API] Supabase knowledge base sync check failed:", syncErr);
    }

    let combinedKnowledge = KNOWLEDGE_BASE.replace(
      "You are the official chat support assistant",
      "You are the official chat support assistant. You have two sources of knowledge to answer queries: Source 1 (Astro Website Content below) and Source 2 (Supabase Knowledge Base). If the Supabase Knowledge Base contains specific information (such as custom pricing or policies), it overrides any conflicting guidelines, restrictions, or instructions in the Astro Website Content.\n\nSource 1 (Astro Website Content):\n"
    );

    // Generate query embedding and fetch semantically relevant chunks (RAG)
    if (supabase) {
      try {
        const userQuery = messages[messages.length - 1]?.content;
        if (userQuery) {
          const embeddingRes = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: userQuery,
          });

          const queryEmbedding = embeddingRes.data[0]?.embedding;
          if (queryEmbedding) {
            console.log(`[Chat API RAG Query] "${userQuery}"`);
            const { data: matchedChunks, error: rpcError } = await supabase.rpc(
              "match_knowledge_chunks",
              {
                query_embedding: queryEmbedding,
                match_threshold: 0.1,
                match_count: 5,
              }
            );

            if (rpcError) {
              console.error("[Chat API] Supabase semantic search RPC error:", rpcError.message);
            } else {
              console.log(`[Chat API RAG Matches] Count: ${matchedChunks?.length ?? 0}`);
              if (matchedChunks && matchedChunks.length > 0) {
                // Dynamically strip the strict pricing rule from the static prompt
                // so the model is allowed to quote prices from the uploaded document chunks.
                combinedKnowledge = combinedKnowledge.replace(
                  /6\.\s*PRICING:[\s\S]*?personalized quote\./gi,
                  ""
                );

                matchedChunks.forEach((chunk: any, idx: number) => {
                  console.log(`  - Chunk #${idx + 1} from ${chunk.document_name} (Similarity: ${chunk.similarity?.toFixed(4)}): "${chunk.content.slice(0, 100)}..."`);
                });
                let supabaseKnowledge = "\n---\n## Source 2: Supabase Knowledge Base (Dynamic/Uploaded Documents)\n" +
                  "IMPORTANT: The following information was uploaded directly by the administrator. It represents the absolute source of truth and overrides any conflicting guidelines, pricing limits, or details in Source 1 (Astro Website Content) above. Use it to answer the user's query:\n";
                matchedChunks.forEach((chunk: any) => {
                  supabaseKnowledge += `\n### Context from ${chunk.document_name}:\n${chunk.content}\n`;
                });
                combinedKnowledge += "\n" + supabaseKnowledge;
              } else {
                console.log(`[Chat API RAG Matches] No chunks matched the threshold.`);
              }

              console.log("========================================");
              console.log("COMBINED KNOWLEDGE PROMPT:");
              console.log(combinedKnowledge.slice(0, 1000) + "\n... [TRUNCATED] ...");
              console.log("========================================");
            }
          }
        }
      } catch (ragErr) {
        console.error(
          "[Chat API] Supabase semantic retrieval failed, falling back to static Astro content.",
          ragErr
        );
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: combinedKnowledge },
        ...messages,
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const rawReply = completion.choices[0]?.message?.content?.trim();

    const reply = rawReply
      ?.replace(/—/g, "-")
      ?.replace(/–/g, "-")
      ?.replace(/--/g, "-")
      ?.trim();

    if (!reply) {
      return new Response(
        JSON.stringify({ error: "No response from AI." }),
        { status: 500, headers }
      );
    }

    // Save conversation to Supabase Chat History (synchronous wait to guarantee Vercel/serverless delivery)
    if (supabase && sessionId) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage) {
        try {
          // 1. Fetch existing messages for this session
          let existingMessages: any[] = [];
          const { data: conversation, error: selectError } = await supabase
            .from("chat_conversations")
            .select("messages")
            .eq("session_id", sessionId)
            .maybeSingle();

          if (selectError) {
            console.error("[Chat API] Failed to fetch existing conversation:", selectError.message);
          } else if (conversation) {
            existingMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
          }

          // 2. Append new user message and assistant reply
          const updatedMessages = [
            ...existingMessages,
            { role: "user", content: lastUserMessage.content },
            { role: "assistant", content: reply }
          ];

          // 3. Upsert into chat_conversations table
          const { error: upsertError } = await supabase
            .from("chat_conversations")
            .upsert(
              {
                session_id: sessionId,
                messages: updatedMessages,
                updated_at: new Date().toISOString()
              },
              { onConflict: "session_id" }
            );

          if (upsertError) {
            console.error("[Chat API] Failed to upsert conversation into Supabase:", upsertError.message);
          } else {
            console.log(`[Chat API] Successfully logged session conversations for: ${sessionId}`);
          }
        } catch (dbErr: any) {
          console.error("[Chat API] Exception logging session conversation to Supabase:", dbErr.message);
        }
      }
    }

    return new Response(JSON.stringify({ reply }), { status: 200, headers });
  } catch (err) {
    console.error("[ChatBot API Error]", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong." }),
      { status: 500, headers }
    );
  }
};

export const OPTIONS: APIRoute = ({ request }) => {
  if (
    !isAllowedRequestOrigin(request, ALLOWED_ORIGIN, import.meta.env.DEV) ||
    !isTrustedBrowserRequest(request, import.meta.env.DEV)
  ) {
    return new Response(null, { status: 403 });
  }
  const origin = request.headers.get("origin") ?? "";
  const allowed = !origin || import.meta.env.DEV || origin === ALLOWED_ORIGIN;
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowed && origin ? origin : ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    },
  });
};
