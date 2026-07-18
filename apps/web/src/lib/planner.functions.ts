import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- GUESTS ----------
export const listGuests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("guests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      name: string;
      side?: "bride" | "groom" | "both";
      relationship?: string | null;
      phone?: string | null;
      email?: string | null;
      rsvp_status?: "pending" | "yes" | "no" | "maybe";
      plus_one?: boolean;
      dietary?: string | null;
      address?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("guests")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("guests").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

type BulkGuest = {
  name: string;
  side?: "bride" | "groom" | "both";
  relationship?: string | null;
  phone?: string | null;
  email?: string | null;
  rsvp_status?: "pending" | "yes" | "no" | "maybe";
  plus_one?: boolean;
  dietary?: string | null;
  address?: string | null;
  notes?: string | null;
};

const guestText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";

const guestIdentity = (guest: {
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
}) => {
  const phone = guest.phone?.replace(/\D/g, "") ?? "";
  const email = guest.email?.trim().toLowerCase() ?? "";
  const name = `${guest.name.trim().toLowerCase()}|${guest.relationship?.trim().toLowerCase() ?? ""}`;
  return [email ? `email:${email}` : null, phone ? `phone:${phone}` : null, `name:${name}`].filter(
    (value): value is string => Boolean(value),
  );
};

export const importGuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { guests: BulkGuest[] }) => data)
  .handler(async ({ data, context }) => {
    if (!Array.isArray(data.guests) || data.guests.length === 0) {
      throw new Error("Choose at least one valid guest to import.");
    }
    if (data.guests.length > 500) throw new Error("Import up to 500 guests at a time.");

    const allowedSides = new Set(["bride", "groom", "both"]);
    const allowedRsvp = new Set(["pending", "yes", "no", "maybe"]);
    const incoming = data.guests.map((guest, index) => {
      const name = guestText(guest?.name, 160);
      if (!name) throw new Error(`Guest ${index + 1} needs a name.`);
      const side = allowedSides.has(guest.side ?? "both") ? (guest.side ?? "both") : "both";
      const rsvp = allowedRsvp.has(guest.rsvp_status ?? "pending")
        ? (guest.rsvp_status ?? "pending")
        : "pending";
      const email = guestText(guest.email, 320).toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`Guest ${index + 1} has an invalid email address.`);
      }
      return {
        user_id: context.userId,
        name,
        side,
        relationship: guestText(guest.relationship, 160) || null,
        phone: guestText(guest.phone, 40) || null,
        email,
        rsvp_status: rsvp,
        plus_one: guest.plus_one === true,
        dietary: guestText(guest.dietary, 300) || null,
        address: guestText(guest.address, 500) || null,
        notes: guestText(guest.notes, 1_500) || null,
      };
    });

    const { data: existing, error: existingError } = await context.supabase
      .from("guests")
      .select("name, relationship, phone, email")
      .eq("user_id", context.userId);
    if (existingError) throw new Error(existingError.message);

    const known = new Set((existing ?? []).flatMap(guestIdentity));
    let skipped = 0;
    const rows = incoming.filter((guest) => {
      const identities = guestIdentity(guest);
      if (identities.some((identity) => known.has(identity))) {
        skipped += 1;
        return false;
      }
      identities.forEach((identity) => known.add(identity));
      return true;
    });

    if (rows.length === 0) return { imported: 0, skipped };
    const { error } = await context.supabase.from("guests").insert(rows);
    if (error) throw new Error(error.message);
    return { imported: rows.length, skipped };
  });

