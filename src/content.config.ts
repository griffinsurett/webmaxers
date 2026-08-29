// src/content.config.ts
/**
 * Collection structure:
 *
 * src/content/[collection]/
 *   _meta.mdx         ← Collection config (frontmatter) + index page content (body)
 *                        The _ prefix excludes it from collection entries
 *   item-one.mdx      ← Collection item
 *   item-two.mdx      ← Collection item
 *
 * _meta.mdx frontmatter controls:
 * - title: Display name for the collection
 * - description: Collection description
 * - hasPage: Whether to generate /[collection] index page
 * - itemsHasPage: Whether items get individual pages
 * - featuredImage: Hero image for index page
 * - seo: SEO overrides
 */
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { baseSchema, MenuSchema, MenuItemFields, refSchema } from "./content/schema";
import { GlobLoad, FileLoad } from "@/utils/loaders/loaderUtils";
import { MenuItemsLoader } from "@/utils/loaders/MenuItemsLoader";

export const collections = {
  // ── menus.json ─────────────────────────────────────────
  "menus": defineCollection({
    loader: FileLoad("menus", "menus.json"),
    schema: MenuSchema,
  }),

  // ── menu-items.json ─────────────────────────────────────
  "menu-items": defineCollection({
    loader: MenuItemsLoader(),
    schema: ({ image }) => MenuItemFields({ image }),
  }),

  "contact-us": defineCollection({
    loader: FileLoad("contact-us", "contact-us.json"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        linkPrefix: z.string().optional(),
      }),
  }),

  "social-media": defineCollection({
    loader: FileLoad("social-media", "socialmedia.json"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        link: z.string().optional(),
      }),
  }),

  // ── legal ───────────────────────────────────────────────
  "legal": defineCollection({
    loader: GlobLoad("legal"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        effectiveDate: z
          .union([z.date(), z.string()])
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            if (val instanceof Date) return val;
            return new Date(val);
          }),
      }),
  }),

  "about-us": defineCollection({
    loader: GlobLoad("about-us"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        heroIntro: z.string().optional(),
        heroChecklist: z.array(z.string()).default([]),
        statLabel: z.string().optional(),
        statValue: z.number().optional(),
        statPrefix: z.string().optional(),
        statSuffix: z.string().optional(),
        statDescription: z.string().optional(),
        reviewLabel: z.string().optional(),
        reviewLink: z.url().optional(),
        featureItems: z
          .array(
            z.object({
              icon: z.string(),
              text: z.string(),
            }),
          )
          .default([]),
      }),
  }),

  "blog": defineCollection({
    loader: GlobLoad("blog"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        author: refSchema("authors"),
        tags: z.array(z.string()).default([]),
        readingTime: z.number().optional(),
        capabilities: refSchema("capabilities"),
      }),
  }),

  "authors": defineCollection({
    loader: FileLoad("authors", "authors.json"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        email: z.email().optional(),
        social: z
          .object({
            twitter: z.url().optional(),
            github: z.url().optional(),
            linkedin: z.url().optional(),
            website: z.url().optional(),
          })
          .optional(),
        role: z.string().optional(),
      }),
  }),

  // ── stats ──────────────────────────────────────────────
  // Headline numbers (e.g. "7+ Years", "$1M+ Clients") rendered as animated
  // count-up counters via HeroStatsVariant. `title` is the label under the number.
  "stats": defineCollection({
    loader: GlobLoad("stats"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        /** The number to count up to. Optional so the collection's _meta.mdx
         *  (which has no value) still validates; every real item sets it. */
        value: z.number().default(0),
        /** Optional text before the number (e.g. "$"). */
        prefix: z.string().optional(),
        /** Optional text after the number (e.g. "+", "%", "M"). */
        suffix: z.string().optional(),
        /** Decimal places to display (e.g. 1 for "4.9"). */
        decimals: z.number().optional(),
      }),
  }),

  "testimonials": defineCollection({
    loader: GlobLoad("testimonials"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        author: z.string(),
        role: z.string(),
        company: z.string().optional(),
        rating: z.number().min(1).max(5).default(5),
        featured: z.boolean().default(false),
      }),
  }),

  "projects": defineCollection({
    loader: GlobLoad("projects"),
    schema: ({ image }) =>
      baseSchema({ image }).omit({ featuredImage: true }).extend({
        client: z.string().optional(),
        projectUrl: z.url().optional(),
        link: z
          .object({
            label: z.string(),
            url: z.url(),
          })
          .optional(),
        technologies: z.array(z.string()).default([]),
        industry: refSchema("industries"),
        featuredVideo: z.string().optional(),
        fullSiteImage: z
          .object({
            src: image(),
            alt: z.string(),
          })
          .optional(),
      }),
  }),

  "faq": defineCollection({
    loader: GlobLoad("faq"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        category: z.string().optional(),
        capabilities: refSchema("capabilities"),
      }),
  }),

  // ── capabilities ──────────────────────────────────────────
  "capabilities": defineCollection({
    loader: GlobLoad("capabilities"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        features: z.array(z.string()).default([]),
        technologyCards: refSchema("technologies"),
      }),
  }),

  // ── industries ────────────────────────────────────────────
  "industries": defineCollection({
    loader: GlobLoad("industries"),
    schema: ({ image }) =>
      baseSchema({ image }),
  }),

  // ── technologies ──────────────────────────────────────────
  "technologies": defineCollection({
    loader: GlobLoad("technologies"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        capabilities: refSchema("capabilities"),
      }),
  }),

  // ── benefits ──────────────────────────────────────────
  "benefits": defineCollection({
    loader: GlobLoad("benefits"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        highlight: z.boolean().optional(),
      }),
  }),

};
