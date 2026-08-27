// src/integrations/preferences/ui/consent/components/CookiePreferencesModal.tsx
/**
 * Cookie Preferences Modal (Default UI)
 *
 * Detailed consent preferences with granular category controls.
 * Allows users to enable/disable specific cookie categories.
 *
 * After preferences are saved, enables scripts via scriptManager.
 */

import { useState, useMemo, useTransition, useRef, useEffect, memo } from "react";
import Modal from "@/components/Modal";
import { enableConsentedScripts } from "@/integrations/preferences/consent/core/scripts/scriptManager";
import {
  AD_TYPES,
  ALWAYS_GRANTED,
  CONSENT_VERSION,
  defaultConsent,
  type ConsentType,
  type CookieConsent,
  type CookieCategoryInfo,
} from "@/integrations/preferences/consent/core/types";
import {
  getConsent,
  saveConsent,
} from "@/integrations/preferences/consent/core/utils/consent";
import Button from "@/components/Button/Button";
import ToggleControl from "@/integrations/preferences/shared/ui/ToggleControl";
import Accordion from "@/components/LoopTemplates/Accordion";
import Icon from "@/components/Icon";

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One row per user-facing choice. Ids are Google Consent Mode v2 types, so a
 * toggle maps straight onto the gtag payload.
 *
 * The three ad_* types share the "Advertising" row (see AD_TYPES) — Google keeps
 * them separate, but asking a visitor to distinguish ad_user_data from
 * ad_personalization is not a meaningful choice.
 */
const cookieCategories: CookieCategoryInfo[] = [
  {
    id: "security_storage",
    title: "Strictly Necessary",
    description:
      "Essential for the website to function properly. They enable core functionality such as security, network management, and accessibility, and cannot be switched off.",
    required: true,
  },
  {
    id: "functionality_storage",
    title: "Functionality",
    description:
      "Remember choices you make — such as your language, theme, and accessibility settings — so the site behaves the way you left it.",
  },
  {
    id: "analytics_storage",
    title: "Analytics",
    description:
      "Let us count visits and traffic sources so we can measure and improve the performance of our site. Everything is aggregated, so it stays anonymous.",
  },
  {
    id: "ad_storage",
    title: "Advertising",
    description:
      "Used by us and our advertising partners to measure ad performance, build a profile of your interests, and show you more relevant adverts.",
  },
];

function CookiePreferencesModal({
  isOpen,
  onClose,
}: CookiePreferencesModalProps) {
  const [isPending, startTransition] = useTransition();

  // Read the stored choice once. getConsent() returns null when nothing is
  // stored or the cookie predates the current shape, in which case we start
  // from "essentials only".
  const initialPreferences = useMemo<CookieConsent>(
    () => getConsent() ?? defaultConsent(),
    [],
  );

  const [preferences, setPreferences] = useState<CookieConsent>(initialPreferences);
  const [canScroll, setCanScroll] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check if scroll container has overflow
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const hasOverflow = container.scrollHeight > container.clientHeight;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
      setCanScroll(hasOverflow && !isAtBottom);
    };

    checkScroll();
    container.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [isOpen]);

  const accordionItems = cookieCategories.map((category, idx) => ({
    id: category.id,
    title: category.title,
    description: category.description,
    contentSlotId: `cookie-category-${idx}-content`,
  }));

  const handleToggle = (categoryId: ConsentType, nextValue?: boolean) => {
    if (ALWAYS_GRANTED.includes(categoryId)) return;

    setPreferences((prev) => {
      const value =
        typeof nextValue === "boolean" ? nextValue : !prev[categoryId];

      // The Advertising row stands in for all three ad_* types.
      if (AD_TYPES.includes(categoryId)) {
        const adState = Object.fromEntries(
          AD_TYPES.map((type) => [type, value]),
        );
        return { ...prev, ...adState };
      }

      return { ...prev, [categoryId]: value };
    });
  };

  const handleRejectAll = () => {
    saveConsent(defaultConsent());
    enableConsentedScripts();

    startTransition(() => {
      onClose();
    });
  };

  const handleConfirm = () => {
    saveConsent({
      ...preferences,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    });
    enableConsentedScripts();

    startTransition(() => {
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      className="bg-bg rounded-2xl p-8 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col shadow-2xl"
      // z-[100001] stacks the overlay ABOVE the site header (z-[100000]); the
      // Modal's default z-[99999] would otherwise sit under the header.
      overlayClass="bg-primary-dark/60 z-[100001]"
      ariaLabel="Manage cookie consent preferences"
      ssr={false}
    >
      <div className="mb-6 shrink-0">
        <h2 className="text-3xl text-heading mb-4">
          Manage Consent Preferences
        </h2>
        <p className="text-text text-xs lg:text-sm leading-relaxed mb-3">
          We use cookies and similar technologies to help personalize content
          and offer a better experience. You can click{" "}
          <Button
            variant="link"
            href="/cookie-policy"
          >
            here
          </Button>{" "}
          to find out more and change our default settings. However, blocking
          some types of cookies may impact your experience of the site and the
          services we are able to offer.
        </p>
        <Button
          variant="link"
          href="/cookie-policy"
        >
          More information
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Button>
      </div>

      {/* Scrollable accordion container */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto max-h-[40vh] pr-2"
        >
          <Accordion
            allowMultiple
            className="space-y-3"
            items={accordionItems}
            showIndicator={false}
            headerSlot={({ item, id, expanded }) => {
              const category = cookieCategories.find((c) => c.id === item.id);
              if (!category) return null;
              const toggleId = `${id}-toggle`;
              return (
                <div className="flex items-center gap-3 w-full">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 text-lg font-semibold ${
                      expanded ? "bg-primary text-bg" : "bg-primary/20 text-accent"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon
                      icon={expanded ? "lucide:minus" : "lucide:plus"}
                      size="sm"
                      className="w-4 h-4"
                    />
                  </div>
                  <span className="font-semibold text-heading text-base flex-1">
                    {category.title}
                  </span>
                  <div className="shrink-0 flex items-center gap-3">
                    {category.required && (
                      <span className="text-sm font-semibold text-primary">
                        Always Active
                      </span>
                    )}
                    <ToggleControl
                      label={category.title}
                      description={category.description}
                      checked={preferences[category.id]}
                      onChange={(checked) =>
                        handleToggle(category.id, checked)
                      }
                      disabled={category.required}
                      id={toggleId}
                      bordered={false}
                      className="py-0"
                      hideText={true}
                      size="lg"
                    />
                  </div>
                </div>
              );
            }}
          />

          {accordionItems.map((item, idx) => (
            <div
              key={item.id}
              id={`cookie-category-${idx}-content`}
              style={{ display: "none" }}
            >
              <p className="text-sm text-text leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 shrink-0">
        <Button
          variant="secondary"
          onClick={handleRejectAll}
          className="flex-1"
          type="button"
          disabled={isPending}
        >
          Reject All
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          className="flex-1"
          animated={false}
          type="button"
          disabled={isPending}
        >
          Confirm My Choices
        </Button>
      </div>
    </Modal>
  );
}

export default memo(CookiePreferencesModal);
