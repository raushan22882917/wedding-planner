import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type WeddingBrief = {
  tradition: string;
  region: string | null;
  ceremonies: string[];
  planning_style: string;
  vendor_priorities: string[];
  family_notes: string | null;
  food_preferences: string | null;
  research_consent: boolean;
};

export type WeddingOnboardingInput = {
  partner_one: string;
  partner_two: string | null;
  wedding_date: string;
  city: string;
  venue: string | null;
  guest_count: number;
  budget_total: number;
  brief: WeddingBrief;
};

type ProfileUpdateInput = {
  partner_one?: string | null;
  partner_two?: string | null;
  partner_one_photo_path?: string | null;
  partner_two_photo_path?: string | null;
  wedding_date?: string | null;
  venue?: string | null;
  city?: string | null;
  guest_count?: number | null;
  budget_total?: number | null;
};

const budgetBlueprint = [
  ["Venue", 0.32, "primary"],
  ["Catering", 0.2, "gold"],
  ["Decor & flowers", 0.11, "purple"],
  ["Photo & video", 0.1, "primary"],
  ["Attire & jewellery", 0.09, "gold"],
  ["Beauty & mehendi", 0.04, "purple"],
  ["Entertainment", 0.05, "primary"],
  ["Travel, gifts & misc.", 0.09, "purple"],
] as const;

function normaliseText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function photoPathForUser(
  value: string | null | undefined,
  userId: string,
  slot: "partner-one" | "partner-two",
) {
  if (value === null || value === undefined) return value;
  const expectedPath = `${userId}/${slot}`;
  if (value !== expectedPath) {
    throw new Error("That profile photo could not be verified. Please upload it again.");
  }
  return value;
}

function isWeddingDayCeremony(name: string) {
  return /nikah|anand karaj|church|wedding mass|chuppah|vows|pher|saptapadi|mangalya|mangal sutra|mangalasutra|kanyadaan|kanyadan|laavan|ceremony$/i.test(
    name,
  );
}

