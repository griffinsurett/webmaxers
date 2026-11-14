// src/utils/contactLinks.ts
import type { CollectionEntry } from 'astro:content';
import { formatPhoneNumber } from '@/utils/string';

export interface ContactLink {
  id: string;
  title: string;
  description: string;
  displayValue: string;
  url?: string;
  linkPrefix?: string;
  tags?: string[];
  icon?: any;
}

function extractData(item: any): any {
  if (!item) return {};
  if (item.data) return { ...item.data, id: item.id ?? item.data.id };
  return item;
}

export function normalizeContactLinks(items: Array<any>): ContactLink[] {
  return items
    .map((item) => {
      const data = extractData(item);
      const id = String(data.id ?? item?.id ?? 'contact');
      const linkPrefix = data.linkPrefix ?? '';
      const tags: string[] = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
      const rawValue = String(data.description ?? '');
      const title = String(data.title ?? '');
      const displayValue = linkPrefix?.toLowerCase().startsWith("tel")
        ? formatPhoneNumber(rawValue)
        : rawValue;
      const url = data.url ?? (linkPrefix ? `${linkPrefix}${rawValue}` : undefined);

      return {
        id,
        title,
        description: rawValue,
        displayValue,
        url,
        linkPrefix,
        tags,
        icon: data.icon,
      };
    })
    .filter((link) => !!link.description);
}

export async function getContactLinks(): Promise<ContactLink[]> {
  const { getPublishedCollection } = await import('@/utils/collections');
  const entries = await getPublishedCollection('contact-us');
  return normalizeContactLinks(entries as CollectionEntry<'contact-us'>[]);
}

const PHONE_CONTACT_IDS = new Set(["phone"]);
const EMAIL_CONTACT_IDS = new Set(["email", "support-email", "contact-email"]);

export const isPhoneContactId = (id?: string | null): boolean =>
  id ? PHONE_CONTACT_IDS.has(id.toLowerCase()) : false;

export const isEmailContactId = (id?: string | null): boolean =>
  id ? EMAIL_CONTACT_IDS.has(id.toLowerCase()) : false;
