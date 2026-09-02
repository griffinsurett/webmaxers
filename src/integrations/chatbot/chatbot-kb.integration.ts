// src/integrations/chatbot/chatbot-kb.integration.ts
// Build: reads llms-full.txt (written by robots-llms at astro:build:done) so the
// KB contains full page body + collection content — not just frontmatter.
// Dev: falls back to the frontmatter-only scanner since there's no dist yet.

import type { AstroIntegration } from "astro";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildKnowledgeBase } from "./buildKnowledgeBase";
// One shared copy of the prompt — see prompt.ts for why.
import { RULES, FOOTER } from "./prompt";

const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "knowledge-base.generated.ts"
);

function write(kb: string, logger: { info: (s: string) => void; error: (s: string) => void }) {
  try {
    const escaped = kb
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");
    writeFileSync(
      OUT_FILE,
      `// AUTO-GENERATED — do not edit\nexport const KNOWLEDGE_BASE = \`${escaped}\`;\n`,
      "utf-8"
    );
    logger.info("chatbot-kb: knowledge base generated.");
  } catch (err: any) {
    logger.error(`chatbot-kb: failed to write knowledge base — ${err.message}`);
  }
}

export default function chatbotKbIntegration(): AstroIntegration {
  return {
    name: "chatbot-kb-generator",
    hooks: {
      // Dev: no dist folder exists, use frontmatter scanner as fallback
      "astro:server:start": ({ logger }) => {
        try {
          write(buildKnowledgeBase(), logger);
        } catch (err: any) {
          logger.error(`chatbot-kb: dev generation failed — ${err.message}`);
        }
      },

      // Build: runs after robots-llms has written llms-full.txt
      "astro:build:done": ({ dir, logger }) => {
        try {
          const distDir = fileURLToPath(dir);
          const llmsFullPath = join(distDir, "llms-full.txt");

          if (!existsSync(llmsFullPath)) {
            logger.warn("chatbot-kb: llms-full.txt not found, falling back to frontmatter scanner.");
            write(buildKnowledgeBase(), logger);
            return;
          }

          const llmsFull = readFileSync(llmsFullPath, "utf-8");
          const kb = RULES + llmsFull + FOOTER;
          write(kb, logger);
        } catch (err: any) {
          logger.error(`chatbot-kb: build generation failed — ${err.message}`);
        }
      },
    },
  };
}
