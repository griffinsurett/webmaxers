// backend/src/services/research/html.ts
// Parses fetched HTML as TEXT. cheerio builds a static tree: no scripts run, no resources load.
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export type Doc = cheerio.CheerioAPI;
type Selection = ReturnType<Doc>;

/** Elements that nest for real (no implicit closing), used to estimate nesting depth. */
const NESTING = new Set([
  'div', 'span', 'section', 'article', 'main', 'nav', 'header', 'footer', 'aside', 'ul', 'ol', 'table',
  'tbody', 'form', 'a', 'b', 'i', 'em', 'strong', 'font', 'center', 'blockquote', 'details', 'figure', 'label', 'button',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
export const MAX_NESTING_DEPTH = 256; // browsers stop at 512
export const MAX_TAGS = 150_000;

/**
 * Linear-time pre-scan, run BEFORE parsing: HTML parsers are quadratic on deep nesting, so a
 * hostile page (20,000 nested <div>s) could otherwise burn seconds of CPU or crash the stack.
 * Returns false for pages nested deeper than any browser allows or with an absurd tag count.
 */
export function isSafeMarkup(html: string, maxDepth = MAX_NESTING_DEPTH, maxTags = MAX_TAGS): boolean {
  const lower = html.toLowerCase();
  const n = html.length;
  let i = 0;
  let depth = 0;
  let tags = 0;
  const isNameChar = (c: number) => (c >= 97 && c <= 122) || (c >= 48 && c <= 57);

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (lower.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    const closing = html[lt + 1] === '/';
    const start = lt + (closing ? 2 : 1);
    let j = start;
    while (j < n && isNameChar(lower.charCodeAt(j))) j++;
    if (j === start || (!closing && lower.charCodeAt(start) < 97)) {
      i = lt + 1; // a stray "<", not a tag
      continue;
    }
    const gt = html.indexOf('>', j);
    if (gt < 0) break;
    if (++tags > maxTags) return false;
    const name = lower.slice(start, j);
    if (closing) {
      if (NESTING.has(name) && depth > 0) depth--;
    } else {
      if (NESTING.has(name) && html[gt - 1] !== '/' && ++depth > maxDepth) return false;
      if (RAW_TEXT.has(name)) {
        const end = lower.indexOf(`</${name}`, gt);
        if (end < 0) break;
        i = end;
        continue;
      }
    }
    i = gt + 1;
  }
  return true;
}

export function loadHtml(html: string): Doc {
  if (!isSafeMarkup(html)) throw new Error('markup_too_complex');
  return cheerio.load(html, { scriptingEnabled: false });
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'object', 'embed']);
/** Work caps: a hostile page must not be able to make text extraction expensive. */
export const MAX_TEXT_NODES = 150_000;
export const MAX_TEXT_CHARS = 300_000;

/**
 * Readable text of a selection, in ONE linear pass with an explicit stack (so neither wide nor
 * 20,000-deep documents can blow up time or the call stack). Scripts, styles, hidden content
 * and any `extraSkipTags` are ignored, and a space is emitted after every element so
 * neighbours never fuse into one word ("</h1><p>" must not become "DetectionPlumbing").
 */
export function textOf(selection: Selection, extraSkipTags: string[] = []): string {
  const skip = extraSkipTags.length ? new Set([...SKIP_TAGS, ...extraSkipTags]) : SKIP_TAGS;
  const out: string[] = [];
  const SPACE = Symbol('space');
  const stack: (AnyNode | typeof SPACE)[] = [...selection.toArray()].reverse();
  let visited = 0;
  let chars = 0;

  while (stack.length > 0 && visited < MAX_TEXT_NODES && chars < MAX_TEXT_CHARS) {
    const node = stack.pop()!;
    if (node === SPACE) {
      out.push(' ');
      continue;
    }
    visited++;
    if (node.type === 'text') {
      out.push(node.data);
      chars += node.data.length;
      continue;
    }
    if (node.type === 'comment' || node.type === 'directive' || node.type === 'cdata') continue;
    if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
      const el = node as AnyNode & { name: string; attribs?: Record<string, string> };
      if (skip.has(el.name)) continue;
      const a = el.attribs;
      if (a && (a.hidden !== undefined || a['aria-hidden'] === 'true')) continue;
      stack.push(SPACE);
    }
    const children = (node as AnyNode & { children?: AnyNode[] }).children;
    if (children) for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

/** Visible text of the whole document. */
export function visibleText($: Doc): string {
  return textOf($.root());
}
