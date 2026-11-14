// src/utils/knowledgeSync.ts

// Server-only: this module reads secret keys. Fail loudly if it is ever bundled into client code.
if (typeof window !== "undefined") {
  throw new Error("knowledgeSync.ts must never be imported in client code.");
}
import { supabase } from "./supabase";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import OpenAI from "openai";

let openai: OpenAI | null = null;
const apiKey = import.meta.env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
if (apiKey) {
  openai = new OpenAI({ apiKey });
}

// Chunks text into logical pieces (~1000 chars) with sliding overlap (~200 chars)
function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    // Advance index by size minus overlap
    i += (chunkSize - overlap);
  }
  
  return chunks;
}

// Bulk generate OpenAI embeddings for text chunks using text-embedding-3-small
async function generateEmbeddingsForChunks(chunks: string[]): Promise<number[][]> {
  if (!openai) {
    throw new Error("OpenAI client is not configured (missing OPENAI_API_KEY)");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  return response.data.map((item) => item.embedding);
}

export async function syncSupabaseKnowledge(): Promise<void> {
  if (!supabase) {
    return;
  }

  const BUCKET_NAME = "knowledge-base";
  const DOCS_TABLE = "knowledge_documents";
  const CHUNKS_TABLE = "knowledge_chunks";

  try {
    // 1. List files in the Supabase Storage bucket
    const { data: storageFiles, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list();

    if (listError) {
      console.error("[Knowledge Sync] Error listing storage files:", listError.message);
      return;
    }

    const files = storageFiles || [];

    // 2. Fetch already processed document metadata from database
    const { data: dbDocs, error: dbError } = await supabase
      .from(DOCS_TABLE)
      .select("filename, updated_at, content_type");

    if (dbError) {
      console.error("[Knowledge Sync] Error fetching DB tracking records:", dbError.message);
    }

    const cachedDocsMap = new Map<string, { updated_at: string; content_type: string }>();
    if (dbDocs) {
      dbDocs.forEach((doc) => {
        cachedDocsMap.set(doc.filename, {
          updated_at: doc.updated_at,
          content_type: doc.content_type || "",
        });
      });
    }

    // 3. Identify files to delete (removed from storage but exist in cache)
    const storageFileNames = new Set(files.map((f) => f.name));
    const filesToDelete = Array.from(cachedDocsMap.keys()).filter(
      (name) => !storageFileNames.has(name)
    );

    if (filesToDelete.length > 0) {
      console.log(`[Knowledge Sync] Deleting ${filesToDelete.length} files from knowledge cache...`);
      
      // Delete chunks
      const { error: chunkDelError } = await supabase
        .from(CHUNKS_TABLE)
        .delete()
        .in("filename", filesToDelete);

      if (chunkDelError) {
        console.error("[Knowledge Sync] Error deleting orphaned chunks:", chunkDelError.message);
      }

      // Delete document tracker
      const { error: docDelError } = await supabase
        .from(DOCS_TABLE)
        .delete()
        .in("filename", filesToDelete);

      if (docDelError) {
        console.error("[Knowledge Sync] Error deleting orphaned tracker:", docDelError.message);
      }
    }

    // 4. Identify new or modified files to parse and embed
    const filesToProcess = files.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "txt" && ext !== "pdf") return false;

      const cached = cachedDocsMap.get(file.name);
      if (!cached) return true; // New file

      const storageUpdated = file.updated_at || file.created_at || (file.metadata?.lastModified) || new Date().toISOString();
      const timeChanged = new Date(storageUpdated).getTime() > new Date(cached.updated_at).getTime();

      // Check size or eTag change using composite metadata stored in content_type
      const currentSize = file.metadata?.size || 0;
      const currentETag = file.metadata?.eTag || "";
      const expectedMeta = `${ext}:${currentSize}:${currentETag}`;

      const metaChanged = cached.content_type !== expectedMeta;

      return timeChanged || metaChanged;
    });

    if (filesToProcess.length > 0) {
      console.log(`[Knowledge Sync] Found ${filesToProcess.length} new/modified files. Processing RAG pipeline...`);

      for (const file of filesToProcess) {
        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          
          // Download file content as a blob
          const { data: blob, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(file.name);

          if (downloadError || !blob) {
            console.error(`[Knowledge Sync] Failed to download ${file.name}:`, downloadError?.message);
            continue;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          let text = "";

          if (ext === "txt") {
            text = buffer.toString("utf-8");
          } else if (ext === "pdf") {
            const parsedPdf = await pdf(buffer);
            text = parsedPdf.text || "";
          }

          // Clean up whitespaces
          text = text.replace(/\s+/g, " ").trim();

          if (!text) {
            console.warn(`[Knowledge Sync] Extracted text from ${file.name} is empty. Skipping.`);
            continue;
          }

          // Split into semantic chunks
          const chunks = chunkText(text);
          console.log(`[Knowledge Sync] Chunked ${file.name} into ${chunks.length} segments.`);

          // Generate embeddings in a single batch OpenAI call
          const embeddings = await generateEmbeddingsForChunks(chunks);

          // Clear any existing chunks for this document
          await supabase.from(CHUNKS_TABLE).delete().eq("filename", file.name);

          // Bulk insert new chunks and vectors
          const insertRows = chunks.map((chunk, idx) => ({
            filename: file.name,
            chunk_index: idx,
            content: chunk,
            embedding: embeddings[idx],
          }));

          const { error: insertChunksError } = await supabase
            .from(CHUNKS_TABLE)
            .insert(insertRows);

          if (insertChunksError) {
            throw new Error(`Failed to insert chunks: ${insertChunksError.message}`);
          }

          const storageUpdated = file.updated_at || file.created_at || (file.metadata?.lastModified) || new Date().toISOString();
          const currentSize = file.metadata?.size || 0;
          const currentETag = file.metadata?.eTag || "";
          const metaValue = `${ext}:${currentSize}:${currentETag}`;

          // Update parent document tracking record
          const { error: upsertDocError } = await supabase.from(DOCS_TABLE).upsert(
            {
              filename: file.name,
              content: text,
              content_type: metaValue,
              updated_at: storageUpdated,
            },
            { onConflict: "filename" }
          );

          if (upsertDocError) {
            console.error(`[Knowledge Sync] Database tracker upsert error for ${file.name}:`, upsertDocError.message);
          } else {
            console.log(`[Knowledge Sync] Successfully indexed and cached RAG vectors for: ${file.name}`);
          }
        } catch (fileErr: any) {
          console.error(`[Knowledge Sync] Error processing file ${file.name}:`, fileErr.message);
          // Note: we intentionally skip writing to cache table so it will retry next request
        }
      }
    }
  } catch (err: any) {
    console.error("[Knowledge Sync] Exception during sync operation:", err.message);
  }
}
