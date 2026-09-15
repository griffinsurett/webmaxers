// astro.config.mjs
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { buildRedirectConfig } from "./src/utils/redirects/index.ts";
import { manualChunks, assetFileNames } from "./vite.chunks.js";
import iconGeneratorIntegration from "./src/integrations/icons/icon-generator.integration.mjs";
import clientDirectivesIntegration from "./src/integrations/client-directives/client-directives.integration.mjs";
import conditionalPartytown from "./src/integrations/partytown/partytown.integration.mjs";
import robotsLlmsIntegration from "./src/integrations/robots-llms/robots-llms.integration.ts";
// Chatbot knowledge-base generator (feeds the API-connected ChatBot). Must stay
// enabled: /api/chat imports the file it writes, so leaving it off freezes the
// KB (and its site name/URLs) at whatever was last committed.
import chatbotKbIntegration from './src/integrations/chatbot/chatbot-kb.integration.ts';
import { SITE_URL } from "./src/content/siteData.ts";

const redirects = await buildRedirectConfig();

console.log(`Site URL: ${SITE_URL}`);

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  server: { port: 9999 },
  adapter: vercel(),
  output: "static",

  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "windows-path-fix",
        enforce: "pre",
        resolveId(id) {
          if (id && id.match(/^\.[/\\][A-Za-z]:[/\\]/)) {
            return id.replace(/^\.[/\\]/, "").replace(/\\/g, "/");
          }
          return null;
        },
      },
    ],
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
    chatbotKbIntegration(),
    {
      name: "background-sync",
      hooks: {
        "astro:server:start": () => {
          console.log(
            "[Background Sync] Starting background sync interval (every 20 seconds)...",
          );
          const intervalId = setInterval(async () => {
            try {
              const { syncSupabaseKnowledge } =
                await import("./src/utils/knowledgeSync.ts");
              await syncSupabaseKnowledge();
            } catch (err) {
              // Fail silently or print error
            }
          }, 20000);

          const shutdown = () => {
            clearInterval(intervalId);
            process.exit(0);
          };
          process.once("SIGINT", shutdown);
          process.once("SIGTERM", shutdown);
        },
      },
    },
  ],

  build: {
    inlineStylesheets: "always", // Inline CSS avoids render-blocking external stylesheets
    split: true,
  },

  prefetch: false,

  compressHTML: true,
  redirects,

  experimental: {
    clientPrerender: false,
  },
});
