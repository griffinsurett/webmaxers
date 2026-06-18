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
    schema: MenuItemFields,
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
      baseSchema({ image })
  }),

  "blog": defineCollection({
    loader: GlobLoad("blog"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        author: refSchema("authors"),
        tags: z.array(z.string()).default([]),
        readingTime: z.number().optional(),
      }),
  }),

  "authors": defineCollection({
    loader: FileLoad("authors", "authors.json"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        email: z.string().email().optional(),
        social: z
          .object({
            twitter: z.string().url().optional(),
            github: z.string().url().optional(),
            linkedin: z.string().url().optional(),
            website: z.string().url().optional(),
          })
          .optional(),
        role: z.string().optional(),
      }),
  }),

  "capabilities": defineCollection({
    loader: GlobLoad("capabilities"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        price: z.string().optional(),
        features: z.array(z.string()).default([]),
        tagline: z.string().optional(),
        /** Solution(s) this capability belongs to — drives the related grid on
         *  each solution detail page. */
        solutions: refSchema("solutions").optional(),
        includes: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
        steps: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
      }),
  }),

  // ── solutions ──────────────────────────────────────────
  // The three headline things we build (Websites / Branding / Ai Agents),
  // rendered as the ServicesScene intro stack via SolutionsVariant.
  "solutions": defineCollection({
    loader: GlobLoad("solutions"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        icon: z.string().optional(),
        tagline: z.string().optional(),
        includes: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
        steps: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
      }),
  }),

  // ── stats ──────────────────────────────────────────────
  // Headline numbers (e.g. "7+ Years", "$1M+ Clients") rendered as animated
  // count-up counters via StatsVariant. `title` is the label under the number.
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

  "projects": defineCollection({
    loader: GlobLoad("projects"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        client: z.string().optional(),
        projectUrl: z.string().url().optional(),
        technologies: z.array(z.string()).default([]),
        category: z.string().optional(),
        industry: z.string().optional(),
        featuredVideo: z.string().optional(),
        link: z.object({
          label: z.string(),
          url: z.string(),
        }).optional(),
        fullSiteImage: z.union([
          image(),
          z.object({ src: image(), alt: z.string().optional() }),
        ]).optional(),
      }),
  }),

  "faq": defineCollection({
    loader: GlobLoad("faq"),
    schema: ({ image }) =>
      baseSchema({ image }).extend({
        category: z.string().optional(),
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
};
