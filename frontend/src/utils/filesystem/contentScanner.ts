// src/utils/filesystem/contentScanner.ts
/**
 * Collection scanner for Node-only contexts (config/build scripts).
 * Provides meta + item frontmatter for each collection to avoid duplicated FS loops.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter';
import { getCollectionDirs } from './shared';

export interface ScannedItem {
  slug: string;
  data: Record<string, any>;
  filePath: string;
}

export interface ScannedCollection {
  name: string;
  meta: Record<string, any>;
  items: ScannedItem[];
}

export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'src', 'content');

export function scanCollections(contentDir: string = DEFAULT_CONTENT_DIR): ScannedCollection[] {
  const collections: ScannedCollection[] = [];
  const collectionDirs = getCollectionDirs(contentDir);

  for (const collectionName of collectionDirs) {
    const collectionDir = path.join(contentDir, collectionName);
    if (!fs.existsSync(collectionDir)) continue;

    const metaPath = path.join(collectionDir, '_meta.mdx');
    const meta = fs.existsSync(metaPath) ? parseFrontmatter(metaPath) : {};

    const files = fs.readdirSync(collectionDir);
    const contentFiles = files.filter(
      (file) =>
        (file.endsWith('.mdx') || file.endsWith('.md') || file.endsWith('.json')) &&
        !file.startsWith('_')
    );

    const items: ScannedItem[] = [];
    for (const file of contentFiles) {
      const filePath = path.join(collectionDir, file);
      if (file.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const json = JSON.parse(raw);
          const rawItems = Array.isArray(json) ? json : [json];
          rawItems.forEach((item: any, idx: number) => {
            const slug = item.id || `${file.replace(/\.json$/, '')}-${idx}`;
            const { id, ...data } = item;
            items.push({ slug, data, filePath });
          });
        } catch (e) {
          console.error(`[Content Scanner] Failed to parse JSON file ${filePath}:`, e);
        }
      } else {
        const data = parseFrontmatter(filePath);
        const slug = file.replace(/\.(mdx|md)$/, '');
        items.push({ slug, data, filePath });
      }
    }

    collections.push({ name: collectionName, meta, items });
  }

  return collections;
}
