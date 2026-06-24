// astro.config.mjs
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/content/siteDomain.js";
import { buildRedirectConfig } from "./src/utils/redirects/index.ts";
import { manualChunks, assetFileNames } from "./vite.chunks.js";
import iconGeneratorIntegration from "./src/integrations/icons/icon-generator.integration.mjs";
import clientDirectivesIntegration from "./src/integrations/client-directives/client-directives.integration.mjs";
import conditionalPartytown from "./src/integrations/partytown/partytown.integration.mjs";
import robotsLlmsIntegration from "./src/integrations/robots-llms/robots-llms.integration.ts";

const redirects = await buildRedirectConfig();
const siteUrl = SITE_URL;

console.log(`Site URL: ${siteUrl}`);

export default defineConfig({
  site: siteUrl,
  trailingSlash: "never",
  server: { port: 9999 },
  output: "static",

  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 10240, // 10KB - will inline your 7.3KB CSS automatically
      cssCodeSplit: true,
      cssMinify: "esbuild",
      rollupOptions: {
        output: {
          assetFileNames,
          manualChunks,
        },
      },
    },
    css: {
      devSourcemap: false,
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
  },

  integrations: [
    clientDirectivesIntegration(),
    iconGeneratorIntegration(),
    mdx(),
    react(),
    sitemap(),
    conditionalPartytown(),
    robotsLlmsIntegration(),
  ],

  build: {
    inlineStylesheets: "always",
    split: true,
  },

  prefetch: false,

  compressHTML: true,
  redirects,

  experimental: {
    clientPrerender: false,
  },
});
