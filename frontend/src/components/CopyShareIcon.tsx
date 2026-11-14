import { useEffect, useState } from "react";
import SocialIcon from "@/components/LoopComponents/SocialIcon";

interface CopyShareIconProps {
  url: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  copiedTitle?: string;
  tooltipText?: string;
}

export default function CopyShareIcon({
  url,
  size = "lg",
  title = "Copy link",
  copiedTitle = "Link copied",
  tooltipText = "Copied!",
}: CopyShareIconProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="relative inline-flex">
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border-soft bg-bg3 px-3 py-2 text-sm font-normal text-heading shadow-lg shadow-black/20 transition-all duration-200 ${
          copied ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {tooltipText}
        <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-border-soft bg-bg3"></span>
      </span>

      <SocialIcon
        title={copied ? copiedTitle : title}
        icon={copied ? "lu:check" : "fa6:link"}
        size={size}
        onClick={handleCopy}
        ariaLabel={copied ? copiedTitle : title}
      />
    </div>
  );
}
