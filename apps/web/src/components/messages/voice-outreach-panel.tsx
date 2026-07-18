import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
  Send,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getDograhVoiceStatus,
  listVoiceCallCampaigns,
  sendWhatsAppMessage,
  startVoiceCallCampaign,
  syncVoiceCallCampaign,
  type VoiceCallCampaign,
  type VoiceCallRun,
} from "@/lib/communication.functions";
import { cn } from "@/lib/utils";
import { whatsappChatUrl } from "@/lib/whatsapp";

type CallVendor = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function cleanValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(cleanValue).filter(Boolean).join(", ");
  return "";
}

function titleFromKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function weddingBriefText(brief: Record<string, unknown>) {
  const couple = cleanValue(brief.couple) || "We";
  const date = cleanValue(brief.wedding_date);
  const city = cleanValue(brief.city);
  const venue = cleanValue(brief.venue);
  const guests = cleanValue(brief.guest_count);
  const budget = cleanValue(brief.total_budget_inr);
  return [
    `Hello, thank you for speaking with MarryMap. ${couple} are planning their wedding${date ? ` on ${date}` : ""}${city ? ` in ${city}` : ""}.`,
    venue ? `Venue: ${venue}.` : "",
    guests ? `Expected guest count: ${guests}.` : "",
    budget ? `Planned budget: ₹${budget}.` : "",
    "Please share the package, availability, inclusions, and your best next step. Thank you.",
  ]
    .filter(Boolean)
    .join(" ");
}

function hasPendingCalls(campaign: VoiceCallCampaign) {
  return campaign.runs.some((run) => ["queued", "initiated", "in_progress"].includes(run.status));
}

function callStatusClass(status: VoiceCallRun["status"]) {
  if (status === "completed") return "border-emerald-600/20 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-500/20 bg-rose-50 text-rose-800";
  return "border-amber-500/20 bg-amber-50 text-amber-900";
}

