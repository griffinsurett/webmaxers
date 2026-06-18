import type { IconType } from "react-icons";
import {
  SiClaude,
  SiGooglegemini,
  SiOpenai,
  SiPerplexity,
} from "react-icons/si";

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
];

export default function AIIconPrompt({
  prompt,
  className = "",
  label = "Ask AI about Us:",
  labelClassName = "",
  listClassName = "",
  promptSubject = "webmaxers",
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
          "flex flex-wrap items-center justify-center gap-3.5 text-text/75 lg:justify-end",
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
