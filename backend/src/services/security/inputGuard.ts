// backend/src/services/security/inputGuard.ts
// Screens every visitor message BEFORE it reaches the LLM or storage.
//
// - Normalizes text (control/zero-width/bidi characters removed, NFKC, whitespace collapsed).
// - Rejects markup, scripts, code fences, shell/SQL fragments, non-web URL schemes, big
//   encoded blobs and classic prompt-injection phrasing. Rejected messages never reach the model.
// - Pulls website addresses out of the text so CODE (not the model) validates them. The
//   model only ever sees placeholders like [URL1].
import { validateUrlSyntax, type UrlRejection } from './urlGuard.js';

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_URLS_PER_MESSAGE = 4;

export type MessageRejection = 'empty' | 'too_long' | 'markup' | 'unsafe_scheme' | 'injection' | 'encoded_blob';

export type MessageScreen =
  | { ok: true; text: string }
  | { ok: false; reason: MessageRejection };

// Anything invisible that can hide text from a human but not from a model: control characters
// (\p{Cc}), every format character (\p{Cf}: zero-width, bidi marks and overrides, soft hyphen,
// Unicode "tag" characters that smuggle invisible ASCII), plus combining-grapheme-joiner and
// variation selectors. Whitespace controls are turned into spaces first.
const INVISIBLE = /[\p{Cc}\p{Cf}\u034F\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;

const MARKUP = [
  /<\s*\/?\s*[a-z][a-z0-9-]*[^>]*>/i, // any HTML-looking tag
  /<!--|-->|<!\[CDATA\[/i,
  /```/,
  /\bon(error|load|click|mouseover|focus|submit)\s*=/i,
  /&#x?[0-9a-f]+;/i, // numeric entities used to smuggle tags
  /\$\([^)]*\)|`[^`]+`/, // shell substitution
  /(?:^|[;&|])\s*(?:rm|curl|wget|bash|sh|powershell|nc|chmod|sudo)\s+-?\S+/i,
  /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|or\s+1\s*=\s*1)\b/i,
  /\{\{.*\}\}|\{%.*%\}|<%.*%>/, // template injection
];

const UNSAFE_SCHEME = /\b(?:javascript|vbscript|data|file|ftp|gopher|ldap|dict|blob|chrome|about):/i;

const INJECTION = [
  /\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}\b(?:previous|prior|above|earlier|all|any|your|the)\b.{0,30}\b(?:instruction|prompt|rule|guideline|direction|constraint)s?\b/i,
  /\b(?:reveal|show|print|repeat|display|output|leak|tell me)\b.{0,40}\b(?:system|hidden|initial|original|developer)\b.{0,15}\b(?:prompt|instruction|message|rule)s?\b/i,
  /\bwhat (?:is|are|were) your (?:system |initial |original )?(?:prompt|instructions|rules)\b/i,
  /\byou are (?:now|no longer)\b/i,
  /\b(?:pretend|act|behave|roleplay)\b.{0,20}\b(?:as|like|to be)\b.{0,30}\b(?:ai|assistant|dan|admin|developer|system|root|unrestricted|jailbroken)\b/i,
  /\b(?:jailbreak|dan mode|developer mode|god mode|do anything now)\b/i,
  /<\|?(?:system|im_start|im_end|endoftext)\|?>/i,
  /\b(?:system|assistant)\s*:\s/i, // fake role headers
  /\bnew (?:instructions?|rules?|system prompt)\b/i,
];

const LONG_BLOB = /[A-Za-z0-9+/=_-]{120,}/;

/** Cleans invisible characters and whitespace without judging content. */
export function normalizeText(input: string): string {
  const spaced = input.replace(/[\t\n\r\f\v]/g, ' ');
  return spaced.replace(INVISIBLE, '').normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

const COMMON_TLDS =
  'com|net|org|io|co|us|info|biz|xyz|top|site|online|app|dev|shop|club|click|link|live|store|ru|cn|tk|ml|ga|cf|gq|cc|ws|pw|me|tv|ly|icu|vip|buzz|rest|cyou';
const DOMAIN_LIKE = new RegExp(`\\b[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,4}\\.(?:${COMMON_TLDS})\\b`, 'gi');

/**
 * True if the text contains something that looks like a web address ("scam-site.xyz/claim"),
 * other than the allowed hosts (the sites being analyzed). Model-written findings and
 * candidate names are shown to the visitor, so hostile domains must not ride along in them.
 */
export function containsDomainLike(text: string, allowHosts: string[] = []): boolean {
  const allowed = allowHosts.map((h) => h.toLowerCase().replace(/^www\./, ''));
  for (const m of text.matchAll(DOMAIN_LIKE)) {
    const host = m[0].toLowerCase().replace(/^www\./, '');
    if (!allowed.some((a) => host === a || host.endsWith(`.${a}`))) return true;
  }
  return false;
}

/** True if a short model-produced or stored string contains markup, injection or code. */
export function looksUnsafe(text: string): boolean {
  return (
    MARKUP.some((r) => r.test(text)) ||
    INJECTION.some((r) => r.test(text)) ||
    UNSAFE_SCHEME.test(text) ||
    LONG_BLOB.test(text)
  );
}

export function screenMessage(raw: unknown): MessageScreen {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  if (raw.length > MAX_MESSAGE_CHARS * 4) return { ok: false, reason: 'too_long' };
  const text = normalizeText(raw);
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > MAX_MESSAGE_CHARS) return { ok: false, reason: 'too_long' };
  if (MARKUP.some((r) => r.test(text))) return { ok: false, reason: 'markup' };
  if (UNSAFE_SCHEME.test(text)) return { ok: false, reason: 'unsafe_scheme' };
  if (LONG_BLOB.test(text)) return { ok: false, reason: 'encoded_blob' };
  if (INJECTION.some((r) => r.test(text))) return { ok: false, reason: 'injection' };
  return { ok: true, text };
}

export interface ExtractedUrls {
  /** Message with every address replaced by [URL1], [URL2]... and emails by [EMAIL]. */
  redactedText: string;
  /** Candidates that passed syntax checks, keyed by their placeholder ref. */
  candidates: { ref: string; url: string; host: string }[];
  rejected: { reason: UrlRejection }[];
}

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi;
const URL_CANDIDATE =
  /\bhttps?:\/\/[^\s]+|\b(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?::\d+)?(?:\/[^\s]*)?/gi;

export function extractUrls(text: string): ExtractedUrls {
  const withoutEmail = text.replace(EMAIL, '[EMAIL]');
  const candidates: ExtractedUrls['candidates'] = [];
  const rejected: ExtractedUrls['rejected'] = [];
  const seen = new Map<string, string>();
  let count = 0;

  const redactedText = withoutEmail.replace(URL_CANDIDATE, (match) => {
    // Sentence punctuation is not part of the address.
    const cleaned = match.replace(/[.,;:!?)\]]+$/, '');
    const trailing = match.slice(cleaned.length);
    if (++count > MAX_URLS_PER_MESSAGE) return `[INVALID_URL]${trailing}`;

    const check = validateUrlSyntax(cleaned);
    if (!check.ok) {
      rejected.push({ reason: check.reason });
      return `[INVALID_URL]${trailing}`;
    }
    let ref = seen.get(check.url);
    if (!ref) {
      ref = `URL${candidates.length + 1}`;
      seen.set(check.url, ref);
      candidates.push({ ref, url: check.url, host: check.host });
    }
    return `[${ref}]${trailing}`;
  });

  return { redactedText, candidates, rejected };
}

/** Visitor-facing wording for a rejected message. Short, neutral, steers back to the goal. */
export function screenMessageReply(reason: MessageRejection): string {
  switch (reason) {
    case 'empty':
      return 'I didn\'t catch that. Tell me a bit about your business and what you want your website to do.';
    case 'too_long':
      return 'That message is a bit long for me. Could you shorten it to a couple of sentences?';
    case 'injection':
      return 'I can only help with your website plan. What would you like to tell me or change?';
    default:
      return 'I can only work with plain text about your business and website. Could you rephrase that without links to files, code or special formatting?';
  }
}
