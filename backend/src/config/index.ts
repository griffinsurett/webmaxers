// backend/src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4321,https://webmaxxers.com')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // OpenAI (only LLM provider): chat, analysis, embeddings, web search
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini',
  // Deeper reasoning over extracted site facts (competitor analysis, blueprint).
  openaiAnalysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4.1',
  // Blueprint generation: structure pass (deeper) and page-content pass (cheaper, parallel).
  openaiBlueprintModel: process.env.OPENAI_BLUEPRINT_MODEL || 'gpt-4.1',
  openaiContentModel: process.env.OPENAI_CONTENT_MODEL || 'gpt-4.1-mini',
  // Must support the Responses API web_search tool.
  openaiSearchModel: process.env.OPENAI_SEARCH_MODEL || 'gpt-4.1-mini',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',

  // Postgres + pgvector knowledge base (local Docker in development)
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://blueprint:blueprint@localhost:54329/blueprint',
  // TLS to the database: disable (default, local Docker) | require (verify the certificate) | no-verify (encrypt, but accept the provider's own CA, as Supabase needs).
  databaseSsl: (process.env.DATABASE_SSL || 'disable').toLowerCase(),

  // Protects admin routes (/api/kb/*). Admin routes are disabled when unset.
  adminToken: process.env.ADMIN_TOKEN || '',

  // Express `trust proxy` (hop count, or 0/off). Needed behind Vercel/nginx so req.ip is the visitor, not the proxy.
  trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10),

  // Rate Limiting
  maxMessagesPerSession: parseInt(process.env.MAX_MESSAGES_PER_SESSION || '40', 10),
  maxSessionsPerIp: parseInt(process.env.MAX_SESSIONS_PER_IP || '5', 10),
  // Supabase Storage: where the admin drops pricing and guidance files (see DEPLOY.md). Both are needed; the service key is private.
  supabaseUrl: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  supabaseServiceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  kbBucket: process.env.KB_BUCKET || 'knowledge',
  kbPollSeconds: Math.max(10, parseInt(process.env.KB_POLL_SECONDS || '60', 10) || 60),
  // Per-second/minute burst throttling (stored in Postgres). Only "false" turns it off.
  // debug | info | warn | error | silent
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
  rateLimitEnabled: (process.env.RATE_LIMIT_ENABLED ?? 'true').toLowerCase() !== 'false',
};
