import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  getWeddingCoverageQuote,
  getUsagePack,
  type SubscriptionPlan,
  type SubscriptionSnapshot,
  type UsagePackId,
} from "@/lib/subscription";

type RazorpayCheckoutPayload = {
  id: string;
  short_url: string | null;
};

const checkoutLifetimeMs = 24 * 60 * 60 * 1_000;

function razorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Checkout is not configured yet. Add the Razorpay billing environment variables first.",
    );
  }
  return { keyId, keySecret };
}

function billingStore() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Secure checkout is not configured yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createRazorpayPaymentLink({
  amountPaise,
  checkoutId,
  description,
  expiresAt,
  referenceId,
}: {
  amountPaise: number;
  checkoutId: string;
  description: string;
  expiresAt: Date;
  referenceId: string;
}) {
  const { keyId, keySecret } = razorpayCredentials();
  const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: referenceId,
      description,
      expire_by: Math.floor(expiresAt.getTime() / 1_000),
      reminder_enable: true,
      notes: { marrymap_checkout_id: checkoutId },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as RazorpayCheckoutPayload & {
    error?: { description?: string };
  };
  if (!response.ok || !payload.id || !payload.short_url) {
    throw new Error(
      payload.error?.description ?? "Could not start secure checkout. Please try again.",
    );
  }
  return { id: payload.id, shortUrl: payload.short_url };
}

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionSnapshot> => {
    const { error: trialError } = await context.supabase.rpc("activate_my_subscription_trial");
    if (trialError) throw new Error(trialError.message);

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select(
        "subscription_plan, subscription_status, subscription_renews_at, subscription_wedding_count, subscription_coverage_ends_at, billing_provider",
      )
      .eq("id", context.userId)
      .single();
    if (profileError) throw new Error(profileError.message);

    const { data: usage, error: usageError } = await context.supabase.rpc("get_subscription_usage");
    if (usageError) throw new Error(usageError.message);

    const coverageExpired =
      profile.subscription_coverage_ends_at &&
      new Date(`${profile.subscription_coverage_ends_at}T23:59:59`).getTime() < Date.now();

    return {
      plan: profile.subscription_plan,
      status: coverageExpired ? "expired" : profile.subscription_status,
      isTrial:
        profile.billing_provider === "trial" &&
        profile.subscription_status === "active" &&
        !coverageExpired,
      renewsAt: profile.subscription_renews_at,
      weddingCount: profile.subscription_wedding_count ?? 1,
      coverageEndsAt: profile.subscription_coverage_ends_at,
      usage: usage.map((row) => ({
        feature: row.feature,
        used: row.used_units,
        limit: row.included_units,
        estimatedCostPaise: row.estimated_cost_paise,
      })),
    };
  });

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { plan: Exclude<SubscriptionPlan, "free">; weddingCount: number }) => data)
  .handler(async ({ data, context }) => {
    if (data.plan !== "essential" && data.plan !== "signature") {
      throw new Error("Choose Essential or Signature coverage.");
    }
    const count = Math.round(data.weddingCount);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      throw new Error("Choose between 1 and 10 weddings for this coverage pass.");
    }
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("wedding_date")
      .eq("id", context.userId)
      .single();
    if (profileError) throw new Error(profileError.message);
    const quote = getWeddingCoverageQuote({
      weddingCount: count,
      weddingDate: profile.wedding_date,
    });
    if (!quote) {
      throw new Error("Add a future wedding date before purchasing planning coverage.");
    }
    const store = billingStore();
    const amountPaise = quote.totalInr * 100;
    const { data: activeCheckout, error: activeCheckoutError } = await store
      .from("billing_checkouts")
      .select("provider_short_url")
      .eq("user_id", context.userId)
      .eq("kind", "coverage")
      .eq("subscription_plan", data.plan)
      .eq("wedding_count", quote.weddingCount)
      .eq("coverage_ends_at", quote.endsAt)
      .eq("expected_amount_paise", amountPaise)
      .eq("status", "created")
      .gt("expires_at", new Date().toISOString())
      .not("provider_short_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeCheckoutError) throw new Error(activeCheckoutError.message);
    if (activeCheckout?.provider_short_url) {
      return { checkoutUrl: activeCheckout.provider_short_url, coverageEndsAt: quote.endsAt };
    }

    const checkoutId = randomUUID();
    const expiresAt = new Date(Date.now() + checkoutLifetimeMs);
    const { error: checkoutError } = await store.from("billing_checkouts").insert({
      id: checkoutId,
      user_id: context.userId,
      kind: "coverage",
      subscription_plan: data.plan,
      wedding_count: quote.weddingCount,
      coverage_ends_at: quote.endsAt,
      expected_amount_paise: amountPaise,
      expires_at: expiresAt.toISOString(),
    });
    if (checkoutError) throw new Error(checkoutError.message);

    try {
      const paymentLink = await createRazorpayPaymentLink({
        amountPaise,
        checkoutId,
        expiresAt,
        referenceId: `mmc-${checkoutId.slice(0, 8)}-${Date.now().toString(36)}`,
        description: `MarryMap ${data.plan} coverage · ${quote.weddingCount} wedding${quote.weddingCount === 1 ? "" : "s"} · ${quote.coverageDays} days`,
      });
      const { error: linkError } = await store
        .from("billing_checkouts")
        .update({
          provider_payment_link_id: paymentLink.id,
          provider_short_url: paymentLink.shortUrl,
        })
        .eq("id", checkoutId)
        .eq("status", "created");
      if (linkError) throw new Error(linkError.message);
      return { checkoutUrl: paymentLink.shortUrl, coverageEndsAt: quote.endsAt };
    } catch (error) {
      await store.from("billing_checkouts").update({ status: "failed" }).eq("id", checkoutId);
      throw error;
    }
  });

