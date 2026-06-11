import type { Store, Subscription, User } from "@/types";

/**
 * Demo tenant "Northbound" (cannabis/CBD), seeded from the prototype `data.jsx`.
 * `MOCK_STORE_ID` is the storeId every stub data-access fn is called with in Part A.
 */
export const MOCK_STORE_ID = "store_northbound";
export const MOCK_OWNER_ID = "user_northbound";

const NOW = "2026-06-08T00:00:00.000Z";
const CREATED = "2026-03-02T00:00:00.000Z";

export const mockStore: Store = {
  _id: MOCK_STORE_ID,
  ownerId: MOCK_OWNER_ID,
  name: "Northbound",
  subdomain: "northbound",
  status: "live",
  ageGate: {
    enabled: true,
    minAge: 21,
    message:
      "You must be 21 or older to enter this store. Please verify your age to continue.",
  },
  settings: {
    currency: "$",
    contactEmail: "hello@northbound.co",
    socialLinks: [
      { label: "Instagram", url: "https://instagram.com/northbound" },
      { label: "Twitter", url: "https://twitter.com/northbound" },
    ],
    logoUrl: undefined,
  },
  seoDefaults: {
    title: "Northbound — Small-batch flower & wellness",
    description:
      "Small-batch flower, solventless extracts, and considered wellness, sourced and delivered with care across Oregon.",
    ogImage: undefined,
  },
  codeInjection: {
    headHtml: "",
    bodyHtml: "",
    customCss: "",
    customJs: "",
  },
  publishedAt: CREATED,
  createdAt: CREATED,
  updatedAt: NOW,
};

export const mockUser: User = {
  _id: MOCK_OWNER_ID,
  email: "hello@northbound.co",
  name: "Sam Rivera",
  googleId: "google-oauth2|northbound-owner",
  activeStoreId: MOCK_STORE_ID,
  primaryStoreId: MOCK_STORE_ID,
  role: "merchant",
  createdAt: CREATED,
  updatedAt: NOW,
};

export const mockSubscription: Subscription = {
  _id: "sub_northbound",
  ownerId: MOCK_OWNER_ID,
  storeId: MOCK_STORE_ID,
  plan: "standard",
  status: "active",
  billingSeam: {},
  createdAt: CREATED,
  updatedAt: NOW,
};
