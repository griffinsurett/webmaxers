import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import TextLogo from "@/components/Logo/TextLogo";
import { siteData } from "@/content/siteData";
import LogoPoster from "@/assets/GWS-animated.png";

interface LinkPageShareButtonProps {
  shareUrl?: string;
  shareTitle?: string;
}

interface ShareTarget {
  label: string;
  icon: string;
  href: string;
}

function ShareSheetLogo() {
  return (
    <div className="notranslate flex items-center justify-center gap-1.5">
      <img
        src={LogoPoster.src}
        alt=""
        className="block w-[43px] h-[43px] lg:w-[45px] lg:h-[45px] object-contain animate-spin-once"
        aria-hidden="true"
      />

      <div>
        <TextLogo
          title={siteData.title}
          className="flex flex-col p-0 m-0"
          fadeDuration={1200}
          animateOutText={false}
        />
      </div>
    </div>
  );
}

export default function LinkPageShareButton({
  shareUrl = `${siteData.url}/links`,
  shareTitle = `${siteData.title} Links`,
}: LinkPageShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(shareUrl);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.href) {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const shareTargets = useMemo<ShareTarget[]>(() => {
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    const shareText = encodeURIComponent(shareTitle);
    const emailBody = encodeURIComponent(`${shareTitle}\n\n${currentUrl}`);
    const smsBody = encodeURIComponent(`${shareTitle}\n${currentUrl}`);

    return [
      {
        label: "Facebook",
        icon: "si:facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
      {
        label: "LinkedIn",
        icon: "lu:linkedin",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      },
      {
        label: "Email",
        icon: "fa6:envelope",
        href: `mailto:?subject=${encodedTitle}&body=${emailBody}`,
      },
      {
        label: "Text",
        icon: "fa6:comment-dots",
        href: `sms:?&body=${smsBody}`,
      },
      {
        label: "Copy",
        icon: "fa6:link",
        href: currentUrl,
      },
    ];
  }, [currentUrl, shareTitle]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setIsOpen(false);
    } catch {
      window.prompt("Copy this link", currentUrl);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 w-12 items-center justify-center text-text transition-colors main-duration hover:text-heading"
        aria-label="Open share sheet"
      >
        <Icon icon="lu:share-2" size="lg" className="text-current" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="center"
        overlayClass="bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
        className="card-bg light:bg-white/96 dark:bg-primary-light/6 faded-border shadow-2xl backdrop-blur-xl w-full max-w-[36rem] rounded-t-[2rem] sm:rounded-[2rem] px-5 pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-9"
        closeButtonClass="absolute right-4 top-4 text-text transition-opacity hover:opacity-70"
        ariaLabel="Share links page"
        ssr={false}
      >
        <div className="flex flex-col items-center gap-6">
          <ShareSheetLogo />
          <h2 className="text-lg uppercase tracking-[0.22em] text-heading">
            Share
          </h2>

          <ul className="grid w-full grid-cols-3 gap-4 list-none sm:grid-cols-5">
            {shareTargets.map((target) => (
              <li key={target.label} className="flex">
                {target.label === "Copy" ? (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="group flex w-full flex-col items-center gap-2 text-text"
                    aria-label="Copy link"
                  >
                    <span className="faded-bg inline-flex h-12 w-12 items-center justify-center rounded-full transition-transform main-duration group-hover:-translate-y-1">
                      <Icon icon={target.icon} size="md" className="text-primary" />
                    </span>
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-text">
                      {target.label}
                    </span>
                  </button>
                ) : (
                  <a
                    href={target.href}
                    target={target.href.startsWith("http") ? "_blank" : undefined}
                    rel={target.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="group flex w-full flex-col items-center gap-2 text-text"
                    aria-label={`Share via ${target.label}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="faded-bg inline-flex h-12 w-12 items-center justify-center rounded-full transition-transform main-duration group-hover:-translate-y-1">
                      <Icon icon={target.icon} size="md" className="text-primary" />
                    </span>
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-text">
                      {target.label}
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
