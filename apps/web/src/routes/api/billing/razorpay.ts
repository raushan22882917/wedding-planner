import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { getUsagePack, type SubscriptionPlan, type UsagePackId } from "@/lib/subscription";

type RazorpaySubscriptionEntity = {
  id?: string;
  current_end?: number | null;
  notes?: { marrymap_user_id?: string; marrymap_plan?: SubscriptionPlan };
};

type RazorpayPaymentLinkEntity = {
  id?: string;
  amount?: number;
  amount_paid?: number;
  status?: string;
  notes?: {
    marrymap_checkout_id?: string;
  };
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: RazorpaySubscriptionEntity };
    payment_link?: { entity?: RazorpayPaymentLinkEntity };
  };
};

function verifiedWebhook(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function subscriptionState(event: string) {
  if (event === "subscription.activated" || event === "subscription.charged") return "active";
  if (event === "subscription.pending" || event === "subscription.authenticated") return "pending";
  if (event === "subscription.halted") return "past_due";
  if (event === "subscription.cancelled" || event === "subscription.completed") return "cancelled";
  return null;
}

export const Route = createFileRoute("/api/billing/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const cleanEnvVar = (val: string | undefined) => val ? val.replace(/^["']|["']$/g, "") : val;
        const supabaseUrl = cleanEnvVar(process.env.SUPABASE_URL);
        const serviceRoleKey = cleanEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY);
        if (!secret || !supabaseUrl || !serviceRoleKey) {
          return new Response("Billing webhook is not configured.", { status: 503 });
        }

        const rawBody = await request.text();
        if (!verifiedWebhook(rawBody, request.headers.get("x-razorpay-signature"), secret)) {
          return new Response("Invalid webhook signature.", { status: 401 });
        }

        let payload: RazorpayWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as typeof payload;
        } catch {
          return new Response("Invalid webhook payload.", { status: 400 });
        }
        if (payload.event === "payment_link.paid") {
          const paymentLink = payload.payload?.payment_link?.entity;
          const checkoutId = paymentLink?.notes?.marrymap_checkout_id;
          if (
            !paymentLink?.id ||
            !checkoutId ||
            paymentLink.status !== "paid" ||
            !Number.isInteger(paymentLink.amount_paid)
          ) {
            return new Response(null, { status: 204 });
          }

          const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: checkout, error: checkoutError } = await supabase
            .from("billing_checkouts")
            .select(
              "id, user_id, kind, subscription_plan, usage_pack_id, wedding_count, coverage_ends_at, expected_amount_paise, status",
            )
            .eq("id", checkoutId)
            .eq("provider_payment_link_id", paymentLink.id)
            .maybeSingle();
          if (checkoutError) return new Response("Could not verify checkout.", { status: 500 });
          if (!checkout || checkout.status === "paid") return new Response(null, { status: 204 });
          if (
            checkout.status !== "created" ||
            paymentLink.amount_paid !== checkout.expected_amount_paise
          ) {
            return new Response("Payment amount does not match the checkout.", { status: 400 });
          }

          if (checkout.kind === "usage_pack") {
            const packDetails = checkout.usage_pack_id
              ? getUsagePack(checkout.usage_pack_id as UsagePackId)
              : undefined;
            if (!packDetails) return new Response("Unknown usage pack.", { status: 400 });
            const { error } = await supabase.from("subscription_usage_credits").upsert(
              {
                user_id: checkout.user_id,
                feature: packDetails.feature,
                units: packDetails.units,
                source_ref: `razorpay_checkout:${checkout.id}`,
              },
              { onConflict: "source_ref", ignoreDuplicates: true },
            );
            if (error) return new Response("Could not grant usage pack.", { status: 500 });
          } else {
            const coveragePlan = checkout.subscription_plan;
            const weddingCount = checkout.wedding_count;
            const coverageEndsAt = checkout.coverage_ends_at;
            if (coveragePlan !== "essential" && coveragePlan !== "signature") {
              return new Response("Invalid coverage checkout.", { status: 400 });
            }
            if (
              weddingCount === null ||
              !Number.isInteger(weddingCount) ||
              weddingCount < 1 ||
              weddingCount > 10 ||
              !coverageEndsAt ||
              !/^\d{4}-\d{2}-\d{2}$/.test(coverageEndsAt)
            ) {
              return new Response("Invalid coverage checkout.", { status: 400 });
            }

            const { error } = await supabase
              .from("profiles")
              .update({
                subscription_plan: coveragePlan,
                subscription_status: "active",
                billing_provider: "razorpay",
                billing_provider_subscription_id: `payment_link:${paymentLink.id}`,
                subscription_renews_at: null,
                subscription_wedding_count: weddingCount,
                subscription_coverage_ends_at: coverageEndsAt,
              })
              .eq("id", checkout.user_id);
            if (error)
              return new Response("Could not activate planning coverage.", { status: 500 });
          }

          const { error } = await supabase
            .from("billing_checkouts")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", checkout.id)
            .eq("status", "created");
          if (error) return new Response("Could not finalize checkout.", { status: 500 });
          return new Response(null, { status: 204 });
        }

        const status = subscriptionState(payload.event ?? "");
        const subscription = payload.payload?.subscription?.entity;
        const userId = subscription?.notes?.marrymap_user_id;
        const plan = subscription?.notes?.marrymap_plan;
        if (
          !status ||
          !subscription?.id ||
          !userId ||
          (plan !== "essential" && plan !== "signature")
        ) {
          // Razorpay retries non-2xx webhooks. Ignoring unrelated, verified events is intentional.
          return new Response(null, { status: 204 });
        }

        const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const renewsAt = subscription.current_end
          ? new Date(subscription.current_end * 1000).toISOString()
          : null;
        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_plan: plan,
            subscription_status: status,
            billing_provider: "razorpay",
            billing_provider_subscription_id: subscription.id,
            subscription_renews_at: renewsAt,
            subscription_coverage_ends_at: null,
          })
          .eq("id", userId);
        if (error) return new Response("Could not store subscription status.", { status: 500 });
        return new Response(null, { status: 204 });
      },
    },
  },
});