function isPostWeddingCeremony(name: string) {
  return /vidaai|vidaai|rukhsati|griha pravesh|walima|reception|pag phera|bou bhaat|nalangu|send-off/i.test(
    name,
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const createPhotoUrl = async (path: string | null) => {
      if (!path) return null;

      const separator = path.lastIndexOf("/");
      const folder = path.slice(0, separator);
      const fileName = path.slice(separator + 1);
      if (!folder || !fileName) return null;

      // `createSignedUrl` can sign a stale path without checking that the
      // object still exists. Confirming the object first prevents the browser
      // from requesting a broken URL (and lets the avatar use its initials).
      const { data: files, error: listError } = await context.supabase.storage
        .from("profile-photos")
        .list(folder, { limit: 20 });
      if (listError || !files?.some((file) => file.name === fileName)) return null;

      const { data: signedUrl, error: signedUrlError } = await context.supabase.storage
        .from("profile-photos")
        .createSignedUrl(path, 60 * 60);

      // A missing or deleted image should not prevent the rest of the planning workspace loading.
      return signedUrlError ? null : (signedUrl?.signedUrl ?? null);
    };

    const [partnerOnePhotoUrl, partnerTwoPhotoUrl] = await Promise.all([
      createPhotoUrl(data.partner_one_photo_path),
      createPhotoUrl(data.partner_two_photo_path),
    ]);

    return {
      ...data,
      partner_one_photo_url: partnerOnePhotoUrl,
      partner_two_photo_url: partnerTwoPhotoUrl,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: ProfileUpdateInput) => d)
  .handler(async ({ data, context }) => {
    const update = {
      ...data,
      partner_one_photo_path: photoPathForUser(
        data.partner_one_photo_path,
        context.userId,
        "partner-one",
      ),
      partner_two_photo_path: photoPathForUser(
        data.partner_two_photo_path,
        context.userId,
        "partner-two",
      ),
    };

    if (data.partner_one_photo_path === undefined) delete update.partner_one_photo_path;
    if (data.partner_two_photo_path === undefined) delete update.partner_two_photo_path;

    const { data: row, error } = await context.supabase
      .from("profiles")
      .update(update)
      .eq("id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Persist the signup brief and give every core planning page a useful starting
 * point. Research is deliberately started by a separate action afterwards so
 * a saved brief is never lost if the external research service is offline.
 */
export const completeWeddingOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: WeddingOnboardingInput) => data)
  .handler(async ({ data, context }) => {
    const partnerOne = normaliseText(data.partner_one, 160);
    const partnerTwo = data.partner_two ? normaliseText(data.partner_two, 160) : "";
    const city = normaliseText(data.city, 160);
    const venue = data.venue ? normaliseText(data.venue, 240) : "";
    const weddingDate = normaliseText(data.wedding_date, 10);
    const guestCount = Math.round(data.guest_count);
    const budgetTotal = Math.round(data.budget_total);
    const ceremonies = [
      ...new Set(data.brief.ceremonies.map((item) => normaliseText(item, 160)).filter(Boolean)),
    ].slice(0, 40);
    const priorities = [
      ...new Set(
        data.brief.vendor_priorities.map((item) => normaliseText(item, 100)).filter(Boolean),
      ),
    ].slice(0, 8);

    if (!partnerOne) throw new Error("Add at least one name for your wedding workspace.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) throw new Error("Choose a valid wedding date.");
    if (!city) throw new Error("Add the city where you are planning your wedding.");
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10_000) {
      throw new Error("Enter an expected guest count between 1 and 10,000.");
    }
    if (!Number.isFinite(budgetTotal) || budgetTotal < 1_000) {
      throw new Error("Enter a realistic total budget to continue.");
    }
    if (!data.brief.research_consent) {
      throw new Error("Confirm public-source research before asking MarryMap AI to begin.");
    }

    const weddingBrief: WeddingBrief = {
      tradition: normaliseText(data.brief.tradition, 100) || "Family-led",
      region: data.brief.region ? normaliseText(data.brief.region, 100) || null : null,
      ceremonies,
      planning_style: normaliseText(data.brief.planning_style, 100) || "Balanced",
      vendor_priorities: priorities,
      family_notes: data.brief.family_notes
        ? normaliseText(data.brief.family_notes, 2_000) || null
        : null,
      food_preferences: data.brief.food_preferences
        ? normaliseText(data.brief.food_preferences, 800) || null
        : null,
      research_consent: true,
    };
    const now = new Date().toISOString();
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .update({
        partner_one: partnerOne,
        partner_two: partnerTwo || null,
        wedding_date: weddingDate,
        city,
        venue: venue || null,
        guest_count: guestCount,
        budget_total: budgetTotal,
        wedding_brief: weddingBrief as unknown as Json,
        onboarding_completed_at: now,
        research_consent_at: now,
      })
      .eq("id", context.userId)
      .select("*")
      .single();
    if (profileError) throw new Error(profileError.message);

    const [
      { count: existingCategories, error: categoryLookupError },
      { data: existingEvents, error: eventsLookupError },
    ] = await Promise.all([
      context.supabase
        .from("budget_categories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      context.supabase.from("timeline_events").select("title").eq("user_id", context.userId),
    ]);
    if (categoryLookupError) throw new Error(categoryLookupError.message);
    if (eventsLookupError) throw new Error(eventsLookupError.message);

    let categoriesCreated = 0;
    if (!existingCategories) {
      const { error } = await context.supabase.from("budget_categories").insert(
        budgetBlueprint.map(([name, weight, color], index) => ({
          user_id: context.userId,
          name,
          planned: Math.round(budgetTotal * weight),
          color,
          sort_order: index,
        })),
      );
      if (error) throw new Error(error.message);
      categoriesCreated = budgetBlueprint.length;
    }

    const existingTitles = new Set(
      (existingEvents ?? []).map((event) => event.title.trim().toLocaleLowerCase()),
    );
    const timelineRows = ceremonies
      .filter((name) => !existingTitles.has(name.toLocaleLowerCase()))
      .map((title, index) => {
        const offset = isWeddingDayCeremony(title)
          ? 0
          : isPostWeddingCeremony(title)
            ? 1 + Math.floor(index / 5)
            : -Math.max(1, Math.ceil((ceremonies.length - index) / 5));
        return {
          user_id: context.userId,
          title,
          event_date: addDays(weddingDate, offset),
          location: venue || null,
          notes: `Added from your ${weddingBrief.tradition} planning brief. Confirm timing with your family and edit anytime.`,
          color: offset === 0 ? "primary" : offset > 0 ? "purple" : "gold",
        };
      });
    if (timelineRows.length) {
      const { error } = await context.supabase.from("timeline_events").insert(timelineRows);
      if (error) throw new Error(error.message);
    }

    return { profile, categoriesCreated, ceremoniesScheduled: timelineRows.length };
  });
