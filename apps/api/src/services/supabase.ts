import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import type {
  JobStatus,
  ScrapedDocument,
  SourceConfig,
  SourceKind,
} from "../types.js";

export interface SourceRow {
  id: string;
  owner_id: string;
  name: string;
  kind: SourceKind;
  url: string;
  config: SourceConfig;
  enabled: boolean;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  source_id: string;
  owner_id: string;
  status: JobStatus;
  attempted_at: string | null;
  completed_at: string | null;
  documents_created: number;
  documents_updated: number;
  error: string | null;
  created_at: string;
}

export const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

function requireData<T>(
  data: T | null,
  error: { message: string; code?: string } | null,
): T {
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  if (data === null) throw new AppError("Record not found", 404, "not_found");
  return data;
}

export async function listSources(ownerId: string): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return requireData(data, error) as SourceRow[];
}

export async function getSource(
  ownerId: string,
  sourceId: string,
): Promise<SourceRow> {
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", sourceId)
    .maybeSingle();
  return requireData(data, error) as SourceRow;
}

export async function createSource(
  ownerId: string,
  input: Pick<SourceRow, "name" | "kind" | "url" | "config">,
): Promise<SourceRow> {
  const { data, error } = await supabase
    .from("sources")
    .insert({ ...input, owner_id: ownerId })
    .select("*")
    .single();
  return requireData(data, error) as SourceRow;
}

export async function updateSource(
  ownerId: string,
  sourceId: string,
  input: Partial<Pick<SourceRow, "name" | "url" | "config" | "enabled">>,
): Promise<SourceRow> {
  const { data, error } = await supabase
    .from("sources")
    .update(input)
    .eq("owner_id", ownerId)
    .eq("id", sourceId)
    .select("*")
    .maybeSingle();
  return requireData(data, error) as SourceRow;
}

export async function deleteSource(
  ownerId: string,
  sourceId: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("sources")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId)
    .eq("id", sourceId);
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  if (count === 0) throw new AppError("Record not found", 404, "not_found");
}

export async function createJob(
  ownerId: string,
  sourceId: string,
): Promise<JobRow> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .insert({ owner_id: ownerId, source_id: sourceId })
    .select("*")
    .single();
  return requireData(data, error) as JobRow;
}

export async function getJob(ownerId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", jobId)
    .maybeSingle();
  return requireData(data, error) as JobRow;
}

export async function claimJob(): Promise<JobRow | null> {
  const { data, error } = await supabase.rpc("claim_scrape_job");
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  // A PostgreSQL function returning a composite row is serialized by PostgREST
  // as an object with null fields when no job was claimed. Treat that sentinel
  // as no work instead of trying to update the UUID value "null".
  const job = data as Partial<JobRow> | null;
  if (!job?.id || !job.owner_id || !job.source_id) return null;
  return job as JobRow;
}

