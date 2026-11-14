// src/components/AskAi/renderMarkdown.tsx
/**
 * A deliberately tiny Markdown renderer for chat replies.
 *
 * ── Why not a library ──────────────────────────────────────────────────────
 * The bot is told to produce exactly four things: paragraphs, bullet lists,
 * **bold**, and [links](url). A full Markdown pipeline (plus the sanitiser it
 * would need) is a lot of bytes on a page whose critical path was deliberately
 * kept clean, to support a grammar this small.
 *
 * ── Why it is safe ─────────────────────────────────────────────────────────
 * It never produces an HTML string and never touches `dangerouslySetInnerHTML`.
 * It returns React elements, so any characters the model emits — `<script>`
 * included — are escaped by React as text. The only tags that can ever appear
 * are the ones written literally below.
 *
 * Link hrefs are still checked against an allowlist of schemes, because React
 * escapes text but will happily render `href="javascript:..."`. Anything that
 * is not http/https/mailto/tel renders as plain text rather than a link.
 */
import type { ReactNode } from "react";

/** Schemes we will turn into a real anchor. Everything else stays text. */
const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i;

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  // Relative links are fine — they cannot carry a scheme.
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  return SAFE_SCHEME.test(trimmed);
}

/**
 * Inline pass: **bold**, [text](href), and bare URLs.
 *
 * One regex with alternation rather than sequential passes, so a URL inside a
 * link's text cannot be re-processed and nested into a second anchor.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // The href group tolerates ONE level of nested parens — `(?:[^()]|\([^()]*\))*`
  // — so a URL containing brackets is captured whole. Without that,
  // `[here](javascript:alert(document.cookie))` matched only up to the inner
  // `)`, the link was correctly downgraded to text, and the leftover `)` was
  // printed alongside it.
  const pattern =
    /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>()]+)/g;

  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));

    const [, linkText, linkHref, boldText, bareUrl] = m;

    if (linkText && linkHref) {
      out.push(
        isSafeHref(linkHref) ? (
          <a
            key={`${keyPrefix}-a${i}`}
            href={linkHref}
            className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
            {...externalProps(linkHref)}
          >
            {linkText}
          </a>
        ) : (
          linkText
        ),
      );
    } else if (boldText) {
      out.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
          {boldText}
        </strong>,
      );
    } else if (bareUrl) {
      // The prompt asks for Markdown links, but a bare URL should still be
      // clickable rather than dead text if one slips through.
      out.push(
        <a
          key={`${keyPrefix}-u${i}`}
          href={bareUrl}
          className="underline decoration-current/40 underline-offset-2 hover:decoration-current break-all"
          {...externalProps(bareUrl)}
        >
          {bareUrl.replace(/^https?:\/\//, "")}
        </a>,
      );
    }

    last = m.index + m[0].length;
    i++;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Open off-site links in a new tab, with the usual opener protection. */
function externalProps(href: string) {
  const external = /^https?:/i.test(href);
  return external
    ? { target: "_blank", rel: "noopener noreferrer" as const }
    : {};
}

/**
 * Block pass: splits into paragraphs and bullet lists.
 *
 * Consecutive `- ` / `* ` lines collapse into one <ul>; everything else is a
 * paragraph. Blank lines separate blocks.
 */
export function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) {
      blocks.push(<p key={`p${key++}`}>{renderInline(text, `p${key}`)}</p>);
    }
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul${key++}`} className="list-disc space-y-1 pl-5">
        {items.map((item, idx) => (
          <li key={idx}>{renderInline(item, `li${key}-${idx}`)}</li>
        ))}
      </ul>,
    );
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);

    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]!);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      continue;
    }

    flushBullets();
    // Strip any heading marks rather than honouring them: the prompt forbids
    // headings, and a stray "###" should not render as literal hashes.
    paragraph.push(line.replace(/^#{1,6}\s+/, ""));
  }

  flushParagraph();
  flushBullets();

  return <div className="space-y-2">{blocks}</div>;
}
