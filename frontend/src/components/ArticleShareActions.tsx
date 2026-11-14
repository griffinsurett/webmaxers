import { useEffect, useMemo, useState } from "react";
import CopyShareIcon from "@/components/CopyShareIcon";
import SocialIcon from "@/components/LoopComponents/SocialIcon";

interface ArticleShareActionsProps {
  shareUrl?: string;
  shareTitle?: string;
}

interface ShareTarget {
  label: string;
  icon: string;
  href?: string;
}

export default function ArticleShareActions({
  shareUrl = "",
  shareTitle = "",
}: ArticleShareActionsProps) {
  const [currentUrl, setCurrentUrl] = useState(shareUrl);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.href) {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const targets = useMemo<ShareTarget[]>(() => {
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedTitle = encodeURIComponent(shareTitle);

    return [
      {
        label: "Share on X",
        icon: "si:x",
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      },
      {
        label: "Share on LinkedIn",
        icon: "lu:linkedin",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      },
      {
        label: "Share on Facebook",
        icon: "si:facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
    ];
  }, [currentUrl, shareTitle]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-[0.35rem] text-[0.86rem] leading-none uppercase tracking-[0.12em] text-text">
        Share on:
      </span>
      {targets.map((target) => (
        <SocialIcon
          key={target.label}
          title={target.label}
          url={target.href}
          icon={target.icon}
          size="sm"
        />
      ))}
      <CopyShareIcon url={currentUrl} size="sm" />
    </div>
  );
}
