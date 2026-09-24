export type ConsentCategory =
  | "essential"
  | "functional"
  | "analytics"
  | "marketing";

export interface ConsentCategoryInfo {
  id: ConsentCategory;
  title: string;
  description: string;
  required?: boolean;
}

export const CONSENT_CATEGORIES: ConsentCategoryInfo[] = [
  {
    id: "essential",
    title: "Strictly Necessary",
    description:
      "Essential for security, network management, accessibility, and the core operation of this website.",
    required: true,
  },
  {
    id: "functional",
    title: "Functionality",
    description:
      "Remembers choices such as your language, theme, and accessibility preferences.",
  },
  {
    id: "analytics",
    title: "Analytics",
    description:
      "Lets us count visits and traffic sources so we can measure and improve the website.",
  },
  {
    id: "marketing",
    title: "Advertising",
    description:
      "Allows advertising partners to measure campaigns and provide more relevant advertising.",
  },
];

export const zestConfig = {
  mode: "safe",
  respectDNT: true,
  dntBehavior: "reject",
  consentModeGoogle: true,
  // Shared GA4/Ads library is loaded explicitly by GoogleTags only after
  // analytics OR marketing consent. Zest otherwise classifies this host
  // as analytics-only, preventing advertising-only consent from working.
  allowedDomains: ["www.googletagmanager.com"],
  expiration: 365,
  geo: {
    endpoint: "/api/geo",
    timeout: 1000,
    fallback: "consent",
  },
  patterns: {
    functional: [
      "^user-language$",
      "^googtrans$",
      "^lang",
      "^locale",
      "^theme",
      "^preferences",
      "^ui_",
    ],
  },
} as const;
