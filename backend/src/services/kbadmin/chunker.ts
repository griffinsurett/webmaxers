// backend/src/services/kbadmin/chunker.ts
// Splits uploaded guidance text into chunks for search: by headings when the text has them,
// otherwise by paragraphs, packed to a readable size. Each chunk carries where it came from.
import type { Chunk } from '../rag/index.js';

const TARGET_CHARS = 900;
const MAX_CHARS = 1500;
export const MAX_CHUNKS = 80;

const titleOf = (filename: string) => filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded guidance';

/** Cuts one over-long block at sentence ends (or, failing that, at spaces). */
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHARS) {
    let cut = rest.lastIndexOf('. ', MAX_CHARS);
    if (cut < MAX_CHARS / 2) cut = rest.lastIndexOf(' ', MAX_CHARS);
    if (cut < MAX_CHARS / 2) cut = MAX_CHARS;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Packs paragraphs into pieces of about TARGET_CHARS. */
function pack(paragraphs: string[]): string[] {
  const out: string[] = [];
  let current = '';
  for (const para of paragraphs.flatMap(splitLong)) {
    if (current && current.length + para.length + 2 > TARGET_CHARS) { out.push(current); current = ''; }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) out.push(current);
  return out;
}

export function chunkGuidance(text: string, filename: string, uploadId: string): Chunk[] {
  const title = titleOf(filename);
  const source = `upload:${uploadId}`;
  const lines = text.split('\n');

  // Sections by markdown heading, or by a short ALL-CAPS / "Title:" line is too guessy: headings only.
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } = { heading: '', body: [] };
  for (const line of lines) {
    const m = /^#{1,3}\s+(.+)$/.exec(line);
    if (m) {
      if (current.body.join('').trim()) sections.push(current);
      current = { heading: m[1].trim().slice(0, 120), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.join('').trim()) sections.push(current);

  const chunks: Chunk[] = [];
  let part = 0;
  for (const section of sections) {
    const paragraphs = section.body.join('\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const content of pack(paragraphs)) {
      part++;
      chunks.push({
        source,
        heading: `${title} > ${section.heading || `Part ${part}`}`,
        content,
        metadata: { title, upload: uploadId },
      });
    }
  }
  return chunks.slice(0, MAX_CHUNKS);
}
