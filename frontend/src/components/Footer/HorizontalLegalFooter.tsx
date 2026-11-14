import Button from "@/components/Button/Button";
import SocialIcon from "@/components/LoopComponents/SocialIcon";
import { siteData } from "@/content/siteData";
import type { IconType } from "@/content/schema";
import CookiePreferencesButton from "@/integrations/preferences/consent/ui/CookiePreferencesButton";
import {
  FOOTER_MENU_ITEM_CLASS,
  FOOTER_MENU_NAV_BASE,
  FOOTER_MENU_NAV_HORIZONTAL,
} from "@/components/ContentRenderer/variants/utils/footerMenuClasses";
import type { MouseEventHandler } from "react";

interface LegalItem {
  id: string;
  title: string;
  url?: string;
  /** Action rows render as a control instead of a link (e.g. cookie prefs). */
  action?: string;
}

interface HorizontalLegalFooterProps {
  className?: string;
  showBorder?: boolean;
  onLinkClick?: MouseEventHandler<HTMLAnchorElement>;
  /** Legal links + "Your Privacy Choices" action, queried upstream (MenuVariant). */
  legalItems?: LegalItem[];
  socialLinks?: Array<{
    title: string;
    url?: string;
    icon?: IconType;
  }>;
}

export default function HorizontalLegalFooter({
  className = "",
  showBorder = true,
  onLinkClick,
  legalItems = [],
  socialLinks = [],
}: HorizontalLegalFooterProps) {
  const wrapperClasses = ["w-full", className].filter(Boolean).join(" ");
  // Same "hover one, mute the rest" behaviour as the main footer (FooterMenuVariant),
  // via the shared class module — laid out horizontally here.
  const itemClass = `${FOOTER_MENU_ITEM_CLASS} whitespace-nowrap text-[0.76rem] sm:text-[0.95rem]`;
  const hasSocialLinks = socialLinks.length > 0;

  return (
    <div className={wrapperClasses}>
      <div
        className={[
          "flex w-full flex-col gap-4 py-5 text-text lg:gap-5",
          showBorder || hasSocialLinks ? "border-t border-border-soft" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {hasSocialLinks && (
          <div className="flex justify-center">
            <ul className="flex flex-wrap justify-center gap-3.5 list-none sm:gap-4">
              {socialLinks.map((entry) => (
                <li key={`${entry.title}-${entry.url ?? "social"}`}>
                  <SocialIcon
                    title={entry.title}
                    url={entry.url}
                    icon={entry.icon}
                    size="md"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {legalItems.length > 0 && (
          <div className="overflow-x-auto max-w-full">
            {/* group/menu marker → each row mutes when a sibling is hovered. */}
            <nav
              className={`${FOOTER_MENU_NAV_BASE} ${FOOTER_MENU_NAV_HORIZONTAL} mx-auto min-w-max w-fit justify-center px-2 sm:px-0`}
              aria-label="Legal links"
            >
              {legalItems.map((item) =>
                item.action === "cookie-preferences" ? (
                  <CookiePreferencesButton key={item.id} className={itemClass} />
                ) : (
                  <Button
                    key={item.id}
                    variant="link"
                    href={item.url}
                    size="sm"
                    className={itemClass}
                    onClick={onLinkClick}
                  >
                    {item.title}
                  </Button>
                ),
              )}
            </nav>
          </div>
        )}

        <p className="text-center text-xs leading-relaxed sm:text-sm">
          &copy; {new Date().getFullYear()} {siteData.legalName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
