import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGeminiProvider } from "@/lib/ai-gateway.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { isWeddingTemplateId, type WeddingTemplateId } from "@/lib/wedding-templates";

export type WebsiteCeremony = {
  id: string;
  name: string;
  description: string;
  date: string;
  event_date?: string;
  time: string;
  venue: string;
  accepting_rsvps: boolean;
};

export type WeddingWebsitePayload = {
  slug: string;
  title: string;
  welcome_message: string;
  couple_story: string;
  hero_image_url: string | null;
  card_design: WeddingTemplateId;
  published: boolean;
  ceremonies: WebsiteCeremony[];
};

export type WeddingWebsiteCopyField = "title" | "welcome_message" | "couple_story";
export type WebsiteCustomRequestStatus = "new" | "in_review" | "in_progress" | "completed";

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Wedding website service is not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getMyWeddingWebsite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wedding_websites")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveWeddingWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: WeddingWebsitePayload) => data)
  .handler(async ({ data, context }) => {
    const slug = data.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!slug || slug.length < 3) {
      throw new Error("Choose a link with at least 3 letters or numbers.");
    }
    if (!isWeddingTemplateId(data.card_design)) {
      throw new Error("Choose a template from the invitation library.");
    }

    const payload = {
      ...data,
      ceremonies: data.ceremonies as unknown as Json,
      slug,
      user_id: context.userId,
    };
    const db = context.supabase;
    const { data: existing, error: findError } = await db
      .from("wedding_websites")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const result = existing
      ? await db
          .from("wedding_websites")
          .update(payload)
          .eq("id", existing.id)
          .eq("user_id", context.userId)
          .select("*")
          .single()
      : await db.from("wedding_websites").insert(payload).select("*").single();
    if (result.error) {
      if (result.error.code === "23505") {
        throw new Error("That invitation link is already in use. Try a more personal link.");
      }
      throw new Error(result.error.message);
    }
    return result.data;
  });

export const improveWeddingWebsiteCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      field: WeddingWebsiteCopyField;
      currentValue: string;
      instruction: string;
      templateName: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!data.instruction.trim()) {
      throw new Error("Tell the AI what you would like to change.");
    }
    const key = process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY;
    if (!key) throw new Error("AI writing is not configured yet.");

    const fieldLabels: Record<WeddingWebsiteCopyField, string> = {
      title: "invitation title",
      welcome_message: "welcome message",
      couple_story: "couple story",
    };
    const result = await generateText({
      model: createGeminiProvider(key)(process.env.GEMINI_MODEL ?? "gemini-3.5-flash"),
      system:
        "You are an expert wedding invitation copywriter. Return only the requested replacement text with no heading, quotation marks, Markdown, or explanation. Keep the wording warm, inclusive, and ready to publish.",
      prompt: `Template style: ${data.templateName}\nField to rewrite: ${fieldLabels[data.field]}\nCurrent text: ${data.currentValue}\nCouple's instruction: ${data.instruction}\n\nWrite a polished replacement.`,
    });
    const text = result.text.trim().replace(/^['"]|['"]$/g, "");
    if (!text) throw new Error("The AI did not return any copy. Please try again.");
    return { text };
  });