export const createUsagePackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { pack: UsagePackId }) => data)
  .handler(async ({ data, context }) => {
    const pack = getUsagePack(data.pack);
    if (!pack) throw new Error("This usage pack is unavailable.");
    const store = billingStore();
    const amountPaise = pack.priceInr * 100;
    const { data: activeCheckout, error: activeCheckoutError } = await store
      .from("billing_checkouts")
      .select("provider_short_url")
      .eq("user_id", context.userId)
      .eq("kind", "usage_pack")
      .eq("usage_pack_id", pack.id)
      .eq("expected_amount_paise", amountPaise)
      .eq("status", "created")
      .gt("expires_at", new Date().toISOString())
      .not("provider_short_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeCheckoutError) throw new Error(activeCheckoutError.message);
    if (activeCheckout?.provider_short_url)
      return { checkoutUrl: activeCheckout.provider_short_url };

    const checkoutId = randomUUID();
    const expiresAt = new Date(Date.now() + checkoutLifetimeMs);
    const { error: checkoutError } = await store.from("billing_checkouts").insert({
      id: checkoutId,
      user_id: context.userId,
      kind: "usage_pack",
      usage_pack_id: pack.id,
      expected_amount_paise: amountPaise,
      expires_at: expiresAt.toISOString(),
    });
    if (checkoutError) throw new Error(checkoutError.message);

    try {
      const paymentLink = await createRazorpayPaymentLink({
        amountPaise,
        checkoutId,
        expiresAt,
        referenceId: `mmp-${checkoutId.slice(0, 8)}-${Date.now().toString(36)}`,
        description: `MarryMap ${pack.name}`,
      });
      const { error: linkError } = await store
        .from("billing_checkouts")
        .update({
          provider_payment_link_id: paymentLink.id,
          provider_short_url: paymentLink.shortUrl,
        })
        .eq("id", checkoutId)
        .eq("status", "created");
      if (linkError) throw new Error(linkError.message);
      return { checkoutUrl: paymentLink.shortUrl };
    } catch (error) {
      await store.from("billing_checkouts").update({ status: "failed" }).eq("id", checkoutId);
      throw error;
    }
  });
