import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import { supabase } from "./supabase.js";

type JsonRecord = Record<string, unknown>;

type VendorRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

type ProfileRow = {
  partner_one: string | null;
  partner_two: string | null;
  wedding_date: string | null;
  venue: string | null;
  city: string | null;
  guest_count: number | null;
  budget_total: number | null;
};

type CampaignRow = {
  id: string;
  name: string;
  status: "active" | "completed" | "failed";
  wedding_brief: JsonRecord;
  target_count: number;
  initiated_count: number;
  completed_count: number;
  last_synced_at: string | null;
  created_at: string;
};

type CallRunRow = {
  id: string;
  campaign_id: string;
  vendor_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string | null;
  status: "queued" | "initiated" | "in_progress" | "completed" | "failed";
  dograh_run_id: number | null;
  initial_context: JsonRecord;
  gathered_context: JsonRecord;
  transcript_url: string | null;
  recording_url: string | null;
  error: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type VoiceCallCampaign = {
  id: string;
  name: string;
  status: "active" | "completed" | "failed";
  weddingBrief: JsonRecord;
  targetCount: number;
  initiatedCount: number;
  completedCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
  runs: VoiceCallRun[];
};

export type VoiceCallRun = {
  id: string;
  vendorId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  status: "queued" | "initiated" | "in_progress" | "completed" | "failed";
  dograhRunId: number | null;
  initialContext: JsonRecord;
  gatheredContext: JsonRecord;
  transcriptUrl: string | null;
  recordingUrl: string | null;
  error: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type DograhStatus = {
  configured: boolean;
  message: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function jsonRecord(value: unknown): JsonRecord {
  return asRecord(value) ?? {};
}

function dograhConfigured() {
  return Boolean(
    config.DOGRAH_TRIGGER_URL &&
      config.DOGRAH_RUNS_BASE_URL &&
      config.DOGRAH_API_KEY &&
      config.DOGRAH_WORKFLOW_ID,
  );
}

function normalizedPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  if (!/^\d{8,15}$/.test(digits)) {
    throw new AppError("A selected vendor has an invalid phone number.", 400, "invalid_phone");
  }
  return `+${digits}`;
}

function publicUrl(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function statusMessage(): DograhStatus {
  return dograhConfigured()
    ? {
        configured: true,
        message:
          "Dograh is ready. Calls still require recipient selection and your final confirmation.",
      }
    : {
        configured: false,
        message:
          "Dograh needs a published workflow, telephony provider, and server-only configuration before calls can start.",
      };
}

export function getDograhStatus(): DograhStatus {
  return statusMessage();
}

function mapRun(row: CallRunRow): VoiceCallRun {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    recipientEmail: row.recipient_email,
    status: row.status,
    dograhRunId: row.dograh_run_id,
    initialContext: jsonRecord(row.initial_context),
    gatheredContext: jsonRecord(row.gathered_context),
    transcriptUrl: row.transcript_url,
    recordingUrl: row.recording_url,
    error: row.error,
    initiatedAt: row.initiated_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapCampaign(row: CampaignRow, runs: CallRunRow[]): VoiceCallCampaign {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    weddingBrief: jsonRecord(row.wedding_brief),
    targetCount: row.target_count,
    initiatedCount: row.initiated_count,
    completedCount: row.completed_count,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    runs: runs.map(mapRun),
  };
}

async function dograhRequest(url: string, init?: RequestInit): Promise<unknown> {
  if (!dograhConfigured()) {
    throw new AppError(statusMessage().message, 503, "dograh_not_configured");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "x-api-key": config.DOGRAH_API_KEY!,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError("Dograh could not be reached. Check its deployment and try again.", 502, "dograh_unavailable");
  }
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const detail = asRecord(body)?.detail;
    const message =
      stringValue(asRecord(body)?.message) ??
      stringValue(detail) ??
      (response.status === 401 || response.status === 403
        ? "Dograh rejected the server configuration. Check the API key and workflow access."
        : response.status === 400
          ? "Dograh could not initiate this call. Check the telephony provider and workflow."
          : "Dograh could not complete this request.");
    throw new AppError(message, 502, "dograh_request_failed");
  }
  return body;
}

async function readWeddingBrief(ownerId: string, includeBudget: boolean) {
  const [profileResult, budgetResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("partner_one, partner_two, wedding_date, venue, city, guest_count, budget_total")
      .eq("id", ownerId)
      .maybeSingle(),
    supabase
      .from("budget_categories")
      .select("planned")
      .eq("user_id", ownerId),
  ]);
  if (profileResult.error) {
    throw new AppError(profileResult.error.message, 500, profileResult.error.code ?? "database_error");
  }
  if (budgetResult.error) {
    throw new AppError(budgetResult.error.message, 500, budgetResult.error.code ?? "database_error");
  }
  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const categoryBudget = (budgetResult.data ?? []).reduce(
    (total, row) => total + (typeof row.planned === "number" ? row.planned : Number(row.planned) || 0),
    0,
  );
  const budget = profile?.budget_total ?? (categoryBudget || null);
  const couple = [profile?.partner_one, profile?.partner_two].filter(Boolean).join(" & ") || null;
  const brief: JsonRecord = {
    couple,
    wedding_date: profile?.wedding_date ?? null,
    city: profile?.city ?? null,
    venue: profile?.venue ?? null,
    guest_count: profile?.guest_count ?? null,
    ...(includeBudget ? { total_budget_inr: budget } : {}),
  };
  return brief;
}

function callContext(vendor: VendorRow, brief: JsonRecord): JsonRecord {
  return {
    recipient_name: vendor.name,
    recipient_category: vendor.category,
    recipient_city: vendor.city,
    wedding: brief,
    goal: "Confirm wedding-service availability and gather a clear quote summary.",
    questions: [
      "Are you available for the wedding date and location?",
      "Which package would you recommend, and what is included?",
      "What is the estimated price, payment schedule, and travel charge?",
      "Can you share capacity, setup requirements, and the best next step?",
      "Would you like a written wedding brief by WhatsApp or email?",
    ],
    follow_up_rule:
      "Do not send any message during the call. Capture the vendor's consent and requested follow-up channel for MarryMap to review.",
  };
}

async function listRuns(ownerId: string, campaignIds: string[]) {
  if (campaignIds.length === 0) return [] as CallRunRow[];
  const { data, error } = await supabase
    .from("voice_call_runs")
    .select("*")
    .eq("user_id", ownerId)
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: false });
  if (error) throw new AppError(error.message, 500, error.code ?? "database_error");
  return (data ?? []) as CallRunRow[];
}

