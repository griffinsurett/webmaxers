import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';

type RecordData = Record<string, unknown>;
const object = (value: unknown): value is RecordData =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Objects merge recursively; explicitly supplied arrays and scalar values replace. */
export function mergeRecord(base: RecordData, override: RecordData): RecordData {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Unsafe content key: ${key}`);
    result[key] = object(value) && object(result[key]) ? mergeRecord(result[key], value) : value;
  }
  return result;
}

export function mergeSources(sources: unknown[]): Map<string, RecordData> {
  const merged = new Map<string, RecordData>();
  for (const source of sources) {
    if (!Array.isArray(source) && !object(source)) throw new Error('JSON content must be an array or keyed object');
    const entries = Array.isArray(source)
      ? source.map((data) => [data?.id ?? data?.slug, data] as const)
      : Object.entries(source).filter(([key, value]) => !(key === '$schema' && typeof value === 'string'));
    const seen = new Set<string>();
    for (const [rawId, data] of entries) {
      const id = rawId == null ? '' : String(rawId);
      if (!id.trim() || !object(data)) throw new Error('Each content entry needs an id and an object');
      if (seen.has(id)) throw new Error(`Duplicate content id in one source: ${id}`);
      seen.add(id);
      merged.set(id, mergeRecord(merged.get(id) ?? {}, data));
    }
  }
  return merged;
}

/** Paths are relative to Astro's project root, ordered shared source → local overrides. */
export function layeredFile(sources: string[]): Loader {
  if (!sources.length) throw new Error('At least one JSON source is required');
  return {
    name: 'greastro-layered-file',
    async load(context) {
      const root = fileURLToPath(context.config.root);
      const paths = sources.map((path) => resolve(root, path));
      const missing = new Set<string>();
      const sync = async () => {
        const raw = await Promise.all(paths.map(async (path) => {
          if (missing.has(path)) return [];
          return JSON.parse(await readFile(path, 'utf8'));
        }));
        const records = mergeSources(raw);
        const sourceIds = raw.map((source) => new Set(mergeSources([source]).keys()));
        // Validate all merged records before replacing the current collection.
        const parsed = await Promise.all([...records].map(async ([id, data]) => {
          const index = sourceIds.findLastIndex((ids) => ids.has(id));
          const filePath = paths[index];
          return { id, data: await context.parseData({ id, data, filePath }),
            filePath: relative(root, filePath).split('\\').join('/') };
        }));
        context.store.clear();
        for (const entry of parsed) context.store.set(entry);
      };
      await sync();
      context.watcher?.add(paths);
      let pending = Promise.resolve();
      for (const event of ['add', 'change', 'unlink'] as const) {
        context.watcher?.on(event, (path) => {
          const normalized = resolve(path);
          if (!paths.includes(normalized)) return;
          if (event === 'unlink') missing.add(normalized); else missing.delete(normalized);
          pending = pending.then(sync).catch((error) => context.logger.error(String(error)));
          return pending;
        });
      }
    },
  };
}
