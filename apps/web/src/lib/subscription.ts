export type SubscriptionPlan = "free" | "essential" | "signature";
export type SubscriptionFeature = "ai_planner" | "vendor_research" | "whatsapp_send" | "voice_call";

export type SubscriptionUsage = {
  feature: SubscriptionFeature;
  used: number;
  limit: number;
  estimatedCostPaise: number;
};

export type SubscriptionSnapshot = {
  plan: SubscriptionPlan;
  status: "active" | "pending" | "past_due" | "cancelled" | "expired";
  isTrial: boolean;
  renewsAt: string | null;
  weddingCount: number;
  coverageEndsAt: string | null;
  usage: SubscriptionUsage[];
};

export type WeddingCoverageQuote = {
  weddingCount: number;
  daysToWedding: number;
  coverageDays: number;
  includedDaysPerWedding: number;
  additionalDaysPerWedding: number;
  additionalDaysTotal: number;
  minimumCostInr: number;
  additionalDaysCostInr: number;
  startsAt: string;
  endsAt: string;
  totalInr: number;
};

export const WEDDING_COVERAGE_PRICING = {
  includedDaysPerWedding: 30,
  minimumMonthlyInr: 1499,
  additionalDayInr: 50,
} as const;

export const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  ai_planner: "AI planner replies",
  vendor_research: "Source-backed vendor searches",
  whatsapp_send: "WhatsApp sends through MarryMap",
  voice_call: "Vendor availability calls",
};

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  {
    name: string;
    summary: string;
    limits: Record<SubscriptionFeature, number>;
    features: string[];
    featured?: boolean;
  }
> = {
  free: {
    name: "Explore",
    summary: "A focused way to see if MarryMap fits your wedding.",
    limits: { ai_planner: 8, vendor_research: 3, whatsapp_send: 0, voice_call: 0 },
    features: [
      "One wedding workspace",
      "8 AI planner replies each month",
      "3 source-backed vendor searches",
      "Budget, guests, timeline & website tools",
    ],
  },
  essential: {
    name: "Essential",
    summary: "For couples actively planning, researching, and reaching out to vendors.",
    limits: { ai_planner: 120, vendor_research: 20, whatsapp_send: 60, voice_call: 0 },
    features: [
      "120 AI planner replies each month",
      "20 source-backed vendor searches",
      "60 WhatsApp sends through MarryMap",
      "Full planning workspace and vendor comparison",
    ],
    featured: true,
  },
  signature: {
    name: "Signature",
    summary: "For multi-event weddings with hands-on vendor coordination.",
    limits: { ai_planner: 400, vendor_research: 75, whatsapp_send: 250, voice_call: 10 },
    features: [
      "400 AI planner replies each month",
      "75 source-backed vendor searches",
      "250 WhatsApp sends through MarryMap",
      "10 consented vendor availability calls",
    ],
  },
};

export const PAID_ADD_ONS = [
  {
    id: "ai_reply_pack",
    name: "AI reply pack",
    priceInr: 199,
    includes: "25 additional AI planner replies",
    feature: "ai_planner",
    units: 25,
  },
  {
    id: "vendor_research_pack",
    name: "Vendor research pack",
    priceInr: 149,
    includes: "10 additional source-backed searches",
    feature: "vendor_research",
    units: 10,
  },
  {
    id: "availability_call",
    name: "Availability call",
    priceInr: 49,
    includes: "One consented vendor call credit",
    feature: "voice_call",
    units: 1,
  },
] as const;

export type UsagePackId = (typeof PAID_ADD_ONS)[number]["id"];

export function getUsagePack(id: UsagePackId) {
  return PAID_ADD_ONS.find((pack) => pack.id === id);
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function isPaidPlan(plan: SubscriptionPlan) {
  return plan === "essential" || plan === "signature";
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * A coverage pass lasts from today through the wedding day, inclusive. Keeping
 * this calculation in one shared module makes the checkout amount and the UI
 * quote agree exactly.
 */
export function getWeddingCoverageQuote({
  weddingCount,
  weddingDate,
  now = new Date(),
}: {
  weddingCount: number;
  weddingDate: string | null | undefined;
  now?: Date;
}): WeddingCoverageQuote | null {
  if (!weddingDate || !/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) return null;
  const count = Math.min(10, Math.max(1, Math.round(weddingCount)));
  const wedding = new Date(`${weddingDate}T12:00:00`);
  if (Number.isNaN(wedding.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const daysToWedding = Math.round((wedding.getTime() - today.getTime()) / 86_400_000);
  if (daysToWedding < 0) return null;

  const coverageDays = daysToWedding + 1;
  const additionalDaysPerWedding = Math.max(
    0,
    coverageDays - WEDDING_COVERAGE_PRICING.includedDaysPerWedding,
  );
  const additionalDaysTotal = additionalDaysPerWedding * count;
  const minimumCostInr = WEDDING_COVERAGE_PRICING.minimumMonthlyInr * count;
  const additionalDaysCostInr = additionalDaysTotal * WEDDING_COVERAGE_PRICING.additionalDayInr;
  const totalInr = minimumCostInr + additionalDaysCostInr;
  return {
    weddingCount: count,
    daysToWedding,
    coverageDays,
    includedDaysPerWedding: WEDDING_COVERAGE_PRICING.includedDaysPerWedding,
    additionalDaysPerWedding,
    additionalDaysTotal,
    minimumCostInr,
    additionalDaysCostInr,
    startsAt: formatDateKey(today),
    endsAt: weddingDate,
    totalInr,
  };
}
