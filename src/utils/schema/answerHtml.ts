import { parse, ELEMENT_NODE, TEXT_NODE, type Node } from 'ultrahtml';

const allowed = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'code', 'pre', 'blockquote']);
const excluded = new Set(['script', 'style', 'template', 'header', 'footer', 'nav', 'button', 'svg', 'noscript']);
const attribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** Preserve answer prose and links, excluding UI, scripts and hydration attributes. */
export function answerHtml(html: string): string {
  function visit(node: Node): string {
    if (node.type === TEXT_NODE) return node.value;
    if (node.type === ELEMENT_NODE && (excluded.has(node.name) || 'hidden' in node.attributes || node.attributes['aria-hidden'] === 'true')) return '';
    const children = 'children' in node ? node.children.map(visit).join('') : '';
    if (node.type !== ELEMENT_NODE || !allowed.has(node.name)) return children;
    let attrs = '';
    if (node.name === 'a') {
      const href = node.attributes.href ?? '';
      if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) attrs = ` href="${attribute(href)}"`;
    }
    return node.name === 'br' ? '<br>' : `<${node.name}${attrs}>${children}</${node.name}>`;
  }
  return visit(parse(html)).trim();
}
