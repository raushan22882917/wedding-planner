import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleAlert,
  ExternalLink,
  FileSearch,
  Gavel,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile } from "@/lib/profile.functions";
import { selectVendorForWedding, listVendorResearchLeads } from "@/lib/planner.functions";
import { createThread } from "@/lib/threads.functions";

export const Route = createFileRoute("/_app/court-marriage")({
  component: CourtMarriagePage,
});

type ResearchLead = Awaited<ReturnType<typeof listVendorResearchLeads>>[number];

const supportNeeds = [
  "Court marriage process",
  "Document review",
  "Interfaith or interstate marriage",
  "Marriage registration follow-up",
] as const;

function CourtMarriagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const researchFn = useServerFn(listVendorResearchLeads);
  const createThreadFn = useServerFn(createThread);
  const saveLeadFn = useServerFn(selectVendorForWedding);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const research = useQuery({
    queryKey: ["vendor-research-leads"],
    queryFn: () => researchFn(),
    staleTime: 30_000,
  });

  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [need, setNeed] = useState<(typeof supportNeeds)[number]>(supportNeeds[0]);

  useEffect(() => {
    if (!city && profile.data?.city) setCity(profile.data.city);
  }, [city, profile.data?.city]);

  const startResearch = useMutation({
    mutationFn: async () => {
      const location = city.trim();
      if (!location) throw new Error("Add a city to find advocates nearby.");

      const prompt = [
        `Find court marriage advocates near ${location} who can help with ${need.toLowerCase()}.`,
        "Use public, source-backed information only. For each lead, include the advocate or firm name, public practice address, contact method if published, services, published fee information only when stated, and a direct source link.",
        "Do not give legal advice or make eligibility claims. Clearly flag missing or unverified details, and remind me to independently verify Bar Council enrolment, scope, availability, fees, and local requirements before engaging anyone.",
      ].join(" ");
      const thread = await createThreadFn({
        data: { title: `Court marriage advocates in ${location}` },
      });
      return { thread, prompt };
    },
    onSuccess: ({ thread, prompt }) => {
      navigate({
        to: "/planner/$threadId",
        params: { threadId: thread.id },
        search: { q: prompt },
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start advocate research."),
  });

  const saveLead = useMutation({
    mutationFn: (directoryId: string) => saveLeadFn({ data: { directoryId } }),
    onSuccess: ({ created }) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(
        created ? "Advocate contact saved to your shortlist" : "Already in your shortlist",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save this contact."),
  });

  const advocates = useMemo(() => {
    const location = city.trim().toLocaleLowerCase();
    const search = keyword.trim().toLocaleLowerCase();
    return (research.data ?? []).filter((lead) => {
      const details = [
        lead.name,
        lead.category,
        lead.city,
        lead.address,
        lead.summary,
        ...leadServices(lead),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const legalService =
        /advocate|lawyer|legal|court marriage|marriage registration|matrimonial|family law|notary/i.test(
          details,
        );
      const inCity = !location || (lead.city ?? "").toLocaleLowerCase().includes(location);
      return legalService && inCity && (!search || details.includes(search));
    });
  }, [city, keyword, research.data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Court marriage help"
        title="Find an advocate, with the right details"
        subtitle="Search public, source-backed listings near you, then verify the advocate and choose who to contact."
      />

      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-purple-brand/10 p-5 shadow-sm sm:p-7">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-purple-brand/12 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
              <Gavel className="h-3.5 w-3.5" />
              Source-backed legal services research
            </div>
            <h2 className="mt-4 max-w-2xl font-display text-2xl leading-tight sm:text-3xl">
              Start with advocates who practise near you.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              MarryMap can research public listings and place the useful details in one shortlist.
              It does not recommend an advocate or provide legal advice.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-card/80 p-4 backdrop-blur">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Before engaging anyone, independently check their Bar Council enrolment, experience,
                fees, availability, and the rules that apply to your situation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="soft-card overflow-hidden" aria-labelledby="advocate-search-title">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <h2 id="advocate-search-title" className="font-display text-xl">
                Search advocates near you
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Your wedding city is used as a starting point. Change it if you need help in another
                location.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="court-marriage-city">City</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="court-marriage-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Enter city, for example Bhagalpur"
                autoComplete="address-level2"
                className="h-11 pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="court-marriage-keyword">Filter saved results</Label>
            <Input
              id="court-marriage-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Name, firm, or service"
              className="h-11"
            />
          </div>
          <Button
            type="button"
            className="min-h-11 bg-gradient-to-r from-primary to-purple-brand hover:opacity-90"
            disabled={startResearch.isPending}
            onClick={() => startResearch.mutate()}
          >
            {startResearch.isPending ? (
              <>
                <LoaderCircle className="animate-spin" /> Opening research…
              </>
            ) : (
              <>
                <Sparkles /> Research advocates
              </>
            )}
          </Button>
        </div>
        <div className="border-t border-border bg-muted/25 px-5 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What help do you need?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {supportNeeds.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={need === item}
                onClick={() => setNeed(item)}
                className={`min-h-10 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${need === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/35 hover:text-primary"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="nearby-advocates-title">
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Nearby directory
              </p>
              <h2 id="nearby-advocates-title" className="mt-1 font-display text-2xl">
                {city.trim() ? `Advocate leads in ${city.trim()}` : "Advocate leads"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {research.isLoading
                ? "Loading saved research…"
                : `${advocates.length} source-backed lead${advocates.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="mt-4">
            {research.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <LeadSkeleton />
                <LeadSkeleton />
              </div>
            ) : advocates.length === 0 ? (
              <div className="soft-card flex min-h-72 flex-col items-center justify-center p-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileSearch className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-xl">No advocate leads yet</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Start a source-backed search for {city.trim() || "your city"}. Results with public
                  details and direct sources will appear here once the research is complete.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 min-h-11"
                  disabled={startResearch.isPending}
                  onClick={() => startResearch.mutate()}
                >
                  <Sparkles /> Start advocate research
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {advocates.slice(0, 12).map((lead) => (
                  <AdvocateCard
                    key={lead.id}
                    lead={lead}
                    saving={saveLead.isPending && saveLead.variables === lead.id}
                    onSave={() => saveLead.mutate(lead.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
          <section className="soft-card overflow-hidden" aria-labelledby="before-contact-title">
            <div className="border-b border-border bg-gradient-to-r from-purple-brand/8 to-primary/6 px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-brand">
                <UserRoundCheck className="h-4 w-4" /> Contact checklist
              </div>
              <h2 id="before-contact-title" className="mt-2 font-display text-xl">
                Ask before you engage
              </h2>
            </div>
            <ul className="space-y-4 p-5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Confirm the
                advocate&apos;s enrolment and relevant experience.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Agree the scope of work,
                fee, and any extra charges in writing.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Ask which documents and
                local steps apply to your specific case.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Use the source link to
                confirm contact details before sharing personal documents.
              </li>
            </ul>
          </section>

          <section
            className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5"
            aria-label="Legal information notice"
          >
            <div className="flex items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Important</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  MarryMap is not a law firm and cannot advise on legal eligibility or procedure.
                  Listings are research leads, not endorsements.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AdvocateCard({
  lead,
  saving,
  onSave,
}: {
  lead: ResearchLead;
  saving: boolean;
  onSave: () => void;
}) {
  const services = leadServices(lead);
  const sourceUrl = lead.website ?? lead.source_url;
  const hasContact = Boolean(lead.contact_phone || lead.contact_email || lead.maps_url);
  const verification = verificationLabel(lead.verification_status);

  return (
    <article className="soft-card flex min-h-full flex-col overflow-hidden p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Landmark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl leading-tight">{lead.name}</h3>
            {verification && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${verification.tone}`}
              >
                <BadgeCheck className="h-3 w-3" /> {verification.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{lead.category ?? "Legal services"}</p>
        </div>
      </div>

      {(lead.city || lead.address) && (
        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{[lead.address, lead.city].filter(Boolean).join(" · ")}</span>
        </p>
      )}

      {lead.summary && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{lead.summary}</p>
      )}

      {services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {services.slice(0, 4).map((service) => (
            <span
              key={service}
              className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {service}
            </span>
          ))}
          {services.length > 4 && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              +{services.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <Detail label="Published fee" value={lead.price ?? "Ask directly"} />
        <Detail label="Contact details" value={hasContact ? "Available" : "Check source"} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          type="button"
          size="sm"
          className="min-h-10 flex-1"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
          {saving ? "Saving…" : "Save contact"}
        </Button>
        {lead.contact_phone && (
          <a
            href={`tel:${lead.contact_phone}`}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
        {lead.contact_email && (
          <a
            href={`mailto:${lead.contact_email}`}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
        )}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Source
        </a>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/65 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function LeadSkeleton() {
  return <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />;
}

function leadServices(lead: ResearchLead) {
  return Array.isArray(lead.services)
    ? lead.services.filter((service): service is string => typeof service === "string")
    : [];
}

function verificationLabel(status: string | null) {
  if (status === "verified") {
    return { label: "Verified", tone: "bg-emerald-500/10 text-emerald-700" };
  }
  if (status === "source_backed") {
    return { label: "Source-backed", tone: "bg-primary/10 text-primary" };
  }
  if (status === "needs_review") {
    return { label: "Review details", tone: "bg-amber-500/10 text-amber-800" };
  }
  return null;
}