export async function listVoiceCallCampaigns(ownerId: string): Promise<VoiceCallCampaign[]> {
  const { data, error } = await supabase
    .from("voice_call_campaigns")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new AppError(error.message, 500, error.code ?? "database_error");
  const campaigns = (data ?? []) as CampaignRow[];
  const runs = await listRuns(ownerId, campaigns.map((campaign) => campaign.id));
  return campaigns.map((campaign) =>
    mapCampaign(
      campaign,
      runs.filter((run) => run.campaign_id === campaign.id),
    ),
  );
}

export async function startVoiceCallCampaign(
  ownerId: string,
  input: { vendorIds: string[]; includeBudget: boolean; confirmed: boolean },
): Promise<VoiceCallCampaign> {
  if (!input.confirmed) {
    throw new AppError(
      "Confirm that these recipients agreed to receive an availability call before starting.",
      400,
      "call_consent_required",
    );
  }
  if (!dograhConfigured()) {
    throw new AppError(statusMessage().message, 503, "dograh_not_configured");
  }
  const vendorIds = [...new Set(input.vendorIds)].slice(0, 30);
  if (vendorIds.length === 0) {
    throw new AppError("Select at least one vendor with a phone number.", 400, "call_targets_missing");
  }
  const { data, error } = await supabase
    .from("saved_vendors")
    .select("id, name, category, city, contact_phone, contact_email")
    .eq("user_id", ownerId)
    .in("id", vendorIds);
  if (error) throw new AppError(error.message, 500, error.code ?? "database_error");
  const vendors = (data ?? []) as VendorRow[];
  const eligible = vendors.filter((vendor) => Boolean(vendor.contact_phone));
  if (eligible.length === 0) {
    throw new AppError("None of the selected vendors has a call number.", 400, "call_phone_missing");
  }

  const weddingBrief = await readWeddingBrief(ownerId, input.includeBudget);
  const { data: created, error: campaignError } = await supabase
    .from("voice_call_campaigns")
    .insert({
      user_id: ownerId,
      name: "Vendor availability calls",
      status: "active",
      wedding_brief: weddingBrief,
      target_count: eligible.length,
    })
    .select("*")
    .single();
  if (campaignError) {
    throw new AppError(campaignError.message, 500, campaignError.code ?? "database_error");
  }
  const campaign = created as CampaignRow;

  const draftRuns = eligible.map((vendor) => ({
    campaign_id: campaign.id,
    user_id: ownerId,
    vendor_id: vendor.id,
    recipient_name: vendor.name,
    recipient_phone: normalizedPhone(vendor.contact_phone!),
    recipient_email: vendor.contact_email,
    status: "queued",
    initial_context: callContext(vendor, weddingBrief),
  }));
  const { data: insertedRuns, error: runsError } = await supabase
    .from("voice_call_runs")
    .insert(draftRuns)
    .select("*");
  if (runsError) {
    throw new AppError(runsError.message, 500, runsError.code ?? "database_error");
  }

  let initiatedCount = 0;
  for (const run of (insertedRuns ?? []) as CallRunRow[]) {
    try {
      const result = asRecord(
        await dograhRequest(config.DOGRAH_TRIGGER_URL!, {
          method: "POST",
          body: JSON.stringify({
            phone_number: run.recipient_phone,
            initial_context: run.initial_context,
            ...(config.DOGRAH_TELEPHONY_CONFIGURATION_ID
              ? { telephony_configuration_id: config.DOGRAH_TELEPHONY_CONFIGURATION_ID }
              : {}),
          }),
        }),
      );
      const dograhRunId = numberValue(result?.workflow_run_id);
      if (!dograhRunId) {
        throw new AppError("Dograh did not return a call run ID.", 502, "dograh_invalid_response");
      }
      const { error: updateError } = await supabase
        .from("voice_call_runs")
        .update({ status: "initiated", dograh_run_id: dograhRunId, initiated_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("user_id", ownerId);
      if (updateError) throw new AppError(updateError.message, 500, updateError.code ?? "database_error");
      initiatedCount += 1;
    } catch (error) {
      const { error: updateError } = await supabase
        .from("voice_call_runs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 1_000) : "Call could not be initiated.",
        })
        .eq("id", run.id)
        .eq("user_id", ownerId);
      if (updateError) throw new AppError(updateError.message, 500, updateError.code ?? "database_error");
    }
  }

  const { error: countError } = await supabase
    .from("voice_call_campaigns")
    .update({ initiated_count: initiatedCount, status: initiatedCount > 0 ? "active" : "failed" })
    .eq("id", campaign.id)
    .eq("user_id", ownerId);
  if (countError) throw new AppError(countError.message, 500, countError.code ?? "database_error");

  const refreshed = await listVoiceCallCampaigns(ownerId);
  const result = refreshed.find((item) => item.id === campaign.id);
  if (!result) throw new AppError("The call campaign could not be loaded.", 500, "campaign_missing");
  return result;
}

async function readDograhRun(runId: number): Promise<JsonRecord> {
  const base = config.DOGRAH_RUNS_BASE_URL!.replace(/\/$/, "");
  const result = await dograhRequest(
    `${base}/api/v1/workflow/${config.DOGRAH_WORKFLOW_ID}/runs/${runId}`,
  );
  const record = asRecord(result);
  if (!record) throw new AppError("Dograh returned an invalid call result.", 502, "dograh_invalid_response");
  return record;
}

export async function syncVoiceCallCampaign(ownerId: string, campaignId: string) {
  if (!dograhConfigured()) throw new AppError(statusMessage().message, 503, "dograh_not_configured");
  const { data: campaign, error: campaignError } = await supabase
    .from("voice_call_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (campaignError) throw new AppError(campaignError.message, 500, campaignError.code ?? "database_error");
  if (!campaign) throw new AppError("Call campaign not found.", 404, "campaign_not_found");

  const { data, error } = await supabase
    .from("voice_call_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", ownerId)
    .in("status", ["initiated", "in_progress"])
    .not("dograh_run_id", "is", null)
    .limit(30);
  if (error) throw new AppError(error.message, 500, error.code ?? "database_error");

  for (const run of (data ?? []) as CallRunRow[]) {
    try {
      const result = await readDograhRun(run.dograh_run_id!);
      const completed = result.is_completed === true;
      const { error: updateError } = await supabase
        .from("voice_call_runs")
        .update({
          status: completed ? "completed" : "in_progress",
          gathered_context: jsonRecord(result.gathered_context),
          transcript_url: publicUrl(result.transcript_public_url) ?? publicUrl(result.transcript_url),
          recording_url: publicUrl(result.recording_public_url) ?? publicUrl(result.recording_url),
          completed_at: completed ? new Date().toISOString() : null,
          error: null,
        })
        .eq("id", run.id)
        .eq("user_id", ownerId);
      if (updateError) throw new AppError(updateError.message, 500, updateError.code ?? "database_error");
    } catch (error) {
      const { error: updateError } = await supabase
        .from("voice_call_runs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 1_000) : "Call result could not be synced.",
        })
        .eq("id", run.id)
        .eq("user_id", ownerId);
      if (updateError) throw new AppError(updateError.message, 500, updateError.code ?? "database_error");
    }
  }

  const allRuns = await listRuns(ownerId, [campaignId]);
  const completedCount = allRuns.filter((run) => run.status === "completed").length;
  const waiting = allRuns.some((run) => ["queued", "initiated", "in_progress"].includes(run.status));
  const { error: updateCampaignError } = await supabase
    .from("voice_call_campaigns")
    .update({
      completed_count: completedCount,
      status: waiting ? "active" : completedCount > 0 ? "completed" : "failed",
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", ownerId);
  if (updateCampaignError) {
    throw new AppError(updateCampaignError.message, 500, updateCampaignError.code ?? "database_error");
  }

  const refreshed = await listVoiceCallCampaigns(ownerId);
  return refreshed.find((item) => item.id === campaignId) ?? null;
}
