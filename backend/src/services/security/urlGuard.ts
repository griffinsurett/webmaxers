// backend/src/services/security/urlGuard.ts
// Decides whether a visitor-supplied website address is safe for us to research.
//
// Threats covered: SSRF (localhost, private ranges, cloud metadata), credential-in-URL
// tricks, non-web schemes, IDN look-alike hosts, URL shorteners/file hosts, and DNS names
// that resolve to internal addresses. This check runs at intake AND must run again, with
// redirect re-validation, immediately before any fetch (phase 4 `safeFetch`).
//
// It cannot prove a site is free of malware. Safety comes from never executing fetched
// content (HTML is parsed as text only) plus these network-level limits.
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export type UrlRejection =
  | 'bad_format'
  | 'bad_scheme'
  | 'has_credentials'
  | 'bad_port'
  | 'ip_literal'
  | 'internal_host'
  | 'bad_hostname'
  | 'look_alike_host'
  | 'blocked_host'
  | 'file_download'
  | 'too_long'
  | 'unresolvable'
  | 'non_public_address';

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: UrlRejection };

export type Resolver = (host: string) => Promise<string[]>;

const MAX_URL_LENGTH = 300;
const MAX_HOST_LENGTH = 253;

/** Shorteners hide the destination; file/code hosts serve arbitrary user content. */
const BLOCKED_HOSTS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorturl.at', 'tiny.cc', 'lnkd.in', 'rb.gy',
  'drive.google.com', 'docs.google.com', 'dropbox.com', 'mega.nz', 'mediafire.com',
  'wetransfer.com', 'we.tl', 'pastebin.com', 'transfer.sh', 'anonfiles.com',
  'raw.githubusercontent.com', 'gist.github.com',
]);

const INTERNAL_SUFFIXES = [
  '.local', '.localhost', '.internal', '.intranet', '.lan', '.home', '.corp',
  '.private', '.test', '.invalid', '.example', '.onion',
];

const DOWNLOAD_EXT = /\.(exe|msi|dmg|pkg|apk|ipa|zip|rar|7z|tar|gz|tgz|iso|bat|cmd|sh|ps1|jar|js|vbs|scr|dll|docm|xlsm|pdf|doc|docx|xls|xlsx|ppt|pptx|mp4|mov|avi|mp3)$/i;

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ['2001:db8::', 32], ['2002::', 16], ['100::', 64],
  ['::', 96], ['fec0::', 10], ['64:ff9b:1::', 48], ['2001::', 32], ['2001:10::', 28], ['2001:20::', 28], ['3fff::', 20],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

/** Expands an IPv6 address into 8 numeric groups (handles `::` and a trailing dotted IPv4). */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().split('%')[0];
  const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = text.replace(dotted[0], `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`);
  }
  const [head, tail, extra] = text.split('::');
  if (extra !== undefined) return null;
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill = tail === undefined ? 0 : 8 - left.length - right.length;
  if (fill < 0 || (tail === undefined && left.length !== 8)) return null;
  const groups = [...left, ...Array<string>(fill).fill('0'), ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** True only for globally routable addresses. */
export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, 'ipv4');
  if (family === 6) {
    const groups = ipv6Groups(ip);
    if (!groups) return false;
    const embedded = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96, used by IPv6-only networks with
    // DNS64): the real destination is the embedded IPv4, so judge that.
    const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
    if (mapped || nat64) return isPublicIp(embedded);
    return !blocked.check(ip, 'ipv6');
  }
  return false;
}

/**
 * Pure, offline check of a candidate address. Accepts bare domains ("acme.com") and
 * http(s) URLs; returns a normalized https/http URL without query string or fragment.
 */
export function validateUrlSyntax(input: string): UrlCheck {
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'too_long' };

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) return { ok: false, reason: 'bad_scheme' };
  if (!hasScheme && /^(javascript|data|vbscript|file|mailto|tel|blob|ftp|ldap|gopher|dict|about):/i.test(raw)) {
    return { ok: false, reason: 'bad_scheme' };
  }

  if (/[\s<>"'`\\^{}|]/.test(raw)) return { ok: false, reason: 'bad_format' };

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'bad_format' };
  }

  if (url.username || url.password) return { ok: false, reason: 'has_credentials' };
  if (url.port && url.port !== '80' && url.port !== '443') return { ok: false, reason: 'bad_port' };

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.length > MAX_HOST_LENGTH) return { ok: false, reason: 'too_long' };
  // URL() normalizes decimal/hex/octal IPv4 forms and brackets IPv6, so this catches them all.
  if (isIP(host) || host.startsWith('[') || /^[\d.]+$/.test(host)) {
    return { ok: false, reason: 'ip_literal' };
  }
  if (host === 'localhost' || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'internal_host' };
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) {
    return { ok: false, reason: host.includes('xn--') ? 'look_alike_host' : 'bad_hostname' };
  }
  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    return { ok: false, reason: 'look_alike_host' };
  }
  const bare = host.replace(/^www\./, '');
  if (BLOCKED_HOSTS.has(bare) || [...BLOCKED_HOSTS].some((b) => bare.endsWith(`.${b}`))) {
    return { ok: false, reason: 'blocked_host' };
  }
  if (DOWNLOAD_EXT.test(url.pathname)) return { ok: false, reason: 'file_download' };

  // Keep the path exactly as given: servers redirect /about <-> /about/, and stripping the slash loops.
  const path = url.pathname === '/' ? '' : url.pathname;
  return { ok: true, url: `${url.protocol}//${host}${path}`, host };
}

const defaultResolver: Resolver = async (host) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    const records = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('dns timeout')), 3000); }),
    ]);
    return records.map((r) => r.address);
  } finally {
    clearTimeout(timer);
  }
};

export type PublicResolution =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: 'unresolvable' | 'non_public_address' };

/** Resolves a host and requires EVERY address to be public. Returns them so callers can pin one. */
export async function resolvePublic(host: string, resolve: Resolver = defaultResolver): Promise<PublicResolution> {
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return { ok: false, reason: 'unresolvable' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'unresolvable' };
  if (!addresses.every(isPublicIp)) return { ok: false, reason: 'non_public_address' };
  return { ok: true, addresses };
}

/** Syntax check plus DNS: every address the host resolves to must be public. */
export async function verifyUrl(input: string, resolve: Resolver = defaultResolver): Promise<UrlCheck> {
  const syntax = validateUrlSyntax(input);
  if (!syntax.ok) return syntax;
  const dns = await resolvePublic(syntax.host, resolve);
  return dns.ok ? syntax : dns;
}

/** Visitor-safe wording. Deliberately vague: never explains how to get past a check. */
export function rejectionMessage(reason: UrlRejection): string {
  if (reason === 'unresolvable') return "I couldn't find that website. Could you double-check the address?";
  if (reason === 'file_download') return 'That looks like a file rather than a web page. Please share the website address instead.';
  if (reason === 'blocked_host') return "I can't analyze shortened or file-sharing links. Please share the business's own website address.";
  return "I can't analyze that address. Please share a normal public website address like example.com.";
}