export const listWeddingRsvps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data: site, error: siteError } = await db
      .from("wedding_websites")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (siteError) throw new Error(siteError.message);
    if (!site) return [];
    const { data, error } = await db
      .from("wedding_rsvps")
      .select("*")
      .eq("website_id", site.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyWebsiteCustomRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("website_custom_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createWebsiteCustomRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestTitle: string;
      brief: string;
      contactPreference: "email" | "phone" | "whatsapp";
      contactValue: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const requestTitle = data.requestTitle.trim();
    const brief = data.brief.trim();
    const contactValue = data.contactValue.trim();
    if (requestTitle.length < 4 || requestTitle.length > 120) {
      throw new Error("Add a short request title between 4 and 120 characters.");
    }
    if (brief.length < 20 || brief.length > 2_000) {
      throw new Error("Tell the admin team a little more (20 to 2,000 characters).");
    }
    if (contactValue.length < 3 || contactValue.length > 200) {
      throw new Error("Add a valid contact detail so the admin team can reply.");
    }
    if (!["email", "phone", "whatsapp"].includes(data.contactPreference)) {
      throw new Error("Choose email, phone, or WhatsApp as your contact preference.");
    }

    const { data: website, error: websiteError } = await context.supabase
      .from("wedding_websites")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (websiteError) throw new Error(websiteError.message);

    const { data: request, error } = await context.supabase
      .from("website_custom_requests")
      .insert({
        user_id: context.userId,
        website_id: website?.id ?? null,
        request_title: requestTitle,
        brief,
        contact_preference: data.contactPreference,
        contact_value: contactValue,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return request;
  });

async function requireWebsiteRequestsAdmin(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access is required to manage custom website requests.");
}

export const listAdminWebsiteCustomRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireWebsiteRequestsAdmin(context);
    const { data, error } = await context.supabase
      .from("website_custom_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateWebsiteCustomRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; status: WebsiteCustomRequestStatus; adminNote?: string }) => data)
  .handler(async ({ data, context }) => {
    await requireWebsiteRequestsAdmin(context);
    if (!["new", "in_review", "in_progress", "completed"].includes(data.status)) {
      throw new Error("Choose a valid request status.");
    }
    const { data: request, error } = await context.supabase
      .from("website_custom_requests")
      .update({ status: data.status, admin_note: data.adminNote?.trim() || null })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return request;
  });

export const getPublicWeddingWebsite = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: site, error } = await publicClient()
      .from("wedding_websites")
      .select("*")
      .eq("slug", data.slug.toLowerCase())
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return site;
  });

export const submitWeddingRsvp = createServerFn({ method: "POST" })
  .validator(
    (data: {
      slug: string;
      name: string;
      email?: string;
      phone?: string;
      response: "yes" | "no" | "maybe";
      guest_count: number;
      message?: string;
      ceremonies: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    if (typeof data.slug !== "string" || !data.slug.trim()) {
      throw new Error("This invitation link is invalid.");
    }
    if (typeof data.name !== "string") {
      throw new Error("Please enter your name.");
    }
    const name = data.name.trim();
    const email = typeof data.email === "string" ? data.email.trim() || null : null;
    const phone = typeof data.phone === "string" ? data.phone.trim() || null : null;
    const message = typeof data.message === "string" ? data.message.trim() || null : null;
    const response = data.response;
    const guestCount = Number(data.guest_count);
    if (name.length < 2 || name.length > 120) {
      throw new Error("Please enter a name between 2 and 120 characters.");
    }
    if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200)) {
      throw new Error("Please enter a valid email address.");
    }
    if (phone && (phone.length < 5 || phone.length > 40)) {
      throw new Error("Please enter a valid phone number.");
    }
    if (!["yes", "no", "maybe"].includes(response)) {
      throw new Error("Please choose whether you can attend.");
    }
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
      throw new Error("Party size must be a whole number from 1 to 10.");
    }
    if (message && message.length > 1_000) {
      throw new Error("Your note must be 1,000 characters or fewer.");
    }

    const db = publicClient();
    const { data: site, error: siteError } = await db
      .from("wedding_websites")
      .select("id, ceremonies")
      .eq("slug", data.slug.toLowerCase())
      .eq("published", true)
      .maybeSingle();
    if (siteError) throw new Error(siteError.message);
    if (!site) throw new Error("This invitation is no longer available.");

    const validCeremonyIds = new Set(
      Array.isArray(site.ceremonies)
        ? site.ceremonies
            .map((ceremony) =>
              ceremony && typeof ceremony === "object" && "id" in ceremony
                ? (ceremony as { id?: unknown }).id
                : undefined,
            )
            .filter((id): id is string => typeof id === "string")
        : [],
    );
    const requestedCeremonyIds = Array.isArray(data.ceremonies) ? data.ceremonies : [];
    const ceremonies = [
      ...new Set(
        requestedCeremonyIds.filter(
          (id): id is string => typeof id === "string" && validCeremonyIds.has(id),
        ),
      ),
    ].slice(0, 20);

    const { data: savedRsvp, error } = await db
      .from("wedding_rsvps")
      .insert({
        website_id: site.id,
        name,
        email,
        phone,
        response,
        guest_count: guestCount,
        message,
        ceremonies,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: savedRsvp.id, createdAt: savedRsvp.created_at };
  });
