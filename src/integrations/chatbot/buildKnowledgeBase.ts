// src/integrations/chatbot/buildKnowledgeBase.ts
// Fully dynamic — scans every collection, no names hardcoded, no opt-out.
// Called at build time by chatbot-kb.integration.ts.

import { scanCollections, DEFAULT_CONTENT_DIR } from "../../utils/filesystem/contentScanner";
import type { ScannedItem } from "../../utils/filesystem/contentScanner";
import { siteData } from "../../content/siteData";
import { RULES, FOOTER } from "./prompt";

const str = (v: unknown) => (v != null ? String(v).trim() : "");
const num = (v: unknown) => Number(v) || 0;

const byOrder = (a: ScannedItem, b: ScannedItem) => num(a.data.order) - num(b.data.order);

const sectionHeading = (name: string, meta: Record<string, any>) =>
  str(meta.title) || name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const SKIP_FIELDS = new Set(["title", "draft", "order", "slug"]);

function formatItem(i: ScannedItem): string {
  let out = `- ${str(i.data.title)}`;
  if (i.data.description) out += `: ${str(i.data.description)}`;
  for (const [key, val] of Object.entries(i.data)) {
    if (SKIP_FIELDS.has(key) || key === "description" || val == null || val === "") continue;
    if (Array.isArray(val)) {
      const items = (val as unknown[]).map(String).filter(Boolean);
      if (items.length) out += `\n  ${key}: ${items.join(", ")}`;
    } else {
      out += `\n  ${key}: ${str(val)}`;
    }
  }
  return out + "\n";
}

export function buildKnowledgeBase(contentDir: string = DEFAULT_CONTENT_DIR): string {
  const collections = scanCollections(contentDir);

  // Behaviour + formatting rules come from the shared prompt, so the dev path
  // and the build path cannot drift apart again (see prompt.ts).
  let kb = RULES + `
---
## Contact Information & Communication Channels
We communicate with clients through several channels:
- Email: You can contact us by visiting our contact page at ${siteData.url}/contact-us or booking a call.
- Booking a Call: Schedule a free 30-minute discovery call directly at https://calendly.com/griffinswebservices/30min.
- Phone & Meetings: We use phone calls and Google Meet for all project communication and updates.

`;

  for (const collection of collections) {
    const items = collection.items.filter((i) => !i.data.draft).sort(byOrder);
    if (!items.length) continue;

    kb += `---\n## ${sectionHeading(collection.name, collection.meta)}\n`;
    if (collection.meta.description) kb += `${str(collection.meta.description)}\n`;
    items.forEach((i) => { kb += formatItem(i); });
    kb += "\n";
  }

  kb += FOOTER;

  return kb;
}