export const deleteGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("guests")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BUDGET ----------
export const listBudget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [cats, exps] = await Promise.all([
      context.supabase
        .from("budget_categories")
        .select("*")
        .eq("user_id", context.userId)
        .order("sort_order"),
      context.supabase
        .from("budget_expenses")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (exps.error) throw new Error(exps.error.message);
    return { categories: cats.data ?? [], expenses: exps.data ?? [] };
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: { id?: string; name: string; planned: number; color?: string; sort_order?: number }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("budget_categories")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("budget_categories").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("budget_categories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      category_id?: string | null;
      description: string;
      vendor?: string | null;
      amount: number;
      paid?: boolean;
      due_date?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("budget_expenses")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("budget_expenses").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("budget_expenses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- TASKS ----------
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("user_id", context.userId)
      .order("done")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      title: string;
      notes?: string | null;
      due_date?: string | null;
      priority?: "low" | "medium" | "high";
      category?: string | null;
      done?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("tasks")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("tasks").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- TIMELINE ----------
export const listTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("timeline_events")
      .select("*")
      .eq("user_id", context.userId)
      .order("event_date")
      .order("start_time", { nullsFirst: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      title: string;
      event_date: string;
      start_time?: string | null;
      end_time?: string | null;
      location?: string | null;
      notes?: string | null;
      color?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("timeline_events")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("timeline_events").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("timeline_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SAVED VENDORS ----------
export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_vendors")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listVendorResearchLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vendor_directory")
      .select(
        "id, name, category, city, address, summary, price, capacity, website, maps_url, contact_email, contact_phone, image_url, services, source_url, source_name, verification_status, last_seen_at",
      )
      .eq("is_published", true)
      .order("last_seen_at", { ascending: false })
      .limit(48);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const selectVendorForWedding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { directoryId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: lead, error: leadError } = await context.supabase
      .from("vendor_directory")
      .select(
        "id, name, category, city, address, summary, price, capacity, website, maps_url, contact_email, contact_phone, services, source_url, source_name",
      )
      .eq("id", data.directoryId)
      .eq("is_published", true)
      .maybeSingle();
    if (leadError) throw new Error(leadError.message);
    if (!lead) throw new Error("This research lead is no longer available.");

    const { data: existing, error: existingError } = await context.supabase
      .from("saved_vendors")
      .select("*")
      .eq("user_id", context.userId)
      .eq("source_directory_id", lead.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return { vendor: existing, created: false };

    const services = Array.isArray(lead.services)
      ? lead.services.filter((service): service is string => typeof service === "string")
      : [];
    const notes = [
      "Added from source-backed MarryMap AI research.",
      lead.summary,
      lead.address ? `Address: ${lead.address}` : null,
      lead.price ? `Price: ${lead.price}` : null,
      lead.capacity ? `Capacity: ${lead.capacity}` : null,
      services.length > 0 ? `Services: ${services.join(", ")}` : null,
      lead.maps_url ? `Map: ${lead.maps_url}` : null,
      `Source: ${lead.source_url}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const { data: vendor, error } = await context.supabase
      .from("saved_vendors")
      .insert({
        user_id: context.userId,
        source_directory_id: lead.id,
        name: lead.name,
        category: lead.category,
        city: lead.city,
        contact_phone: lead.contact_phone,
        contact_email: lead.contact_email,
        website: lead.website ?? lead.source_url,
        status: "shortlist",
        notes,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: duplicate, error: duplicateError } = await context.supabase
          .from("saved_vendors")
          .select("*")
          .eq("user_id", context.userId)
          .eq("source_directory_id", lead.id)
          .single();
        if (duplicateError) throw new Error(duplicateError.message);
        return { vendor: duplicate, created: false };
      }
      throw new Error(error.message);
    }
    return { vendor, created: true };
  });

function compactVendorText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function safeVendorUrl(value: unknown) {
  const url = compactVendorText(value, 1_500);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Save a source-backed vendor card from a chat reply to the couple's own
 * shortlist. The lookup avoids creating repeated entries when a card appears
 * again in a later conversation. */
export const saveChatVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      name: string;
      category?: string | null;
      city?: string | null;
      price?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      summary?: string | null;
      details?: string[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const name = compactVendorText(data.name, 300);
    if (!name) throw new Error("This vendor needs a name before it can be saved.");
    const website = safeVendorUrl(data.website);
    const price = compactVendorText(data.price, 160);
    const email = compactVendorText(data.email, 320).toLowerCase();
    const phone = compactVendorText(data.phone, 40);
    const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    const digitCount = phone.replace(/\D/g, "").length;
    const validPhone = digitCount >= 8 && digitCount <= 15 ? phone : null;

    const { data: existing, error: existingError } = await context.supabase
      .from("saved_vendors")
      .select("id, name, website")
      .eq("user_id", context.userId);
    if (existingError) throw new Error(existingError.message);
    const normalizedName = name.toLocaleLowerCase();
    const duplicate = (existing ?? []).find(
      (vendor) =>
        vendor.name.trim().toLocaleLowerCase() === normalizedName ||
        Boolean(website && vendor.website && vendor.website === website),
    );
    if (duplicate) return { id: duplicate.id, created: false };

    const details = Array.isArray(data.details)
      ? data.details
          .map((item) => compactVendorText(item, 180))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const notes = [
      "Saved from a source-backed MarryMap AI chat result.",
      compactVendorText(data.summary, 2_000),
      details.length ? `Details: ${details.join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const { data: vendor, error } = await context.supabase
      .from("saved_vendors")
      .insert({
        user_id: context.userId,
        name,
        category: compactVendorText(data.category, 120) || null,
        city: compactVendorText(data.city, 160) || null,
        contact_phone: validPhone,
        contact_email: validEmail,
        website,
        status: "shortlist",
        notes: [
          `Saved from source-backed MarryMap AI chat result.${price ? ` Price: ${price}.` : ""}`,
          notes,
        ]
          .filter(Boolean)
          .join("\n\n"),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: vendor.id, created: true };
  });

export const upsertVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      name: string;
      category?: string | null;
      city?: string | null;
      price_low?: number | null;
      price_high?: number | null;
      contact_name?: string | null;
      contact_phone?: string | null;
      contact_email?: string | null;
      website?: string | null;
      status?: "shortlist" | "contacted" | "quoted" | "booked" | "passed";
      rating?: number | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("saved_vendors")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("saved_vendors").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_vendors")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- DOCUMENTS ----------
export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id?: string;
      name: string;
      folder?: string;
      tag?: string | null;
      storage_path?: string | null;
      size_bytes?: number | null;
      mime_type?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("documents")
          .update(payload)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select()
          .single()
      : await context.supabase.from("documents").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
