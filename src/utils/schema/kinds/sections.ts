// src/utils/schema/kinds/sections.ts
/**
 * Section kinds — built from the items a component shows, so the schema
 * matches what the rendering boundary supplies. FAQs register captured MDX
 * answers through Schema/RenderedAnswer; testimonials use Schema.
 */
import { BUSINESS_ID, BUSINESS_NAME, BUSINESS_TYPE, BUSINESS_URL } from "../identity";
import type { ListKind } from "../types";
import { getTestimonialQuote } from "@/utils/collections/prepare";

/**
 * FAQPage from all rendered question sections collected on this page.
 */
export const faq: ListKind = {
  mode: "list",
  lockedFields: ["question", "answer"],
  fields: {
    question: { from: "title", as: "text" },
    answer: { from: "renderedAnswer" },
  },
  dedupeKey: () => "faq",
  build: (items, { url }) => {
    const entries = items.filter((i) => i.question && i.answer);
    if (entries.length === 0) return null;
    return {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: entries.map((e) => ({
        "@type": "Question",
        name: e.question,
        acceptedAnswer: { "@type": "Answer", text: e.answer },
      })),
    };
  },
};

/** Reviews attach to an explicit content reference, otherwise the business. */
export const reviews: ListKind = {
  mode: "list",
  protectedFields: ["rating"],
  fields: {
    author: { from: ["author", "company", "title"], as: "text" },
    body: { resolve: ({ data }) => getTestimonialQuote(data) },
    rating: { from: "rating", as: "rating" },
    target: { from: "reviewedItem", as: "reviewTarget" },
    hasTarget: { resolve: ({ data }) => Boolean(data.reviewedItem) },
  },
  dedupeKey: () => "reviews",
  build: (items) => {
    const groups = new Map<string, { target: Record<string, any>; reviews: Record<string, any>[] }>();
    for (const item of items) {
      if (!item.author || !item.body || (item.hasTarget && !item.target)) continue;
      const target = item.target ?? { "@id": BUSINESS_ID, "@type": BUSINESS_TYPE, name: BUSINESS_NAME, url: BUSINESS_URL };
      const group: { target: Record<string, any>; reviews: Record<string, any>[] } = groups.get(target["@id"]) ?? { target, reviews: [] };
      group.reviews.push({
        "@type": "Review",
        author: { "@type": "Person", name: item.author },
        reviewBody: item.body,
        ...(item.rating && { reviewRating: item.rating }),
      });
      groups.set(target["@id"], group);
    }
    const nodes = [...groups.values()].map(({ target, reviews }) => {
      const ratings = reviews.flatMap((review) => review.reviewRating ? [review.reviewRating.ratingValue] : []);
      return {
        ...target,
        review: reviews,
        ...(ratings.length && { aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
          ratingCount: ratings.length,
          reviewCount: reviews.length,
          bestRating: 5,
          worstRating: 1,
        } }),
      };
    });
    return nodes.length ? { "@graph": nodes } : null;
  },
};
