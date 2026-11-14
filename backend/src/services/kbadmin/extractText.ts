// backend/src/services/kbadmin/extractText.ts
// Turns an uploaded file (PDF, .txt or .md) into plain text, or says clearly why it cannot.
// Uploads come from an admin, but a file is still untrusted input: size, page count and time are
// capped, the type is checked by content (not just the name), and nothing is executed.
import { extractText as pdfExtractText, getDocumentProxy } from 'unpdf';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;
/** Longer than this will not fit the model's reading budget; ask for the document to be split. */
export const MAX_TEXT_CHARS = 60_000;
const MIN_TEXT_CHARS = 20;
const PDF_TIMEOUT_MS = 20_000;

export type UploadFailure = 'unsupported' | 'too_large' | 'empty' | 'unreadable';

export class UploadError extends Error {
  constructor(public readonly code: UploadFailure, message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface ExtractedFile {
  text: string;
  mime: 'application/pdf' | 'text/plain';
  pages?: number;
}

const isPdf = (buf: Buffer) => buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';

/** Collapses whitespace noise from PDFs and Windows line endings; removes control characters. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new UploadError('unreadable', 'Reading the PDF took too long.')), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

export async function extractFileText(buf: Buffer, filename: string): Promise<ExtractedFile> {
  if (buf.length === 0) throw new UploadError('empty', 'The file is empty.');
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('too_large', `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);

  let text: string;
  let mime: ExtractedFile['mime'];
  let pages: number | undefined;

  if (isPdf(buf)) {
    mime = 'application/pdf';
    try {
      const pdf = await withTimeout(getDocumentProxy(new Uint8Array(buf)), PDF_TIMEOUT_MS);
      if (pdf.numPages > MAX_PDF_PAGES) throw new UploadError('too_large', `The PDF has ${pdf.numPages} pages; the limit is ${MAX_PDF_PAGES}.`);
      pages = pdf.numPages;
      const out = await withTimeout(pdfExtractText(pdf, { mergePages: true }), PDF_TIMEOUT_MS);
      text = Array.isArray(out.text) ? out.text.join('\n\n') : out.text;
    } catch (err) {
      if (err instanceof UploadError) throw err;
      throw new UploadError('unreadable', 'That PDF could not be read. It may be damaged or password-protected.');
    }
  } else {
    if (!/\.(txt|md|markdown)$/i.test(filename)) {
      throw new UploadError('unsupported', 'Only PDF, .txt and .md files can be uploaded.');
    }
    if (buf.includes(0)) throw new UploadError('unsupported', 'That file is not plain UTF-8 text (it may be a binary file, or text saved as UTF-16). Save it as UTF-8 text and try again.');
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      throw new UploadError('unreadable', 'That file is not valid UTF-8 text. Save it as UTF-8 and try again.');
    }
    mime = 'text/plain';
  }

  text = normalizeText(text);
  if (text.length < MIN_TEXT_CHARS) {
    throw new UploadError('empty', mime === 'application/pdf'
      ? 'No readable text was found in that PDF. If it is a scan or an image, export a text version or upload a .txt file.'
      : 'The file has no usable text.');
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new UploadError('too_large', `The document has ${text.length.toLocaleString('en-US')} characters; the limit is ${MAX_TEXT_CHARS.toLocaleString('en-US')}. Split it into smaller files.`);
  }
  return { text, mime, pages };
}
