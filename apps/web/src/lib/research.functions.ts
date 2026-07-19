import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { searchAgentReachSources } from "@/lib/search-backend.server";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

interface ResearchSource {
  id: string;
  name: string;
  kind: "web" | "rss" | "web_search";
  config: { query?: string };
  last_crawled_at: string | null;
}

interface ResearchJob {
  id: string;
  source_id: string;
  status: JobStatus;
  documents_created: number;
  documents_updated: number;
  error: string | null;
}

type ConciergeBrief = {
  vendor_priorities?: unknown;
  planning_style?: unknown;
  ceremonies?: unknown;
};

async function consumeVendorResearchQuota(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("consume_subscription_quota", {
    p_feature: "vendor_research",
    p_units: 1,
  });
  if (error) throw new Error(error.message);
  const result = data[0];
  if (!result) throw new Error("Could not confirm your vendor research allowance.");
  if (!result.allowed) {
    throw new Error(
      `Vendor research allowance reached (${result.used_units}/${result.included_units}). Upgrade or add a usage pack to continue.`,
    );
  }
}

export interface ResearchDocument {
  id: string;
  title: string;
  url: string;
  source_name?: string | null;
  description: string | null;
  snippet: string;
  image_url: string | null;
  map_url: string | null;
  emails: string[];
  phones: string[];
  updated_at: string;
}

export interface PublicSourcePreview {
  imageUrl: string | null;
  mapUrl: string | null;
  emails: string[];
  phones: string[];
}

export interface ResearchRun {
  source: ResearchSource;
  documents: ResearchDocument[];
  origin?: "indexed" | "live";
}

function backendUrl(): string {
  const url = process.env.SEARCH_BACKEND_URL?.replace(/\/$/, "");
  if (!url)
    throw new Error("Vendor research is not configured. Set SEARCH_BACKEND_URL for the web app.");
  return url;
}

async function backendRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl()}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error(
      "Vendor research service is unavailable. Start the API and check SEARCH_BACKEND_URL.",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Vendor research could not be completed.");
  }
  return payload.data;
}

function normalizedQuery(value: string): string {
  const query = value.replace(/\s+/g, " ").trim();
  if (query.length < 3) throw new Error("Enter at least three characters to research vendors.");
  return query.slice(0, 240);
}

async function queueVendorResearch(accessToken: string, query: string, maxItems = 6) {
  const normalized = normalizedQuery(query);
  const sources = await backendRequest<ResearchSource[]>(accessToken, "/v1/sources");
  let source = sources.find(
    (candidate) =>
      candidate.kind === "web_search" &&
      candidate.config.query?.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase(),
  );

  if (!source) {
    source = await backendRequest<ResearchSource>(accessToken, "/v1/sources", {
      method: "POST",
      body: JSON.stringify({
        name: `Vendor research · ${normalized}`.slice(0, 120),
        kind: "web_search",
        // The query is the research input. This URL is an auditable canonical
        // identifier, not a claim that a search page was scraped.
        url: `https://search.marrymap.invalid/?q=${encodeURIComponent(normalized)}`,
        config: { query: normalized, maxItems, hydrateResults: true },
      }),
    });
  }

  const job = await backendRequest<ResearchJob>(accessToken, `/v1/sources/${source.id}/jobs`, {
    method: "POST",
  });
  return { source, job, query: normalized };
}

function asTextList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, limit);
}

function conciergeQueries(profile: {
  city: string | null;
  guest_count: number | null;
  budget_total: number | null;
  wedding_brief: unknown;
}) {
  if (!profile.city?.trim())
    throw new Error("Complete your wedding city before starting AI research.");
  const brief =
    profile.wedding_brief &&
    typeof profile.wedding_brief === "object" &&
    !Array.isArray(profile.wedding_brief)
      ? (profile.wedding_brief as ConciergeBrief)
      : {};
  const priorities = asTextList(brief.vendor_priorities, 3);
  const categories = priorities.length ? priorities : ["venues", "caterers", "photographers"];
  const city = profile.city.trim();
  const budgetHint = profile.budget_total
    ? ` within a total wedding budget of ₹${Math.round(profile.budget_total).toLocaleString("en-IN")}`
    : "";
  const guestHint = profile.guest_count ? ` for ${profile.guest_count} guests` : "";
  return categories.map((category) => `wedding ${category} in ${city}${guestHint}${budgetHint}`);
}

