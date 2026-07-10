export const LEAD_FORM_FIELDS = [
  "companyName",
  "contactPerson",
  "mobileNumber",
  "email",
  "designation",
  "city",
  "state",
  "country",
  "website",
  "gstNumber",
  "industry",
  "annualTurnover",
  "productsInterested",
  "budget",
  "remarks",
] as const;

export const DEFAULT_VISITOR_TYPES = [
  { name: "End User", slug: "end-user", color: "#3B82F6" },
  { name: "Dealer", slug: "dealer", color: "#10B981" },
  { name: "Distributor", slug: "distributor", color: "#8B5CF6" },
  { name: "Competitor", slug: "competitor", color: "#EF4444" },
  { name: "OEM", slug: "oem", color: "#F59E0B" },
  { name: "Vendor", slug: "vendor", color: "#6366F1" },
  { name: "Consultant", slug: "consultant", color: "#EC4899" },
  { name: "Architect", slug: "architect", color: "#14B8A6" },
  { name: "Builder", slug: "builder", color: "#F97316" },
] as const;

export const SYNC_MAX_ATTEMPTS = 5;

export const RETRY_DELAYS_MS = [
  60_000,        // 1 minute
  300_000,       // 5 minutes
  1_800_000,     // 30 minutes
  7_200_000,     // 2 hours
  43_200_000,    // 12 hours
] as const;

export const MAX_FILE_SIZE_MB = 5;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
