// Reading uploaded files: what is accepted, and the clear reasons for what is not.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PDF_PAGES, MAX_TEXT_CHARS, UploadError, extractFileText, normalizeText } from './extractText.js';

const txt = (s: string) => Buffer.from(s, 'utf8');
const rejects = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => e instanceof UploadError && e.code === code, `expected ${code}`);

/** A small but valid PDF, built by hand so the PDF path is tested for real. One page per entry. */
function makePdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((text, i) => {
    const contentId = 4 + i * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> >>`);
    const stream = text ? `BT /F1 12 Tf 50 700 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET` : '';
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

test('plain text and markdown are read as UTF-8 and tidied', async () => {
  const r = await extractFileText(txt('Starter Website: $1,400\r\n\r\n\r\n\r\nExtra page: $275   each'), 'prices.txt');
  assert.equal(r.mime, 'text/plain');
  assert.equal(r.text, 'Starter Website: $1,400\n\nExtra page: $275 each');
  assert.equal((await extractFileText(txt('# Pricing\nStarter site is $1,400 for 5 pages'), 'notes.md')).text.startsWith('# Pricing'), true);
});

test('a real PDF is read: its text comes out', async () => {
  const r = await extractFileText(makePdf(['Starter Website $1,400 up to 5 pages']), 'price-list.pdf');
  assert.equal(r.mime, 'application/pdf');
  assert.equal(r.pages, 1);
  assert.match(r.text, /Starter Website \$1,400 up to 5 pages/);
});

test('a multi-page PDF keeps every page', async () => {
  const r = await extractFileText(makePdf(['Page one has the starter site at $1,400', 'Page two has extra pages at $275 each']), 'p.pdf');
  assert.equal(r.pages, 2);
  assert.match(r.text, /starter site at \$1,400/);
  assert.match(r.text, /extra pages at \$275 each/);
});

test('the type is decided by content, not by the file name', async () => {
  const r = await extractFileText(makePdf(['Starter Website $1,400 up to 5 pages']), 'looks-like-text.txt');
  assert.equal(r.mime, 'application/pdf');
  await rejects(extractFileText(txt('MZ\u0000\u0000binary'), 'tool.txt'), 'unsupported'); // NUL bytes: not text
});

test('a PDF with no text (a scan) says so and how to fix it', async () => {
  await assert.rejects(extractFileText(makePdf(['']), 'scan.pdf'), (e: unknown) => e instanceof UploadError && e.code === 'empty' && /scan|image/i.test(e.message));
});

test('a damaged "PDF" is unreadable, not a crash', async () => {
  await rejects(extractFileText(Buffer.from('%PDF-1.4\nthis is not really a pdf'), 'broken.pdf'), 'unreadable');
});

test('too many PDF pages is refused', async () => {
  await rejects(extractFileText(makePdf(Array.from({ length: MAX_PDF_PAGES + 1 }, (_, i) => `Page ${i} pricing text here`)), 'huge.pdf'), 'too_large');
});

test('unsupported types, empty files, bad encodings and oversize text are refused with a clear code', async () => {
  await rejects(extractFileText(txt('Starter Website $1,400'), 'prices.docx'), 'unsupported');
  await rejects(extractFileText(Buffer.alloc(0), 'a.txt'), 'empty');
  await rejects(extractFileText(txt('too short'), 'a.txt'), 'empty');
  await rejects(extractFileText(Buffer.from([0x50, 0x72, 0x69, 0x63, 0x65, 0x20, 0xe9, 0xff, 0x20, 0x31, 0x32, 0x33, 0x20, 0x70, 0x65, 0x72, 0x20, 0x70, 0x61, 0x67, 0x65, 0x21]), 'latin1.txt'), 'unreadable'); // not valid UTF-8
  await assert.rejects(extractFileText(Buffer.from('Price list for the year\n'.split('').flatMap((c) => [c.charCodeAt(0), 0])), 'utf16.txt'), (e: unknown) => e instanceof UploadError && e.code === 'unsupported' && /UTF-8/.test(e.message)); // UTF-16
  await rejects(extractFileText(txt('x '.repeat(MAX_TEXT_CHARS)), 'long.txt'), 'too_large');
  await rejects(extractFileText(Buffer.alloc(5 * 1024 * 1024 + 1, 65), 'big.txt'), 'too_large');
});

test('normalizeText removes control characters and collapses whitespace', () => {
  assert.equal(normalizeText('a\u0000b\u0007c  \t d\n\n\n\ne'), 'abc d\n\ne');
});
