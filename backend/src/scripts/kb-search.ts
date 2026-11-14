// backend/src/scripts/kb-search.ts
// Quick RAG check from the terminal. Run: npm run kb:search -- "how much is a service page"
import { pool } from '../db/index.js';
import { ragService } from '../services/rag/index.js';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: npm run kb:search -- "<question>"');
  process.exit(1);
}

try {
  const results = await ragService.searchKnowledgeBase(query, 5);
  if (results.length === 0) console.log('No matches.');
  for (const r of results) {
    console.log(`\n[${r.mode} ${r.similarity.toFixed(3)}] ${r.heading}  (${r.source})\n  ${r.content}`);
  }
} finally {
  await pool.end();
}
