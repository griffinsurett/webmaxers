// src/components/BlueprintAgent/pdf.ts
// Builds the downloadable PDF of the visitor's plan. Display-only, like adapter.ts: every dollar is the
// server's figure from the view, nothing is calculated here. jsPDF is loaded only when someone clicks Download.
//
// Layout: page 1 is a cover (brand, business, key numbers, summary); page 2 is the cost table;
// then one card per page of the website (kept whole on one PDF page); add-ons; next step.
import { CALENDLY_URL, siteData } from '@/content/siteData';
import { money, type ViewBlueprint } from './adapter';

export interface PdfOptions {
  demo?: boolean;
  /** Injectable for tests. */
  now?: Date;
}

/** The built-in PDF fonts cover Latin-1 only. Keep accents, straighten smart punctuation, drop anything else. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\u0009\u000A -~ -ÿ]/g, '');
}

export function pdfFileName(view: Pick<ViewBlueprint, 'summary'>, now = new Date()): string {
  const slug = (view.summary.businessName || 'website-plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'website-plan'}-blueprint-${now.toISOString().slice(0, 10)}.pdf`;
}

// ---------------------------------------------------------------------------
// The document, as plain data (testable without drawing)
// ---------------------------------------------------------------------------

export interface PdfCostRow { item: string; detail: string; amount: string; group?: boolean }
export interface PdfPageCard {
  title: string;
  path: string;
  price: string;
  purpose: string;
  cta: string;
  sections: { heading: string; purpose: string; items: string[] }[];
  outlineOnly: boolean;
}
export interface PdfDoc {
  demo: boolean;
  label: string;
  business: string;
  details: string[];
  date: string;
  stats: { label: string; value: string }[];
  summary: { label: string; value: string }[];
  cost: { rows: PdfCostRow[]; totalLabel: string; total: string; monthly?: string; note: string };
  pages: PdfPageCard[];
  leftOut: string[];
  addons: { name: string; purpose: string; price: string }[];
  next: { text: string; url: string };
}

const list = (names: string[]) => (names.length <= 6 ? names.join(', ') : `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`);

export function buildPdfDoc(v: ViewBlueprint, opts: PdfOptions = {}): PdfDoc {
  const demo = !!opts.demo;
  const date = (opts.now ?? new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const included = v.pages.filter((p) => p.included);
  const addons = v.addons.filter((a) => a.included);
  const c = v.breakdown;

  const rows: PdfCostRow[] = [];
  rows.push({
    item: `${c.package.name} website`,
    detail: `Includes up to ${c.package.includedPages} pages${c.covered.length ? `: ${list(c.covered.map((l) => l.title))}` : ''}`,
    amount: money(c.package.base),
    group: true,
  });
  if (c.extraPages.length > 0) {
    rows.push({ item: `Extra pages (${c.extraPages.length})`, detail: 'Pages beyond the base allowance', amount: money(v.price.extraPages), group: true });
    for (const l of c.extraPages) rows.push({ item: l.title, detail: l.note ?? '', amount: money(l.amount) });
  }
  if (c.content.length > 0) {
    rows.push({ item: 'Content', detail: '', amount: money(v.price.content), group: true });
    for (const l of c.content) rows.push({ item: l.title, detail: l.note ?? '', amount: money(l.amount) });
  }
  if (c.addons.length > 0) {
    rows.push({ item: `Add-ons (${c.addons.length})`, detail: 'Setup cost, plus any monthly fee', amount: money(v.price.addonSetup), group: true });
    for (const l of c.addons) rows.push({ item: l.title, detail: l.monthly > 0 ? `+ ${money(l.monthly)} per month` : l.note ?? '', amount: money(l.amount) });
  }

  const summary = [
    { label: 'Main goal', value: v.summary.primaryGoal },
    { label: 'Who it is for', value: v.summary.primaryAudience },
    { label: 'Our approach', value: v.summary.recommendedStrategy },
  ].filter((r) => r.value);

  return {
    demo,
    label: demo ? 'Example website blueprint' : 'Website blueprint and estimate',
    business: v.summary.businessName || 'Your business',
    details: [v.summary.industry, v.summary.serviceArea, v.summary.existingUrl].filter((x): x is string => !!x),
    date,
    stats: [
      { label: 'Pages', value: String(included.length) },
      { label: 'Add-ons', value: String(addons.length) },
      { label: 'Monthly', value: v.price.monthly > 0 ? money(v.price.monthly) : 'None' },
      { label: demo ? 'Example total' : 'Total upfront', value: money(v.price.total) },
    ],
    summary,
    cost: {
      rows,
      totalLabel: demo ? 'Example total' : 'Total upfront',
      total: money(v.price.total),
      monthly: v.price.monthly > 0 ? `plus ${money(v.price.monthly)} a month` : undefined,
      note: 'This is an estimate based on the pages and add-ons in this plan. The final scope and price are confirmed with Webmaxxers before any work begins.',
    },
    pages: included.map((p) => ({
      title: p.title,
      path: p.path,
      price: p.estimatedCost > 0 ? `+${money(p.estimatedCost)}` : 'Included',
      purpose: p.purpose,
      cta: p.cta,
      sections: p.sections.map((s) => ({ heading: s.heading, purpose: s.purpose ?? '', items: s.subsections.map((x) => x.heading) })),
      outlineOnly: p.outlineOnly,
    })),
    leftOut: v.pages.filter((p) => !p.included).map((p) => p.title),
    addons: addons.map((a) => ({
      name: a.name,
      purpose: a.purpose,
      price: a.monthlyCost > 0 ? `${money(a.setupCost)} + ${money(a.monthlyCost)}/mo` : money(a.setupCost),
    })),
    next: {
      text: `Ready to move forward, or want to change something? Book a free call with ${siteData.title} and we will confirm the scope and price together.`,
      url: CALENDLY_URL,
    },
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];
const ACCENT: Rgb = [79, 95, 217];
const TINT: Rgb = [243, 244, 252];
const INK: Rgb = [28, 28, 34];
const BODY: Rgb = [72, 72, 82];
const MUTED: Rgb = [128, 128, 140];
const LINE: Rgb = [226, 226, 234];
const WHITE: Rgb = [255, 255, 255];
const ON_ACCENT: Rgb = [225, 228, 250];

/** Draws the document into a PDF (nothing is saved here). */
export async function renderBlueprintPdf(v: ViewBlueprint, opts: PdfOptions = {}) {
  const { jsPDF } = await import('jspdf');
  const d = buildPdfDoc(v, opts);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  const CW = W - M * 2;
  const BOTTOM = H - 64;
  let y = M;

  const t = pdfSafe;
  const font = (size: number, bold = false, color: Rgb = INK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const wrap = (text: string, size: number, width: number, bold = false): string[] => {
    font(size, bold);
    return doc.splitTextToSize(t(text), width) as string[];
  };
  const fill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);
  const newPage = () => {
    doc.addPage();
    y = M + 8;
  };
  const ensure = (need: number) => {
    if (y + need > BOTTOM) newPage();
  };
  const para = (text: string, size: number, o: { bold?: boolean; color?: Rgb; x?: number; width?: number; lead?: number } = {}) => {
    const x = o.x ?? M;
    const lead = o.lead ?? size * 1.45;
    const lines = wrap(text, size, o.width ?? CW - (x - M), o.bold);
    font(size, o.bold, o.color ?? BODY);
    for (const line of lines) {
      ensure(lead);
      doc.text(line, x, y);
      y += lead;
    }
  };
  const sectionTitle = (title: string, kicker?: string) => {
    ensure(60);
    if (kicker) {
      font(8.5, true, ACCENT);
      doc.text(t(kicker).toUpperCase(), M, y);
      y += 16;
    }
    font(17, true, INK);
    doc.text(t(title), M, y);
    y += 10;
    stroke(LINE);
    doc.line(M, y, W - M, y);
    y += 22;
  };

  // ---------- PAGE 1: COVER ----------
  fill(ACCENT);
  doc.rect(0, 0, W, 70, 'F');
  font(17, true, WHITE);
  doc.text(siteData.title.toUpperCase(), M, 42);
  font(8.5, false, ON_ACCENT);
  doc.text(t(d.label).toUpperCase(), W - M, 40, { align: 'right' });

  y = 132;
  font(9, true, ACCENT);
  doc.text('PREPARED FOR', M, y);
  y += 32;
  font(30, true, INK);
  for (const line of doc.splitTextToSize(t(d.business), CW) as string[]) {
    doc.text(line, M, y);
    y += 36;
  }
  if (d.details.length) para(d.details.join('    |    '), 11, { color: MUTED });
  para(d.date, 10, { color: MUTED });
  if (d.demo) {
    y += 6;
    para('Sample business and example figures. This is not a quote for your business.', 10, { bold: true });
  }

  // Key numbers: four tiles in one row.
  y += 28;
  const tileGap = 10;
  const tileW = (CW - tileGap * 3) / 4;
  d.stats.forEach((s, i) => {
    const x = M + i * (tileW + tileGap);
    const last = i === d.stats.length - 1;
    fill(last ? ACCENT : TINT);
    doc.roundedRect(x, y, tileW, 62, 6, 6, 'F');
    font(8, true, last ? ON_ACCENT : MUTED);
    doc.text(t(s.label).toUpperCase(), x + 12, y + 20);
    font(17, true, last ? WHITE : INK);
    doc.text(t(s.value), x + 12, y + 45);
  });
  y += 62 + 36;

  // Summary: label column + text column.
  if (d.summary.length) {
    font(8.5, true, ACCENT);
    doc.text('YOUR PROJECT AT A GLANCE', M, y);
    y += 14;
    stroke(LINE);
    doc.line(M, y, W - M, y);
    y += 20;
    for (const r of d.summary) {
      const lines = wrap(r.value, 10.5, CW - 110);
      const h = Math.max(lines.length * 15, 15);
      ensure(h + 14);
      font(9, true, MUTED);
      doc.text(t(r.label).toUpperCase(), M, y);
      font(10.5, false, BODY);
      lines.forEach((line, i) => doc.text(line, M + 110, y + i * 15));
      y += h + 12;
    }
  }

  // ---------- PAGE 2: COST ----------
  newPage();
  sectionTitle('Project cost', 'Investment');
  const colItem = M;
  const colDetail = M + 170;
  const colAmt = W - M;
  const detailW = colAmt - 80 - colDetail;
  fill(TINT);
  doc.rect(M, y - 13, CW, 22, 'F');
  font(8, true, MUTED);
  doc.text('ITEM', colItem + 8, y);
  doc.text('DETAIL', colDetail, y);
  doc.text('AMOUNT', colAmt - 8, y, { align: 'right' });
  y += 24;
  for (const r of d.cost.rows) {
    const itemLines = wrap(r.item, 10, 160, !!r.group);
    const detailLines = r.detail ? wrap(r.detail, 9, detailW) : [];
    const h = Math.max(itemLines.length * 14, detailLines.length * 12.5, 14) + 12;
    ensure(h);
    if (r.group) {
      fill(TINT);
      doc.rect(M, y - 13, CW, h - 2, 'F');
    }
    font(10, !!r.group, INK);
    itemLines.forEach((line, i) => doc.text(line, colItem + 8, y + i * 14));
    font(9, false, MUTED);
    detailLines.forEach((line, i) => doc.text(line, colDetail, y + i * 12.5));
    font(10, !!r.group, INK);
    doc.text(t(r.amount), colAmt - 8, y, { align: 'right' });
    y += h;
    stroke(LINE);
    doc.line(M, y - 13, W - M, y - 13);
  }
  y += 14;
  ensure(96);
  fill(ACCENT);
  doc.roundedRect(M, y, CW, 60, 6, 6, 'F');
  font(9, true, ON_ACCENT);
  doc.text(t(d.cost.totalLabel).toUpperCase(), M + 18, y + 24);
  if (d.cost.monthly) {
    font(10.5, false, ON_ACCENT);
    doc.text(t(d.cost.monthly), M + 18, y + 43);
  }
  font(26, true, WHITE);
  doc.text(t(d.cost.total), W - M - 18, y + 39, { align: 'right' });
  y += 60 + 18;
  para(d.cost.note, 9, { color: MUTED });

  // ---------- NEXT STEP ----------
  ensure(110);
  y += 20;
  fill(TINT);
  const nextLines = wrap(d.next.text, 10.5, CW - 40);
  const nextH = 40 + nextLines.length * 15 + 22;
  doc.roundedRect(M, y, CW, nextH, 6, 6, 'F');
  font(8.5, true, ACCENT);
  doc.text('NEXT STEP', M + 20, y + 24);
  font(10.5, false, BODY);
  nextLines.forEach((line, i) => doc.text(line, M + 20, y + 44 + i * 15));
  font(10.5, true, ACCENT);
  doc.textWithLink(d.next.url, M + 20, y + 44 + nextLines.length * 15 + 8, { url: d.next.url });


  // ---------- PAGES OF THE SITE: one card each, never split ----------
  newPage();
  sectionTitle(`Your pages (${d.pages.length})`, 'Page by page');
  const PAD = 16;
  for (const p of d.pages) {
    const inner = CW - PAD * 2;
    const purposeLines = p.purpose ? wrap(p.purpose, 10, inner) : [];
    const ctaLines = p.cta ? wrap(`Main call to action: ${p.cta}`, 9, inner) : [];
    let sectionsH = 0;
    const sectionLines = p.sections.map((s) => {
      const head = wrap(s.purpose ? `${s.heading}: ${s.purpose}` : s.heading, 9.5, inner - 18);
      const items = s.items.length ? wrap(s.items.join('  -  '), 8.5, inner - 18) : [];
      sectionsH += head.length * 13 + items.length * 11.5 + 8;
      return { head, items };
    });
    const outlineH = p.outlineOnly ? 16 : 0;
    const cardH = PAD + 22 + purposeLines.length * 14.5 + (ctaLines.length ? ctaLines.length * 12.5 + 8 : 0) + (sectionsH ? sectionsH + 30 : 0) + outlineH + PAD - 4;
    ensure(Math.min(cardH, BOTTOM - M) + 14);

    const top = y;
    const height = Math.min(cardH, BOTTOM - top);
    stroke(LINE);
    fill(WHITE);
    doc.roundedRect(M, top, CW, height, 6, 6, 'FD');
    fill(ACCENT);
    doc.rect(M, top + 10, 3, 22, 'F');

    let cy = top + PAD + 8;
    font(12.5, true, INK);
    doc.text(t(p.title), M + PAD, cy);
    const titleW = doc.getTextWidth(t(p.title));
    font(9, false, MUTED);
    doc.text(t(p.path), M + PAD + titleW + 10, cy);
    font(10, true, p.price === 'Included' ? MUTED : ACCENT);
    doc.text(t(p.price), M + CW - PAD, cy, { align: 'right' });
    cy += 20;

    font(10, false, BODY);
    for (const line of purposeLines) {
      doc.text(line, M + PAD, cy);
      cy += 14.5;
    }
    if (ctaLines.length) {
      cy += 2;
      font(9, true, ACCENT);
      for (const line of ctaLines) {
        doc.text(line, M + PAD, cy);
        cy += 12.5;
      }
      cy += 4;
    }
    if (sectionLines.length) {
      stroke(LINE);
      doc.line(M + PAD, cy - 2, M + CW - PAD, cy - 2);
      cy += 14;
      font(8, true, MUTED);
      doc.text('PLANNED CONTENT', M + PAD, cy);
      cy += 14;
      sectionLines.forEach((s, i) => {
        font(9.5, true, INK);
        doc.text(`${i + 1}.`, M + PAD, cy);
        font(9.5, false, BODY);
        for (const line of s.head) {
          doc.text(line, M + PAD + 18, cy);
          cy += 13;
        }
        font(8.5, false, MUTED);
        for (const line of s.items) {
          doc.text(line, M + PAD + 18, cy);
          cy += 11.5;
        }
        cy += 8;
      });
    }
    if (p.outlineOnly) {
      font(8.5, false, MUTED);
      doc.text('Outline only: the detailed content is written after kickoff.', M + PAD, cy);
    }
    y = top + height + 14;
  }

  if (d.leftOut.length) {
    ensure(50);
    y += 4;
    font(8.5, true, MUTED);
    doc.text('LEFT OUT OF THE PLAN', M, y);
    y += 14;
    para(d.leftOut.join(', '), 10);
  }

  // ---------- ADD-ONS ----------
  if (d.addons.length) {
    ensure(90);
    y += 18;
    sectionTitle(`Add-ons (${d.addons.length})`, 'Functionality');
    for (const a of d.addons) {
      const lines = a.purpose ? wrap(a.purpose, 9.5, CW - 16) : [];
      ensure(30 + lines.length * 13);
      font(11, true, INK);
      doc.text(t(a.name), M, y);
      font(10, true, ACCENT);
      doc.text(t(a.price), W - M, y, { align: 'right' });
      y += 15;
      font(9.5, false, BODY);
      for (const line of lines) {
        doc.text(line, M, y);
        y += 13;
      }
      y += 8;
      stroke(LINE);
      doc.line(M, y - 4, W - M, y - 4);
      y += 10;
    }
  }

  // ---------- FOOTER on every page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    stroke(LINE);
    doc.line(M, H - 42, W - M, H - 42);
    font(8, false, MUTED);
    doc.text(t(d.business), M, H - 27);
    doc.text(`${siteData.title}  |  ${siteData.domain}`, W / 2, H - 27, { align: 'center' });
    doc.text(`${i} / ${pages}`, W - M, H - 27, { align: 'right' });
  }
  return doc;
}

/** Builds the PDF and starts the download. Throws if the browser cannot make the file. */
export async function downloadBlueprintPdf(v: ViewBlueprint, opts: PdfOptions = {}): Promise<string> {
  const doc = await renderBlueprintPdf(v, opts);
  const name = pdfFileName(v, opts.now);
  doc.save(name);
  return name;
}
