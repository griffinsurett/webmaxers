// backend/src/services/blueprint/retrieval.ts (5b)
// Pulls the knowledge-base guidance relevant to this business (page and add-on guidance,
// pricing rules). The KB is our own curated text, but retrieval still degrades gracefully:
// if search fails the blueprint is generated without it.
import type { KbSearchResult } from '../rag/index.js';

export interface KnowledgeChunk { heading: string; content: string }
export type KbSearch = (query: string, count: number) => Promise<KbSearchResult[]>;

const ALWAYS = ['Recommendation principles for pages and features', 'How to choose the five core pages'];
export const MAX_CHUNKS = 10;
const MAX_CHUNK_CHARS = 700;

export async function gatherKnowledge(
  business: { industry?: string; primaryGoal?: string; services: string[] },
  search: KbSearch,
): Promise<KnowledgeChunk[]> {
  const industry = business.industry || 'local business';
  const queries = [
    ...ALWAYS,
    `which pages does a ${industry} website need`,
    'when does a service deserve its own page and when are location pages justified',
    `which add-ons help a business whose main goal is ${business.primaryGoal ?? 'leads'}`,
    'pricing rules website type included pages upgrade',
    'content strategy articles and resource hub',
  ];
  const seen = new Set<string>();
  const out: KnowledgeChunk[] = [];
  const results = await Promise.all(queries.map((q) => search(q, 3).catch((): KbSearchResult[] => [])));
  for (const batch of results) {
    for (const r of batch) {
      if (seen.has(r.heading) || out.length >= MAX_CHUNKS) continue;
      seen.add(r.heading);
      out.push({ heading: r.heading, content: r.content.slice(0, MAX_CHUNK_CHARS) });
    }
  }
  return out;
}
