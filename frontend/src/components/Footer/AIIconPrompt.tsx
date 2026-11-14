import type { IconType } from "react-icons";
import {
  SiClaude,
  SiGooglegemini,
  SiOpenai,
  SiPerplexity,
} from "react-icons/si";

// react-icons@5.5.0 has no Grok/xAI mark, so we ship the logo as an inline SVG.
// Matches the IconType call signature (accepts className) so it drops into the
// same AI_PLATFORMS list as the react-icons entries.
const SiGrok: IconType = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.284m-1.104 4.716c-2.646-2.522-2.202-6.462.096-8.763 1.701-1.703 4.611-2.399 7.13-1.383l2.703-1.253c-.473-.361-1.065-.7-1.749-.968-3.062-1.242-6.591-.588-9.019 1.842-2.34 2.343-3.066 5.538-2.386 8.418.677 2.881-.242 5.925-2.75 9.384L9.6 24.001c.06-.082.12-.164.18-.248l-1.62-3.753z" />
  </svg>
);

interface AIPlatform {
  name: string;
  hrefBase: string;
  Icon: IconType;
}

interface AIIconPromptProps {
  prompt: string;
  className?: string;
  label?: string;
  labelClassName?: string;
  listClassName?: string;
  promptSubject?: string;
}

const AI_PLATFORMS: AIPlatform[] = [
  {
    name: "ChatGPT",
    hrefBase: "https://chatgpt.com/?q=",
    Icon: SiOpenai,
  },
  {
    name: "Claude",
    hrefBase: "https://claude.ai/new?q=",
    Icon: SiClaude,
  },
  {
    name: "Gemini",
    hrefBase: "https://gemini.google.com/app?q=",
    Icon: SiGooglegemini,
  },
  {
    name: "Perplexity",
    hrefBase: "https://www.perplexity.ai/search?q=",
    Icon: SiPerplexity,
  },
  {
    name: "Grok",
    hrefBase: "https://grok.com/?q=",
    Icon: SiGrok,
  },
];

export default function AIIconPrompt({
  prompt,
  className = "",
  label = "Ask AI about Us:",
  labelClassName = "",
  listClassName = "",
  promptSubject = "Webmaxxers",
}: AIIconPromptProps) {
  const encodedPrompt = encodeURIComponent(prompt.trim());

  return (
    <div
      className={[
        "flex w-full flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:justify-end lg:gap-5 lg:text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p
        className={[
          "text-sm font-light tracking-[0.02em] text-muted md:text-[0.95rem] lg:shrink-0",
          labelClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </p>

      <ul
        className={[
          "flex flex-wrap items-center justify-center gap-3.5 text-text lg:justify-end",
          listClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {AI_PLATFORMS.map(({ name, hrefBase, Icon }) => (
          <li key={name} className="relative">
            <a
              href={`${hrefBase}${encodedPrompt}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${name} with a prompt about ${promptSubject}`}
              className="group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-all duration-200 hover:border-border-soft hover:bg-bg3 hover:text-heading focus-visible:border-border-soft focus-visible:bg-bg3 focus-visible:text-heading md:h-11 md:w-11"
            >
              <span className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-1/2 z-[2] -translate-x-1/2 rounded-lg border border-white/10 bg-bg3 px-3 py-1.5 text-xs font-medium text-heading opacity-0 shadow-2xl transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {name}
              </span>
              <Icon className="h-[1.05rem] w-[1.05rem] text-current md:h-[1.15rem] md:w-[1.15rem]" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
