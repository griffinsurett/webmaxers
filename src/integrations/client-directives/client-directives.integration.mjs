import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const customClientDirectives = [
  {
    name: "click",
    entrypoint: resolve(__dirname, "click.ts"),
  },
  {
    name: "scroll",
    entrypoint: resolve(__dirname, "scroll.ts"),
  },
  {
    name: "hover",
    entrypoint: resolve(__dirname, "hover.ts"),
  },
  {
    name: "firstInteraction",
    entrypoint: resolve(__dirname, "firstInteraction.ts"),
  },
];

export default function clientDirectivesIntegration() {
  return {
    name: "webmaxers-client-directives",
    hooks: {
      "astro:config:setup"({ addClientDirective }) {
        for (const directive of customClientDirectives) {
          addClientDirective(directive);
        }
      },
    },
  };
}