export async function finishJob(
  jobId: string,
  status: Extract<JobStatus, "completed" | "failed">,
  stats: { created: number; updated: number; error?: string },
): Promise<void> {
  const { error } = await supabase
    .from("scrape_jobs")
    .update({
      status,
      documents_created: stats.created,
      documents_updated: stats.updated,
      error: stats.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
}

export async function touchSource(sourceId: string): Promise<void> {
  const { error } = await supabase
    .from("sources")
    .update({ last_crawled_at: new Date().toISOString() })
    .eq("id", sourceId);
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
}

export async function upsertDocument(
  ownerId: string,
  sourceId: string,
  document: ScrapedDocument,
): Promise<"created" | "updated"> {
  const payload = {
    owner_id: ownerId,
    source_id: sourceId,
    external_id: document.externalId ?? null,
    url: document.url,
    canonical_url: document.canonicalUrl,
    title: document.title,
    description: document.description ?? null,
    content: document.content,
    content_hash: document.metadata?.contentHash as string | undefined,
    author: document.author ?? null,
    language: document.language ?? null,
    published_at: document.publishedAt ?? null,
    metadata: document.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: lookupError } = await supabase
    .from("search_documents")
    .select("id, content_hash")
    .eq("source_id", sourceId)
    .eq("canonical_url", document.canonicalUrl)
    .maybeSingle();
  if (lookupError)
    throw new AppError(
      lookupError.message,
      500,
      lookupError.code ?? "database_error",
    );
  if (existing?.content_hash === payload.content_hash) return "updated";
  const { error } = await supabase
    .from("search_documents")
    .upsert(payload, { onConflict: "owner_id,source_id,canonical_url" });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  return existing ? "updated" : "created";
}

export async function insertManualDocument(
  ownerId: string,
  document: ScrapedDocument,
): Promise<void> {
  const { error } = await supabase.from("search_documents").insert({
    owner_id: ownerId,
    source_id: null,
    external_id: document.externalId ?? null,
    url: document.url,
    canonical_url: document.canonicalUrl,
    title: document.title,
    description: document.description ?? null,
    content: document.content,
    content_hash: document.metadata?.contentHash as string,
    author: document.author ?? null,
    language: document.language ?? null,
    published_at: document.publishedAt ?? null,
    metadata: document.metadata ?? {},
  });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
}

export async function deleteDocument(
  ownerId: string,
  documentId: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("search_documents")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId)
    .eq("id", documentId);
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  if (count === 0) throw new AppError("Record not found", 404, "not_found");
}

export interface SearchResult {
  id: string;
  source_id: string | null;
  source_name: string | null;
  title: string;
  url: string;
  canonical_url: string;
  description: string | null;
  snippet: string;
  published_at: string | null;
  rank: number;
  total_count: number;
}

export interface SourceDocumentPreview {
  id: string;
  title: string;
  url: string;
  description: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

export interface VendorDirectoryInput {
  canonical_url: string;
  name: string;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  summary?: string | null;
  price?: string | null;
  capacity?: string | null;
  website?: string | null;
  maps_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  image_url?: string | null;
  services?: string[];
  source_url: string;
  source_name?: string | null;
  source_excerpt?: string | null;
}

export interface VendorDirectorySearchResult {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  summary: string | null;
  price: string | null;
  capacity: string | null;
  website: string | null;
  maps_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  image_url: string | null;
  services: string[];
  source_url: string;
  source_name: string | null;
  source_excerpt: string | null;
  verification_status: "source_backed" | "verified" | "needs_review";
  last_seen_at: string;
  rank: number;
}

export async function searchDocuments(
  ownerId: string,
  query: string,
  page: number,
  pageSize: number,
  sourceIds?: string[],
  from?: string,
  to?: string,
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_documents", {
    p_owner_id: ownerId,
    p_query: query,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    p_source_ids: sourceIds?.length ? sourceIds : null,
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  return (data ?? []) as SearchResult[];
}

export async function searchVendorDirectory(
  query: string,
  limit = 6,
): Promise<VendorDirectorySearchResult[]> {
  const { data, error } = await supabase.rpc("search_vendor_directory", {
    p_query: query,
    p_limit: Math.max(1, Math.min(limit, 24)),
  });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  return (data ?? []) as VendorDirectorySearchResult[];
}

export async function upsertVendorDirectory(
  vendors: VendorDirectoryInput[],
): Promise<void> {
  if (vendors.length === 0) return;
  const now = new Date().toISOString();
  const payload = vendors.map((vendor) => {
    const optionalFields = Object.fromEntries(
      Object.entries(vendor).filter(([, value]) =>
        Array.isArray(value)
          ? value.length > 0
          : value !== null && value !== undefined,
      ),
    );
    return {
      ...optionalFields,
      canonical_url: vendor.canonical_url,
      name: vendor.name,
      source_url: vendor.source_url,
      verification_status: "source_backed",
      is_published: true,
      last_seen_at: now,
      updated_at: now,
    };
  });
  const { error } = await supabase
    .from("vendor_directory")
    .upsert(payload, { onConflict: "canonical_url" });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
}

export async function listSourceDocuments(
  ownerId: string,
  sourceId: string,
  limit = 12,
): Promise<SourceDocumentPreview[]> {
  const { data, error } = await supabase
    .from("search_documents")
    .select("id, title, url, description, content, metadata, updated_at")
    .eq("owner_id", ownerId)
    .eq("source_id", sourceId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
  return (data ?? []) as SourceDocumentPreview[];
}

export async function recordSearch(
  ownerId: string,
  query: string,
  resultCount: number,
): Promise<void> {
  const { error } = await supabase
    .from("search_queries")
    .insert({ owner_id: ownerId, query, result_count: resultCount });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");
}
