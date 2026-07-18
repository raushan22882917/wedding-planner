import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type WeddingWorkspace = {
  profile: {
    partner_one: string | null;
    partner_two: string | null;
    wedding_date: string | null;
    venue: string | null;
    city: string | null;
    guest_count: number | null;
    budget_total: number | null;
    wedding_brief: Json;
  } | null;
  budget: {
    planned: number;
    spent: number;
    remaining: number;
    categories: Array<{ id: string; name: string; planned: number; spent: number }>;
  };
  timeline: Array<{
    id: string;
    title: string;
    event_date: string;
    start_time: string | null;
    location: string | null;
    notes: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    due_date: string | null;
    priority: string;
    category: string | null;
    done: boolean;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    category: string | null;
    city: string | null;
    price_low: number | null;
    price_high: number | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    website: string | null;
    status: string;
    rating: number | null;
    notes: string | null;
  }>;
  guests: {
    total: number;
    attending: number;
    pending: number;
    dietaryNotes: number;
  };
  research: {
    sourceCount: number;
    recentTitles: string[];
  };
};

function getRows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

function parseBrief(value: Json): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};
}

/** Fetch only the current user's planning workspace. This is used by both the
 * Full Plan screen and the AI context builder, keeping their view of the
 * wedding consistent. */
export async function getWeddingWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WeddingWorkspace> {
  const [
    profileResult,
    categoryResult,
    expenseResult,
    timelineResult,
    taskResult,
    vendorResult,
    guestResult,
    researchResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "partner_one, partner_two, wedding_date, venue, city, guest_count, budget_total, wedding_brief",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("budget_categories")
      .select("id, name, planned")
      .eq("user_id", userId)
      .order("sort_order"),
    supabase.from("budget_expenses").select("category_id, amount").eq("user_id", userId),
    supabase
      .from("timeline_events")
      .select("id, title, event_date, start_time, location, notes")
      .eq("user_id", userId)
      .order("event_date")
      .limit(24),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, category, done")
      .eq("user_id", userId)
      .order("done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(24),
    supabase
      .from("saved_vendors")
      .select(
        "id, name, category, city, price_low, price_high, contact_name, contact_phone, contact_email, website, status, rating, notes",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase.from("guests").select("rsvp_status, dietary").eq("user_id", userId),
    supabase
      .from("search_documents")
      .select("title")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  const profile = profileResult.data
    ? { ...profileResult.data, wedding_brief: profileResult.data.wedding_brief ?? {} }
    : null;
  const categories = getRows(categoryResult);
  const expenses = getRows(expenseResult);
  const timeline = getRows(timelineResult);
  const tasks = getRows(taskResult);
  const vendors = getRows(vendorResult);
  const guests = getRows(guestResult);
  const research = getRows(researchResult);
  const spentByCategory = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.category_id) continue;
    spentByCategory.set(
      expense.category_id,
      (spentByCategory.get(expense.category_id) ?? 0) + Number(expense.amount),
    );
  }
  const planned = categories.reduce((sum, category) => sum + Number(category.planned), 0);
  const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return {
    profile,
    budget: {
      planned,
      spent,
      remaining: planned - spent,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        planned: Number(category.planned),
        spent: spentByCategory.get(category.id) ?? 0,
      })),
    },
    timeline,
    tasks,
    vendors,
    guests: {
      total: guests.length,
      attending: guests.filter((guest) => guest.rsvp_status === "yes").length,
      pending: guests.filter((guest) => guest.rsvp_status === "pending").length,
      dietaryNotes: guests.filter((guest) => Boolean(guest.dietary?.trim())).length,
    },
    research: {
      sourceCount: research.length,
      recentTitles: research.map((document) => document.title),
    },
  };
}

function text(value: unknown, maxLength = 280) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : null;
}

/** A compact, bounded snapshot for the model. User-provided notes are marked
 * as data so they cannot override the system policy. */
export function formatWeddingWorkspaceForAi(workspace: WeddingWorkspace) {
  const profile = workspace.profile;
  const brief = profile ? parseBrief(profile.wedding_brief) : {};
  return JSON.stringify({
    couple: [profile?.partner_one, profile?.partner_two].filter(Boolean).join(" & ") || null,
    wedding: {
      date: profile?.wedding_date ?? null,
      city: profile?.city ?? null,
      venue: profile?.venue ?? null,
      guest_count: profile?.guest_count ?? null,
      total_budget_inr: profile?.budget_total ?? null,
      tradition: text(brief.tradition, 120),
      selected_ceremonies: Array.isArray(brief.ceremonies)
        ? brief.ceremonies.filter((item): item is string => typeof item === "string").slice(0, 24)
        : [],
      vendor_priorities: Array.isArray(brief.vendor_priorities)
        ? brief.vendor_priorities
            .filter((item): item is string => typeof item === "string")
            .slice(0, 8)
        : [],
      food_preferences: text(brief.food_preferences, 180),
      family_notes: text(brief.family_notes, 240),
    },
    budget: {
      planned_inr: workspace.budget.planned,
      spent_inr: workspace.budget.spent,
      remaining_inr: workspace.budget.remaining,
      categories: workspace.budget.categories.slice(0, 10),
    },
    upcoming_timeline: workspace.timeline.slice(0, 8).map((event) => ({
      title: event.title,
      date: event.event_date,
      time: event.start_time,
      location: event.location,
      notes: text(event.notes, 160),
    })),
    open_tasks: workspace.tasks
      .filter((task) => !task.done)
      .slice(0, 8)
      .map((task) => ({
        title: task.title,
        due_date: task.due_date,
        priority: task.priority,
        category: task.category,
      })),
    saved_vendors: workspace.vendors.slice(0, 6).map((vendor) => ({
      name: vendor.name,
      category: vendor.category,
      city: vendor.city,
      status: vendor.status,
      rating: vendor.rating,
      price_low_inr: vendor.price_low,
      price_high_inr: vendor.price_high,
      website: vendor.website,
      notes: text(vendor.notes, 140),
    })),
    guest_summary: workspace.guests,
    research_library: workspace.research,
  });
}
