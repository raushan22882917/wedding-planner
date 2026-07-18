import { AppError } from "../lib/errors.js";
import { supabase } from "./supabase.js";

export type MeteredFeature = "vendor_research" | "whatsapp_send" | "voice_call";

export async function consumeSubscriptionQuota(
  ownerId: string,
  feature: MeteredFeature,
  units = 1,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "consume_subscription_quota_for_user",
    {
      p_user_id: ownerId,
      p_feature: feature,
      p_units: units,
    },
  );
  if (error) throw new AppError(error.message, 500, "subscription_error");
  const result = Array.isArray(data) ? data[0] : null;
  if (!result)
    throw new AppError(
      "Could not confirm the plan allowance.",
      503,
      "subscription_error",
    );
  if (!result.allowed) {
    throw new AppError(
      `${
        feature === "voice_call"
          ? "Availability call"
          : feature === "vendor_research"
            ? "Vendor research"
            : "WhatsApp send"
      } allowance reached (${result.used_units}/${result.included_units}). Upgrade or add a usage pack to continue.`,
      402,
      "subscription_limit",
    );
  }
}