export const startVendorResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string; maxItems?: number }) => input)
  .handler(async ({ data, context }) => {
    const maxItems = Math.max(1, Math.min(data.maxItems ?? 6, 12));
    const run = await queueVendorResearch(context.accessToken, data.query, maxItems);
    return { sourceId: run.source.id, sourceName: run.source.name, query: run.query, job: run.job };
  });

/** Re-check a cited public page for its displayed profile image, map, phone,
 * and email. This is used to enrich older chat cards without trusting the
 * language model to invent any contact information. */
export const getPublicSourcePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { url: string }) => input)
  .handler(async ({ data, context }): Promise<PublicSourcePreview> => {
    let url: URL;
    try {
      url = new URL(data.url);
    } catch {
      throw new Error("The cited source URL is invalid.");
    }
    if (!/^https?:$/.test(url.protocol)) {
      throw new Error("Only public website sources can be checked.");
    }
    const preview = await backendRequest<{
      image_url: string | null;
      map_url: string | null;
      emails: string[];
      phones: string[];
    }>(context.accessToken, "/v1/source-preview", {
      method: "POST",
      body: JSON.stringify({ url: url.toString() }),
    });
    return {
      imageUrl: preview.image_url,
      mapUrl: preview.map_url,
      emails: preview.emails,
      phones: preview.phones,
    };
  });

/** Queue the first research pass from the saved wedding brief. It only reads
 * public sources and collects source-provided details; it never messages,
 * calls, books, or shares the couple's brief with vendors. */
export const startWeddingConciergeResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("city, guest_count, budget_total, wedding_brief, research_consent_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile?.research_consent_at) {
      throw new Error("Save your wedding brief and approve public-source research first.");
    }

    const queries = conciergeQueries(profile);
    const results = await Promise.allSettled(
      queries.map((query) => queueVendorResearch(context.accessToken, query, 6)),
    );
    const queued = results.flatMap((result) =>
      result.status === "fulfilled"
        ? [
            {
              query: result.value.query,
              jobId: result.value.job.id,
              sourceId: result.value.source.id,
            },
          ]
        : [],
    );
    const errors = results.flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "A research request could not be queued.",
          ]
        : [],
    );
    if (!queued.length && errors.length) throw new Error(errors[0]);
    return { queued, errors };
  });

/**
 * Read-only fallback for the dashboard. The normal worker remains responsible
 * for indexed history; this path makes public source results visible while
 * that worker or its database is unavailable.
 */
export const searchLiveVendorResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string }) => input)
  .handler(async ({ data, context }): Promise<ResearchRun> => {
    const query = normalizedQuery(data.query);
    await consumeVendorResearchQuota(context.supabase);
    const sources = await searchAgentReachSources(query, `Bearer ${context.accessToken}`);
    const updatedAt = new Date().toISOString();
    return {
      origin: "live",
      source: {
        id: `agent-reach-${encodeURIComponent(query)}`,
        name: "Agent Reach live search",
        kind: "web_search",
        config: { query },
        last_crawled_at: updatedAt,
      },
      documents: sources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        source_name: source.sourceName,
        description: null,
        snippet: source.snippet,
        image_url: source.imageUrl ?? null,
        map_url: source.mapUrl ?? null,
        emails: source.emails ?? [],
        phones: source.phones ?? [],
        updated_at: updatedAt,
      })),
    };
  });

export const getVendorResearchJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) =>
    backendRequest<ResearchJob>(context.accessToken, `/v1/jobs/${encodeURIComponent(data.jobId)}`),
  );

export const listRecentVendorResearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResearchRun[]> => {
    const sources = await backendRequest<ResearchSource[]>(context.accessToken, "/v1/sources");
    const researchSources = sources.filter((source) => source.kind === "web_search").slice(0, 3);
    return Promise.all(
      researchSources.map(async (source) => ({
        source,
        documents: await backendRequest<ResearchDocument[]>(
          context.accessToken,
          `/v1/sources/${source.id}/documents`,
        ),
      })),
    );
  });
