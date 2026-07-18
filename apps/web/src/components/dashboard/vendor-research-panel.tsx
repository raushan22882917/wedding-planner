import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookmarkPlus,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Mail,
  MapPinned,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { upsertVendor } from "@/lib/planner.functions";
import { vendorWhatsAppMessage, whatsappChatUrl } from "@/lib/whatsapp";
import {
  getVendorResearchJob,
  listRecentVendorResearch,
  searchLiveVendorResearch,
  startVendorResearch,
  type ResearchDocument,
  type ResearchRun,
} from "@/lib/research.functions";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Vendor research could not be loaded.";
}

function isPlanLimitError(error: unknown) {
  return /allowance reached|upgrade or add a usage pack/i.test(message(error));
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source link";
  }
}

export function VendorResearchPanel({ defaultQuery = "" }: { defaultQuery?: string }) {
  const queryClient = useQueryClient();
  const startResearch = useServerFn(startVendorResearch);
  const getJob = useServerFn(getVendorResearchJob);
  const recentResearch = useServerFn(listRecentVendorResearch);
  const liveVendorResearch = useServerFn(searchLiveVendorResearch);
  const saveVendor = useServerFn(upsertVendor);
  const [query, setQuery] = useState(defaultQuery);
  const [activeJobId, setActiveJobId] = useState<string>();
  const [liveRun, setLiveRun] = useState<ResearchRun>();
  const completedJob = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!query && defaultQuery) setQuery(defaultQuery);
  }, [defaultQuery, query]);

  const research = useQuery({
    queryKey: ["vendor-research"],
    queryFn: () => recentResearch(),
    retry: false,
  });
  const job = useQuery({
    queryKey: ["vendor-research-job", activeJobId],
    queryFn: () => getJob({ data: { jobId: activeJobId! } }),
    enabled: Boolean(activeJobId),
    retry: false,
    refetchInterval: (jobQuery) =>
      jobQuery.state.data?.status === "queued" || jobQuery.state.data?.status === "running"
        ? 1_500
        : false,
  });

  const start = useMutation({
    mutationFn: (nextQuery: string) => startResearch({ data: { query: nextQuery, maxItems: 6 } }),
    onSuccess: (run) => {
      setLiveRun(undefined);
      completedJob.current = undefined;
      setActiveJobId(run.job.id);
      toast.success("Research job queued", {
        description: "We’ll show verified source results as soon as indexing finishes.",
      });
    },
    onError: (error, nextQuery) => {
      setActiveJobId(undefined);
      setLiveRun(undefined);
      if (isPlanLimitError(error)) {
        toast.error("Vendor research limit reached", {
          description: "Upgrade your plan or add a research pack to continue.",
        });
        return;
      }
      toast.message("Using live Agent Reach sources", {
        description:
          "The database crawler is unavailable, so these results will not be indexed yet.",
      });
      liveSearch.mutate(nextQuery);
    },
  });
  const liveSearch = useMutation({
    mutationFn: (nextQuery: string) => liveVendorResearch({ data: { query: nextQuery } }),
    onSuccess: (run) => {
      setLiveRun(run);
      toast.success("Live source results ready", {
        description: `${run.documents.length} Agent Reach sources are ready to review.`,
      });
    },
    onError: (error) =>
      toast.error("Could not search live sources", { description: message(error) }),
  });
  const save = useMutation({
    mutationFn: ({ document, run }: { document: ResearchDocument; run: ResearchRun }) =>
      saveVendor({
        data: {
          name: document.title.slice(0, 220),
          category: "Research lead",
          contact_phone: document.phones[0] ?? null,
          contact_email: document.emails[0] ?? null,
          website: document.url,
          status: "shortlist",
          notes: `Source: ${document.url}\nResearch: ${run.source.config.query ?? "Vendor research"}\n\n${document.snippet.slice(0, 1_000)}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Saved to your vendor shortlist");
    },
    onError: (error) => toast.error("Could not save vendor", { description: message(error) }),
  });

  useEffect(() => {
    const current = job.data;
    if (!current || (current.status !== "completed" && current.status !== "failed")) return;
    if (completedJob.current === current.id) return;
    completedJob.current = current.id;
    void queryClient.invalidateQueries({ queryKey: ["vendor-research"] });
    if (current.status === "completed") {
      toast.success("Research indexed", {
        description: `${current.documents_created + current.documents_updated} source documents are ready to review.`,
      });
    } else {
      toast.error("Research job failed", {
        description: current.error ?? "Please check the search backend configuration.",
      });
    }
  }, [job.data, queryClient]);

  const isResearching =
    start.isPending ||
    liveSearch.isPending ||
    job.data?.status === "queued" ||
    job.data?.status === "running";
  const jobMessage =
    start.isPending || job.data?.status === "queued"
      ? "Queuing your source search…"
      : job.data?.status === "running"
        ? "Scraping approved sources and extracting details…"
        : liveSearch.isPending
          ? "Searching live public sources through Agent Reach…"
          : null;

  return (
    <section className="soft-card overflow-hidden" aria-labelledby="vendor-research-title">
      <div className="border-b border-border bg-gradient-to-r from-primary/6 via-purple-brand/5 to-transparent p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Source-backed research
            </div>
            <h2 id="vendor-research-title" className="font-display mt-1 text-xl">
              Research vendors with the scraper agent
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Indexed results are saved to your private research library. If the database crawler is
              temporarily unavailable, Agent Reach shows live public sources here instead. Contact
              details appear only when a source contains them.
            </p>
          </div>
          <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isResearching) start.mutate(query);
            }}
          >
            <label className="sr-only" htmlFor="vendor-research-query">
              Vendor research query
            </label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="vendor-research-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-hidden transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. wedding venues in Bhagalpur"
                disabled={isResearching}
              />
            </div>
            <Button
              type="submit"
              className="h-11 shrink-0 rounded-xl"
              disabled={isResearching || query.trim().length < 3}
            >
              {isResearching ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isResearching ? "Researching" : "Research"}
            </Button>
          </form>
        </div>
      </div>

      {jobMessage && (
        <div
          className="flex items-center gap-2 border-b border-border bg-secondary/45 px-5 py-3 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          {jobMessage}
        </div>
      )}
      {job.data?.status === "failed" && (
        <div
          className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/7 px-5 py-3 text-sm text-destructive"
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {job.data.error ??
              "The research job failed. Check the search backend configuration and try again."}
          </span>
        </div>
      )}
      {research.isError && !liveRun && (
        <div
          className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/8 px-5 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {message(research.error)} Live Agent Reach results will appear when you run a new
            search.
          </span>
        </div>
      )}

      <div className="p-5">
        {liveRun && (
          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{liveRun.source.config.query}</div>
                <div className="text-xs text-muted-foreground">
                  {liveRun.documents.length} live Agent Reach sources · not yet saved to the
                  research library
                </div>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
                Live sources
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {liveRun.documents.map((document) => (
                <ResearchResultCard
                  key={document.id}
                  document={document}
                  run={liveRun}
                  saving={save.isPending}
                  onSave={() => save.mutate({ document, run: liveRun })}
                />
              ))}
            </div>
          </div>
        )}
        {research.isLoading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading indexed research…
          </div>
        ) : research.data?.some((run) => run.documents.length > 0) ? (
          <div className="space-y-6">
            {research.data.map((run) =>
              run.documents.length === 0 ? null : (
                <div key={run.source.id}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {run.source.config.query ?? run.source.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {run.documents.length} indexed sources · saved to your private research
                        library
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9 gap-1.5 text-xs"
                      onClick={() => start.mutate(run.source.config.query ?? "")}
                      disabled={isResearching || !run.source.config.query}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {run.documents.map((document) => (
                      <ResearchResultCard
                        key={document.id}
                        document={document}
                        run={run}
                        saving={save.isPending}
                        onSave={() => save.mutate({ document, run })}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        ) : !liveRun ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/25 px-5 py-8 text-center">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No indexed vendor research yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Run a search above. The backend will collect approved public results, index them, and
              make them available to this dashboard and the AI planner.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ResearchResultCard({
  document,
  run,
  saving,
  onSave,
}: {
  document: ResearchDocument;
  run: ResearchRun;
  saving: boolean;
  onSave: () => void;
}) {
  const hasContact = document.phones.length > 0 || document.emails.length > 0;
  const whatsappUrl = document.phones[0]
    ? whatsappChatUrl(document.phones[0], vendorWhatsAppMessage(document.title))
    : null;
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {document.image_url && (
        <img src={document.image_url} alt="" loading="lazy" className="h-32 w-full object-cover" />
      )}
      <div className="space-y-3 p-4">
        <div>
          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary hover:underline"
          >
            {document.title}
          </a>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink className="h-3 w-3" /> {document.source_name ?? hostname(document.url)}
          </div>
        </div>
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {document.description ?? document.snippet}
        </p>
        {hasContact ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-2 text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {document.phones.slice(0, 1).map((phone) => (
              <a
                key={phone}
                href={`tel:${phone}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-secondary px-2 text-foreground hover:bg-primary/10 hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            ))}
            {document.emails.slice(0, 1).map((email) => (
              <a
                key={email}
                href={`mailto:${email}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-secondary px-2 text-foreground hover:bg-primary/10 hover:text-primary"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No contact detail was extracted from this source.
          </p>
        )}
        <a
          href={document.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source: ${document.title}`}
          className="group flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-secondary/35 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">Open source</span>
          <span className="min-w-0 truncate text-[11px] font-normal text-muted-foreground group-hover:text-primary/75">
            {hostname(document.url)}
          </span>
        </a>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          {document.map_url ? (
            <a
              href={document.map_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <MapPinned className="h-3.5 w-3.5" /> Map
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">Source-backed result</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-9 gap-1.5 text-xs"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            Save lead
          </Button>
        </div>
      </div>
    </article>
  );
}
