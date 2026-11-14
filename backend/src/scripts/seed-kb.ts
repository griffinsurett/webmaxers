// backend/src/scripts/seed-kb.ts
// Applies the schema, then loads backend/kb/ into pgvector. Run: npm run kb:seed
import { config } from '../config/index.js';
import { migrate, pool } from '../db/index.js';
import { ragService } from '../services/rag/index.js';

try {
  await migrate();
  const result = await ragService.syncKnowledgeBase();
  console.log('Knowledge base synced:', result);
  if (!result.embedded) {
    console.warn(
      'OPENAI_API_KEY is not set: chunks stored without embeddings; search uses keyword fallback.',
      `Set it in backend/.env and re-run to enable vector search (${config.openaiEmbeddingModel}).`,
    );
  }
} finally {
  await pool.end();
}