export function VoiceOutreachPanel({ vendors }: { vendors: CallVendor[] }) {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getDograhVoiceStatus);
  const campaignsFn = useServerFn(listVoiceCallCampaigns);
  const startFn = useServerFn(startVoiceCallCampaign);
  const syncFn = useServerFn(syncVoiceCallCampaign);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeBudget, setIncludeBudget] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["dograh-voice-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });
  const campaignsQuery = useQuery({
    queryKey: ["voice-call-campaigns"],
    queryFn: () => campaignsFn(),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
  const eligibleVendors = useMemo(
    () => vendors.filter((vendor) => Boolean(vendor.contact_phone)),
    [vendors],
  );
  const selected = new Set(selectedIds);
  const activeCampaignIds = useMemo(
    () => (campaignsQuery.data ?? []).filter(hasPendingCalls).map((campaign) => campaign.id),
    [campaignsQuery.data],
  );
  const activeCampaignKey = activeCampaignIds.join(",");

  const start = useMutation({
    mutationFn: () =>
      startFn({
        data: { vendorIds: selectedIds, includeBudget, confirmed: true },
      }),
    onSuccess: () => {
      setSelectedIds([]);
      setConsentConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["voice-call-campaigns"] });
      toast.success("Availability calls have been queued in Dograh.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const sync = useMutation({
    mutationFn: (campaignId: string) => syncFn({ data: { campaignId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["voice-call-campaigns"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const sendFollowUp = useMutation({
    mutationFn: ({ phone, text }: { phone: string; text: string }) => sendFn({ data: { phone, text } }),
    onSuccess: () => toast.success("Wedding details sent through WhatsApp."),
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const campaignIds = activeCampaignKey ? activeCampaignKey.split(",") : [];
    if (!statusQuery.data?.configured || campaignIds.length === 0) return;
    const refresh = () => {
      for (const campaignId of campaignIds) {
        void syncFn({ data: { campaignId } })
          .then(() => queryClient.invalidateQueries({ queryKey: ["voice-call-campaigns"] }))
          .catch(() => {
            // A transient provider issue should not produce a toast every 15 seconds.
          });
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [activeCampaignKey, queryClient, statusQuery.data?.configured, syncFn]);

  const toggleVendor = (vendorId: string) => {
    setSelectedIds((current) =>
      current.includes(vendorId)
        ? current.filter((id) => id !== vendorId)
        : [...current, vendorId],
    );
  };
  const allSelected = eligibleVendors.length > 0 && eligibleVendors.every((vendor) => selected.has(vendor.id));

  return (
    <section className="space-y-5" aria-label="Vendor availability calls">
      <div className="soft-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl">Availability calls</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Dograh asks vendors about availability, packages, pricing, and the best next step.
                </p>
              </div>
            </div>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-semibold",
              statusQuery.data?.configured
                ? "border-emerald-600/20 bg-emerald-50 text-emerald-800"
                : "border-amber-500/25 bg-amber-50 text-amber-900",
            )}
          >
            {statusQuery.data?.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            {statusQuery.data?.configured ? "Dograh ready" : "Dograh setup needed"}
          </div>
        </div>

        {!statusQuery.data?.configured && !statusQuery.isLoading && (
          <div className="mx-5 mt-5 rounded-xl border border-amber-500/20 bg-amber-50/70 p-4 text-sm leading-relaxed text-amber-950">
            <p className="font-semibold">Connect the private voice agent first</p>
            <p className="mt-1.5 text-amber-900/80">{statusQuery.data?.message}</p>
            <p className="mt-2 text-xs text-amber-900/75">
              Add <code>DOGRAH_TRIGGER_URL</code>, <code>DOGRAH_RUNS_BASE_URL</code>, <code>DOGRAH_API_KEY</code>, and <code>DOGRAH_WORKFLOW_ID</code> to the API environment. Keep the key server-only.
            </p>
          </div>
        )}

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Choose people to call</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only vendors with a saved phone number are shown. Calls are never sent until you confirm below.
                </p>
              </div>
              {eligibleVendors.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(allSelected ? [] : eligibleVendors.map((vendor) => vendor.id))}
                  className="min-h-11"
                >
                  <UsersRound className="h-4 w-4" /> {allSelected ? "Clear selection" : `Select all ${eligibleVendors.length}`}
                </Button>
              )}
            </div>

            {eligibleVendors.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Save a vendor with a phone number first, then return here to create an availability call campaign.
              </div>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {eligibleVendors.map((vendor) => {
                  const checked = selected.has(vendor.id);
                  return (
                    <label
                      key={vendor.id}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                        checked ? "border-violet-500/45 bg-violet-50/70" : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVendor(vendor.id)}
                        className="h-4 w-4 accent-violet-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{vendor.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[vendor.category, vendor.city, vendor.contact_phone].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="border-t border-border bg-secondary/20 p-5 xl:border-t-0 xl:border-l">
            <h3 className="font-medium">Call brief</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The agent receives the wedding date, location, guest count, and the questions it should ask.
            </p>
            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={includeBudget}
                onChange={(event) => setIncludeBudget(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-violet-600"
              />
              <span>
                <span className="font-medium">Share total budget</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Include your total planned budget in the voice brief and any follow-up message.
                </span>
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-violet-600"
              />
              <span>
                <span className="font-medium">I have consent to call these vendors</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  I confirm the selected contacts can receive this availability call and understand an AI assistant will speak with them.
                </span>
              </span>
            </label>
            <Button
              type="button"
              onClick={() => start.mutate()}
              disabled={
                !statusQuery.data?.configured ||
                selectedIds.length === 0 ||
                !consentConfirmed ||
                start.isPending
              }
              className="mt-5 min-h-11 w-full bg-violet-600 text-white hover:bg-violet-700"
            >
              {start.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
              Start {selectedIds.length || ""} availability {selectedIds.length === 1 ? "call" : "calls"}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Starts only after this final button press. Call outcomes sync into MarryMap automatically while this page is open.
            </p>
          </aside>
        </div>
      </div>

      <section className="soft-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl">Call outcomes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Availability answers, recordings, and requested follow-ups stay with this wedding.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              for (const campaignId of activeCampaignIds) sync.mutate(campaignId);
              void campaignsQuery.refetch();
            }}
            disabled={sync.isPending || campaignsQuery.isFetching}
            className="h-11 w-11 shrink-0"
            aria-label="Refresh call outcomes"
            title="Refresh call outcomes"
          >
            <RefreshCw className={cn("h-4 w-4", (sync.isPending || campaignsQuery.isFetching) && "animate-spin")} />
          </Button>
        </div>

        {campaignsQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading call outcomes…
          </div>
        ) : (campaignsQuery.data ?? []).length === 0 ? (
          <div className="p-8 text-center">
            <PhoneCall className="mx-auto h-7 w-7 text-violet-600" />
            <h3 className="mt-3 font-display text-lg">No availability calls yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              Select vendors above, confirm consent, and MarryMap will save each call result here for review.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(campaignsQuery.data ?? []).map((campaign) => (
              <CampaignOutcome
                key={campaign.id}
                campaign={campaign}
                onSync={() => sync.mutate(campaign.id)}
                syncing={sync.isPending}
                onSendWhatsApp={(run) =>
                  sendFollowUp.mutate({
                    phone: run.recipientPhone,
                    text: weddingBriefText(campaign.weddingBrief),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function CampaignOutcome({
  campaign,
  onSync,
  syncing,
  onSendWhatsApp,
}: {
  campaign: VoiceCallCampaign;
  onSync: () => void;
  syncing: boolean;
  onSendWhatsApp: (run: VoiceCallRun) => void;
}) {
  const brief = weddingBriefText(campaign.weddingBrief);
  return (
    <article className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{campaign.name}</h3>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", campaign.status === "completed" ? "border-emerald-600/20 bg-emerald-50 text-emerald-800" : campaign.status === "failed" ? "border-rose-500/20 bg-rose-50 text-rose-800" : "border-amber-500/20 bg-amber-50 text-amber-900")}>
              {campaign.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {campaign.completedCount}/{campaign.targetCount} results saved · Created {formatDate(campaign.createdAt)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onSync} disabled={syncing} className="min-h-11 self-start">
          {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync now
        </Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {campaign.runs.map((run) => (
          <article key={run.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{run.recipientName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{run.recipientPhone}</p>
              </div>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", callStatusClass(run.status))}>{run.status.replace(/_/g, " ")}</span>
            </div>
            {run.error ? <p className="mt-3 text-xs leading-relaxed text-rose-700">{run.error}</p> : null}
            {Object.keys(run.gatheredContext).length > 0 && (
              <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                {Object.entries(run.gatheredContext)
                  .filter(([, value]) => cleanValue(value))
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                      <dt className="font-medium text-muted-foreground">{titleFromKey(key)}</dt>
                      <dd className="break-words text-foreground">{cleanValue(value)}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {run.status === "completed" && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="button" size="sm" onClick={() => onSendWhatsApp(run)} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Send className="h-3.5 w-3.5" /> Send WhatsApp details
                </Button>
                {run.recipientEmail && (
                  <a
                    href={`mailto:${run.recipientEmail}?subject=${encodeURIComponent("Wedding availability follow-up")}&body=${encodeURIComponent(brief)}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    Email details <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {whatsappChatUrl(run.recipientPhone, brief) && (
                  <a
                    href={whatsappChatUrl(run.recipientPhone, brief) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    Open WhatsApp <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {run.recordingUrl && (
                  <a href={run.recordingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary">
                    Recording <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </article>
  );
}
