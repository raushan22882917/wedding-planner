import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Flower2,
  Globe2,
  Heart,
  HeartHandshake,
  ImageUp,
  Loader2,
  MapPin,
  MessageCircleHeart,
  Palette,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Type,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/landing-hero.jpg";
import { PageHeader } from "@/components/app-shell/page-header";
import { TemplateThumbnail } from "@/components/website/template-thumbnail";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Json, Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  getWeddingTemplate,
  isWeddingTemplateId,
  weddingTemplates,
  type WeddingTemplateId,
} from "@/lib/wedding-templates";
import { getMyProfile } from "@/lib/profile.functions";
import {
  getMyWeddingWebsite,
  improveWeddingWebsiteCopy,
  listWeddingRsvps,
  saveWeddingWebsite,
  type WebsiteCeremony,
  type WeddingWebsiteCopyField,
  type WeddingWebsitePayload,
} from "@/lib/wedding-website.functions";

type WebsiteSearch = { edit?: boolean; template?: WeddingTemplateId };

export const Route = createFileRoute("/_app/website")({
  validateSearch: (search: Record<string, unknown>): WebsiteSearch => {
    const template = typeof search.template === "string" ? search.template : "";
    return {
      edit: search.edit === "1" || search.edit === true,
      template: isWeddingTemplateId(template) ? template : undefined,
    };
  },
  component: WeddingWebsitePage,
});

type EditorSection = "design" | "content" | "ceremonies";
type PreviewPage = "home" | "story" | "schedule" | "rsvp";
type WebsiteDraft = WeddingWebsitePayload;
type WebsiteRow = Tables<"wedding_websites">;
type RsvpRow = Tables<"wedding_rsvps">;

const defaultCeremonies: WebsiteCeremony[] = [
  {
    id: "mehendi",
    name: "Mehendi",
    description: "An afternoon of henna, music, and joyful blessings.",
    date: "Friday · 4:00 PM",
    time: "",
    venue: "The Garden Courtyard",
    accepting_rsvps: true,
  },
  {
    id: "sangeet",
    name: "Sangeet",
    description: "An evening of performances, laughter, and dancing together.",
    date: "Saturday · 7:30 PM",
    time: "",
    venue: "The Garden Courtyard",
    accepting_rsvps: true,
  },
  {
    id: "wedding",
    name: "Wedding ceremony",
    description: "Join us as we begin our next chapter surrounded by loved ones.",
    date: "Sunday · 5:30 PM",
    time: "",
    venue: "The Garden Courtyard",
    accepting_rsvps: true,
  },
];

const rasamPresets: WebsiteCeremony[] = [
  {
    id: "roka",
    name: "Roka",
    description: "An intimate gathering to celebrate the beginning of our journey.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "haldi",
    name: "Haldi",
    description: "A bright celebration of turmeric, laughter, and family blessings.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "mehendi",
    name: "Mehendi",
    description: "An afternoon of henna, music, and joyful blessings.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "sangeet",
    name: "Sangeet",
    description: "An evening of performances, laughter, and dancing together.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "cocktail",
    name: "Cocktail night",
    description: "Raise a glass with us before the celebrations begin.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "baraat",
    name: "Baraat",
    description: "A joyful procession of music, colour, and celebration.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "wedding",
    name: "Wedding ceremony",
    description: "Join us as we begin our next chapter surrounded by loved ones.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "reception",
    name: "Reception",
    description: "A warm evening of dinner, music, and celebration with everyone we love.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: true,
  },
  {
    id: "vidaai",
    name: "Vidaai",
    description: "A meaningful farewell as our families send us into this new chapter.",
    date: "Date and time to be announced",
    time: "",
    venue: "Venue to be announced",
    accepting_rsvps: false,
  },
];

const defaultDraft: WebsiteDraft = {
  slug: "our-wedding",
  title: "Our wedding celebration",
  welcome_message: "We cannot wait to celebrate with the people who mean the most to us.",
  couple_story:
    "Join us for a weekend full of love, laughter, and the start of our next chapter together.",
  hero_image_url: heroImage,
  card_design: "editorial",
  published: false,
  ceremonies: defaultCeremonies,
};

function sluggify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseCeremonies(value: unknown): WebsiteCeremony[] {
  if (!Array.isArray(value)) return defaultCeremonies;
  return value.map((item, index) => {
    const ceremony = (item ?? {}) as Partial<WebsiteCeremony>;
    return {
      id: ceremony.id || `event-${index + 1}`,
      name: ceremony.name || "Wedding event",
      description: ceremony.description || "",
      date: ceremony.date || "Date to be announced",
      event_date: ceremony.event_date || undefined,
      time: ceremony.time || "",
      venue: ceremony.venue || "Venue to be announced",
      accepting_rsvps: ceremony.accepting_rsvps !== false,
    };
  });
}

function dateFromKey(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventDateLabel(eventDate: string, time = "") {
  const date = dateFromKey(eventDate);
  if (!date) return "Date to be announced";
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  if (!time) return dateLabel;
  const clock = new Date(`1970-01-01T${time}`);
  const timeLabel = Number.isNaN(clock.getTime())
    ? time
    : new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(clock);
  return `${dateLabel} · ${timeLabel}`;
}

function ceremonyDateLabel(ceremony: WebsiteCeremony) {
  return ceremony.event_date ? eventDateLabel(ceremony.event_date, ceremony.time) : ceremony.date;
}

function fromWebsite(site: WebsiteRow): WebsiteDraft {
  return {
    slug: site.slug || defaultDraft.slug,
    title: site.title || defaultDraft.title,
    welcome_message: site.welcome_message || defaultDraft.welcome_message,
    couple_story: site.couple_story || defaultDraft.couple_story,
    hero_image_url: site.hero_image_url || heroImage,
    card_design: isWeddingTemplateId(site.card_design) ? site.card_design : "editorial",
    published: Boolean(site.published),
    ceremonies: parseCeremonies(site.ceremonies),
  };
}

function ceremonyIds(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function WeddingWebsitePage() {
  const { edit, template } = Route.useSearch();
  return edit || template ? (
    <WeddingWebsiteStudio templateId={template} />
  ) : (
    <WeddingWebsiteTemplateGallery />
  );
}

function WeddingWebsiteTemplateGallery() {
  const siteFn = useServerFn(getMyWeddingWebsite);
  const rsvpsFn = useServerFn(listWeddingRsvps);
  const site = useQuery({
    queryKey: ["wedding-website"],
    queryFn: () => siteFn(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const collections = ["All", ...new Set(weddingTemplates.map((template) => template.collection))];
  const [collection, setCollection] = useState("All");
  const visibleTemplates =
    collection === "All"
      ? weddingTemplates
      : weddingTemplates.filter((template) => template.collection === collection);
  const savedDraft = site.data ? fromWebsite(site.data) : null;
  const rsvps = useQuery({
    queryKey: ["wedding-rsvps"],
    queryFn: () => rsvpsFn(),
    enabled: Boolean(savedDraft),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: savedDraft ? 15_000 : false,
  });
  const rsvpRows = rsvps.data ?? [];
  const rsvpSummary = rsvpRows.reduce(
    (summary, rsvp) => ({
      total: summary.total + 1,
      attending: summary.attending + (rsvp.response === "yes" ? 1 : 0),
      guests: summary.guests + (rsvp.response === "yes" ? rsvp.guest_count : 0),
    }),
    { total: 0, attending: 0, guests: 0 },
  );
  const selectedTemplate = savedDraft ? getWeddingTemplate(savedDraft.card_design) : null;
  const studioHref = selectedTemplate
    ? `/website?template=${selectedTemplate.id}&edit=false`
    : "/website";

  return (
    <div className="space-y-7 p-6 lg:p-8">
      <PageHeader
        eyebrow="Wedding website"
        title="Choose a look for your celebration"
        subtitle="Start with a template, then open the studio to personalise every detail, invite guests, and publish your own link."
        action={
          savedDraft ? (
            <a
              href={studioHref}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Continue editing
            </a>
          ) : undefined
        }
      />

      <section aria-live="polite">
        {site.isLoading && (
          <div className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
            <div className="space-y-3">
              <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
              <div className="h-7 max-w-sm animate-pulse rounded bg-secondary" />
              <div className="h-4 max-w-xl animate-pulse rounded bg-secondary" />
            </div>
          </div>
        )}

        {site.isError && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-5">
            <div className="text-sm font-semibold">We could not load your saved website.</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your invitation is still safe. Try loading the latest database record again.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() => site.refetch()}
              disabled={site.isFetching}
            >
              {site.isFetching ? "Loading…" : "Try again"}
            </Button>
          </div>
        )}

        {savedDraft && selectedTemplate && (
          <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-purple-brand/[0.06] shadow-sm">
            <div className="grid gap-5 p-5 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-center">
              <div className="rounded-2xl border border-border/75 bg-background/70 p-2 shadow-sm">
                <TemplateThumbnail templateId={selectedTemplate.id} compact />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                    Saved from your wedding workspace
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      savedDraft.published
                        ? "bg-success/12 text-success"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        savedDraft.published ? "bg-success" : "bg-muted-foreground/55",
                      )}
                    />
                    {savedDraft.published ? "Published" : "Draft"}
                  </span>
                </div>
                <h2 className="mt-2 truncate font-display text-3xl leading-tight">
                  {savedDraft.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {savedDraft.welcome_message}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-primary" />
                    {selectedTemplate.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    {savedDraft.ceremonies.length} event
                    {savedDraft.ceremonies.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">/w/{savedDraft.slug}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                <a
                  href={studioHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Open AI studio
                  <ChevronRight className="h-4 w-4" />
                </a>
                {savedDraft.published && (
                  <a
                    href={`/w/${savedDraft.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <Eye className="h-4 w-4" />
                    View live site
                  </a>
                )}
              </div>
            </div>
            <div className="border-t border-border/70 bg-background/35 px-5 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11.5px] text-muted-foreground">
                {savedDraft.ceremonies.slice(0, 3).map((ceremony) => (
                  <span key={ceremony.id} className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <strong className="font-medium text-foreground">{ceremony.name}</strong>
                    <span>{ceremonyDateLabel(ceremony)}</span>
                  </span>
                ))}
                {savedDraft.ceremonies.length > 3 && (
                  <span>+{savedDraft.ceremonies.length - 3} more saved events</span>
                )}
              </div>
            </div>
          </section>
        )}

        {!site.isLoading && !site.isError && !savedDraft && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            No invitation has been saved yet. Pick a template below to create your first draft.
          </div>
        )}
      </section>

      {savedDraft && (
        <section
          aria-labelledby="saved-rsvp-heading"
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
        >
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircleHeart className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                  Guest replies
                </div>
                <h2 id="saved-rsvp-heading" className="mt-1 font-display text-2xl">
                  RSVPs saved from your invitation
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Every submitted name, contact detail, response, party size, note, and ceremony
                  selection is stored here for your wedding team.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-[12px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Refreshes automatically
            </span>
          </div>

          <div className="grid border-b border-border sm:grid-cols-3">
            {[
              { label: "Replies saved", value: rsvpSummary.total },
              { label: "Joyfully attending", value: rsvpSummary.attending },
              { label: "Expected guests", value: rsvpSummary.guests },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-5"
              >
                <div className="font-display text-3xl leading-none">{stat.value}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {rsvps.isLoading ? (
              <div className="space-y-3" aria-label="Loading saved RSVP replies">
                <div className="h-20 animate-pulse rounded-2xl bg-secondary" />
                <div className="h-20 animate-pulse rounded-2xl bg-secondary" />
              </div>
            ) : rsvps.isError ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-4 text-sm">
                <div className="font-semibold">We could not load the saved replies.</div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 min-h-10"
                  onClick={() => rsvps.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : rsvpRows.length ? (
              <div className="space-y-3">
                {rsvpRows.slice(0, 6).map((rsvp) => {
                  const ceremonyNames = ceremonyIds(rsvp.ceremonies)
                    .map((id) => savedDraft.ceremonies.find((ceremony) => ceremony.id === id)?.name)
                    .filter((name): name is string => Boolean(name));
                  const contact = [rsvp.email, rsvp.phone].filter(Boolean).join(" · ");
                  const responseLabel =
                    rsvp.response === "yes"
                      ? "Joyfully attending"
                      : rsvp.response === "maybe"
                        ? "Maybe"
                        : "Cannot attend";
                  return (
                    <article key={rsvp.id} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{rsvp.name}</h3>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                                rsvp.response === "yes"
                                  ? "bg-success/10 text-success"
                                  : rsvp.response === "maybe"
                                    ? "bg-purple-brand/10 text-purple-brand"
                                    : "bg-secondary text-muted-foreground",
                              )}
                            >
                              {responseLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {rsvp.response === "yes"
                              ? `${rsvp.guest_count} guest${rsvp.guest_count === 1 ? "" : "s"}`
                              : "Response recorded"}
                            {contact ? ` · ${contact}` : ""}
                          </p>
                        </div>
                        <time
                          className="shrink-0 text-[11px] text-muted-foreground"
                          dateTime={rsvp.created_at}
                        >
                          {new Date(rsvp.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                      {ceremonyNames.length > 0 && (
                        <p className="mt-3 text-[12px] text-muted-foreground">
                          <strong className="font-semibold text-foreground">Attending: </strong>
                          {ceremonyNames.join(", ")}
                        </p>
                      )}
                      {rsvp.message && (
                        <p className="mt-2 rounded-xl bg-secondary/65 p-3 text-[12px] leading-5 text-muted-foreground">
                          {rsvp.message}
                        </p>
                      )}
                    </article>
                  );
                })}
                {rsvpRows.length > 6 && (
                  <p className="text-center text-[12px] text-muted-foreground">
                    Showing the 6 newest replies. All {rsvpRows.length} replies remain safely saved.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/25 p-5 text-sm text-muted-foreground">
                No RSVP replies yet. Once your invitation is published, guest responses will show up
                here automatically.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-purple-brand/[0.07] p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
              Website concierge
            </div>
            <h2 className="mt-1 font-display text-2xl">Need a completely custom invitation?</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Send your design brief to the admin team. Your saved wedding website is linked to the
              request, and you can follow every status update inside MarryMap.
            </p>
          </div>
        </div>
        <a
          href="/website/custom-request"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Connect with admin
          <ChevronRight className="h-4 w-4" />
        </a>
      </section>

      <section aria-labelledby="template-library-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="template-library-heading" className="font-display text-3xl">
              Template library
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a starting point. You can change the content, cover photo, ceremony schedule,
              colours, and public link next.
            </p>
          </div>
          <span className="text-[12px] font-medium text-muted-foreground">
            {visibleTemplates.length} of {weddingTemplates.length} designs
          </span>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Template collections">
          {collections.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={collection === item}
              onClick={() => setCollection(item)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-[12px] font-medium transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                collection === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleTemplates.map((template) => {
            const isCurrent = site.data?.card_design === template.id;
            return (
              <a
                key={template.id}
                href={`/website?template=${template.id}`}
                className="group rounded-2xl border border-border bg-card p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <TemplateThumbnail templateId={template.id} />
                <div className="mt-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{template.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span>{template.collection}</span>
                  <span className="text-primary">Customise</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WeddingWebsiteStudio({ templateId }: { templateId?: WeddingTemplateId }) {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const siteFn = useServerFn(getMyWeddingWebsite);
  const rsvpsFn = useServerFn(listWeddingRsvps);
  const saveFn = useServerFn(saveWeddingWebsite);
  const improveCopyFn = useServerFn(improveWeddingWebsiteCopy);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const site = useQuery({ queryKey: ["wedding-website"], queryFn: () => siteFn() });
  const rsvps = useQuery({ queryKey: ["wedding-rsvps"], queryFn: () => rsvpsFn() });
  const [draft, setDraft] = useState<WebsiteDraft>(defaultDraft);
  const [section, setSection] = useState<EditorSection>("design");
  const [previewPage, setPreviewPage] = useState<PreviewPage>("home");
  const [aiField, setAiField] = useState<WeddingWebsiteCopyField>("welcome_message");
  const [aiInstruction, setAiInstruction] = useState("");
  const initializedProfile = useRef(false);

  useEffect(() => {
    if (!site.data) return;
    const savedDraft = fromWebsite(site.data);
    setDraft(templateId ? { ...savedDraft, card_design: templateId } : savedDraft);
  }, [site.data, templateId]);

  useEffect(() => {
    if (site.data || !templateId) return;
    setDraft((current) =>
      current.card_design === templateId ? current : { ...current, card_design: templateId },
    );
  }, [site.data, templateId]);

  useEffect(() => {
    if (site.data || !profile.data || initializedProfile.current) return;
    initializedProfile.current = true;
    const profileData = profile.data;
    const names = [profileData.partner_one, profileData.partner_two].filter(Boolean).join(" & ");
    const date = profileData.wedding_date
      ? new Date(`${profileData.wedding_date}T12:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    setDraft((current) => ({
      ...current,
      title: names ? `${names}' wedding` : current.title,
      slug: names ? sluggify(names) || current.slug : current.slug,
      welcome_message: names
        ? `We cannot wait to celebrate our wedding${date ? ` on ${date}` : ""} with the people who mean the most to us.`
        : current.welcome_message,
      ceremonies: current.ceremonies.map((ceremony) => {
        const eventDate = ceremony.id === "wedding" ? profileData.wedding_date : undefined;
        return {
          ...ceremony,
          venue: profileData.venue || ceremony.venue,
          ...(eventDate
            ? {
                event_date: eventDate,
                date: eventDateLabel(eventDate, ceremony.time),
              }
            : {}),
        };
      }),
    }));
  }, [profile.data, site.data]);

  const save = useMutation({
    mutationFn: (payload: WebsiteDraft) => saveFn({ data: payload }),
    onSuccess: (saved) => {
      setDraft(fromWebsite(saved));
      qc.setQueryData(["wedding-website"], saved);
      toast.success(saved.published ? "Your wedding site is live" : "Website draft saved");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save the website"),
  });

  const aiCopy = useMutation({
    mutationFn: ({ field, instruction }: { field: WeddingWebsiteCopyField; instruction: string }) =>
      improveCopyFn({
        data: {
          field,
          instruction,
          currentValue: draft[field],
          templateName: getWeddingTemplate(draft.card_design).name,
        },
      }),
    onSuccess: ({ text }, { field }) => {
      setDraft((current) => ({ ...current, [field]: text }));
      setAiInstruction("");
      toast.success("AI copy added to your draft");
    },
    onError: (error: Error) => toast.error(error.message || "Could not improve that copy"),
  });

  const replies = useMemo<RsvpRow[]>(() => rsvps.data ?? [], [rsvps.data]);
  const responseSummary = useMemo(() => {
    const yes = replies.filter((reply) => reply.response === "yes");
    return {
      received: replies.length,
      attending: yes.reduce((total, reply) => total + Number(reply.guest_count || 1), 0),
      maybe: replies.filter((reply) => reply.response === "maybe").length,
      declined: replies.filter((reply) => reply.response === "no").length,
    };
  }, [replies]);

  const shareUrl =
    typeof window === "undefined"
      ? `/w/${draft.slug}`
      : `${window.location.origin}/w/${draft.slug}`;

  const saveDraft = (publish?: boolean) => {
    const cleanSlug = sluggify(draft.slug);
    const payload = { ...draft, slug: cleanSlug, published: publish ?? draft.published };
    setDraft(payload);
    save.mutate(payload);
  };

  const copyLink = async () => {
    if (!draft.published) {
      toast.message("Publish your invitation before sharing its link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Invitation link copied");
    } catch {
      toast.message("Copy this link", { description: shareUrl });
    }
  };

  const updateCeremony = (id: string, patch: Partial<WebsiteCeremony>) => {
    setDraft((current) => ({
      ...current,
      ceremonies: current.ceremonies.map((ceremony) =>
        ceremony.id === id ? { ...ceremony, ...patch } : ceremony,
      ),
    }));
  };

  const selectedRasamIds = new Set(draft.ceremonies.map((ceremony) => ceremony.id));
  const addRasam = (rasam: WebsiteCeremony) => {
    if (selectedRasamIds.has(rasam.id)) return;
    setDraft((current) => ({
      ...current,
      ceremonies: [...current.ceremonies, { ...rasam }],
    }));
  };

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Choose an image smaller than 1.5 MB for this invitation.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((current) => ({ ...current, hero_image_url: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  if (templateId) {
    const aiFields: Array<{ id: WeddingWebsiteCopyField; label: string; helper: string }> = [
      {
        id: "welcome_message",
        label: "Welcome message",
        helper: "The opening words guests see first.",
      },
      {
        id: "couple_story",
        label: "Our story",
        helper: "The personal note on your invitation.",
      },
      {
        id: "title",
        label: "Invitation title",
        helper: "Names and the celebration headline.",
      },
    ];
    const activeAiField = aiFields.find((field) => field.id === aiField) ?? aiFields[0];

    return (
      <div className="min-h-[calc(100dvh-4rem)] bg-gradient-to-br from-background via-background to-primary/[0.025] p-4 sm:p-6 lg:p-8">
        <header className="mx-auto flex max-w-[1500px] flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/website"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Back to template library"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                AI invitation studio
              </div>
              <h1 className="mt-1 font-display text-2xl leading-none sm:text-3xl">
                {getWeddingTemplate(draft.card_design).name}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "mr-1 inline-flex items-center gap-1.5 text-[12px] font-medium",
                draft.published ? "text-success" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  draft.published ? "bg-success" : "bg-muted-foreground/45",
                )}
              />
              {draft.published ? "Live" : "Draft"}
            </span>
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => saveDraft()}
              disabled={save.isPending}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              className="min-h-11 rounded-xl"
              onClick={() => saveDraft(true)}
              disabled={save.isPending}
            >
              <Send className="h-4 w-4" />
              {draft.published ? "Update live site" : "Publish site"}
            </Button>
          </div>
        </header>

        <div className="mx-auto mt-6 grid max-w-[1500px] gap-6 xl:grid-cols-[minmax(21rem,0.8fr)_minmax(0,1.7fr)]">
          <aside className="flex min-h-[640px] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[0_20px_55px_-42px_rgba(35,24,32,0.45)] xl:min-h-[calc(100dvh-12rem)]">
            <div className="border-b border-border bg-gradient-to-br from-primary/[0.09] via-card to-purple-brand/[0.07] p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                    MarryMap AI
                  </div>
                  <h2 className="mt-0.5 font-display text-2xl leading-none">
                    Your website co-pilot
                  </h2>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Tell AI what you want to change. It updates the invitation preview first, so you can
                save only when it feels right.
              </p>
            </div>

            <div className="flex-1 space-y-6 p-5">
              <fieldset>
                <legend className="text-sm font-semibold">What should AI improve?</legend>
                <div className="mt-3 space-y-2">
                  {aiFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      aria-pressed={aiField === field.id}
                      onClick={() => setAiField(field.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ring",
                        aiField === field.id
                          ? "border-primary/35 bg-primary/[0.06] shadow-sm"
                          : "border-border bg-background hover:border-primary/25 hover:bg-secondary/60",
                      )}
                    >
                      <div className="text-[13px] font-semibold">{field.label}</div>
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {field.helper}
                      </div>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <Label htmlFor="website-ai-request" className="text-sm font-semibold">
                  Tell AI what you want
                </Label>
                <Textarea
                  id="website-ai-request"
                  className="mt-2 min-h-36 resize-none text-sm leading-6"
                  value={aiInstruction}
                  onChange={(event) => setAiInstruction(event.target.value)}
                  placeholder={`For ${activeAiField.label.toLowerCase()}: e.g. make it warm, modern, and suitable for a three-day family celebration.`}
                />
                <div className="mt-3 flex flex-wrap gap-2" aria-label="AI prompt ideas">
                  {[
                    "Make it warm and elegant",
                    "Use a modern Indian tone",
                    "Keep it short and heartfelt",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setAiInstruction(suggestion)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-4 min-h-11 w-full rounded-xl"
                  disabled={!aiInstruction.trim() || aiCopy.isPending}
                  onClick={() => aiCopy.mutate({ field: aiField, instruction: aiInstruction })}
                >
                  {aiCopy.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {aiCopy.isPending ? "Updating your preview…" : "Apply AI update"}
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-secondary/45 p-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold">
                  <Eye className="h-4 w-4 text-primary" />
                  Preview before publishing
                </div>
                <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
                  AI never publishes changes automatically. Review the right-side preview, then
                  choose Save draft or Publish site.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Live guest preview
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  See each part of the invitation exactly as your guests will.
                </p>
              </div>
              <div
                className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/55 p-1"
                aria-label="Preview guest pages"
              >
                {(
                  [
                    ["home", "Welcome"],
                    ["story", "Story"],
                    ["schedule", "Schedule"],
                    ["rsvp", "RSVP"],
                  ] as const
                ).map(([page, label]) => (
                  <button
                    key={page}
                    type="button"
                    aria-pressed={previewPage === page}
                    onClick={() => setPreviewPage(page)}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-ring",
                      previewPage === page
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <WebsitePreview draft={draft} page={previewPage} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Wedding website"
        title="Make this invitation yours"
        subtitle="Edit every detail yourself, ask AI to refine the wording, then publish one shareable link for your guests."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/website"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition hover:bg-secondary"
            >
              <ChevronLeft className="h-4 w-4" />
              Templates
            </Link>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => saveDraft()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              className="rounded-full"
              onClick={() => saveDraft(true)}
              disabled={save.isPending}
            >
              <Send className="h-4 w-4" />
              {draft.published ? "Update live site" : "Publish site"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={Globe2}
          label="Site status"
          value={draft.published ? "Live" : "Draft"}
          tone={draft.published ? "success" : "muted"}
        />
        <Metric
          icon={MessageCircleHeart}
          label="Replies received"
          value={String(responseSummary.received)}
          tone="rose"
        />
        <Metric
          icon={Users}
          label="Guests attending"
          value={String(responseSummary.attending)}
          tone="purple"
        />
        <Metric
          icon={CalendarDays}
          label="Ceremonies"
          value={String(draft.ceremonies.filter((ceremony) => ceremony.accepting_rsvps).length)}
          tone="gold"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_19rem]">
        <aside className="soft-card h-fit overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Build your invitation
            </div>
            <div className="mt-1 font-display text-xl">Design studio</div>
          </div>
          <div className="p-3">
            <nav
              className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1"
              aria-label="Website editor"
            >
              <EditorNavButton
                active={section === "design"}
                icon={Palette}
                label="Design"
                onClick={() => setSection("design")}
              />
              <EditorNavButton
                active={section === "content"}
                icon={Type}
                label="Content"
                onClick={() => setSection("content")}
              />
              <EditorNavButton
                active={section === "ceremonies"}
                icon={CalendarDays}
                label="Events"
                onClick={() => setSection("ceremonies")}
              />
            </nav>

            {section === "design" && (
              <div className="space-y-5">
                <div>
                  <Label className="text-[12px]">Website template</Label>
                  <div className="mt-2 rounded-xl border border-border p-2.5">
                    <TemplateThumbnail templateId={draft.card_design} compact />
                    <div className="mt-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold">
                          {getWeddingTemplate(draft.card_design).name}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {getWeddingTemplate(draft.card_design).description}
                        </div>
                      </div>
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                  </div>
                  <Link
                    to="/website"
                    className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-[12px] font-medium transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Change template
                  </Link>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                    Pick any design to load it into this studio, then customise its words, image,
                    events, and link.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-image" className="text-[12px]">
                    Hero image
                  </Label>
                  <Input
                    id="hero-image"
                    value={draft.hero_image_url ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, hero_image_url: event.target.value }))
                    }
                    placeholder="Paste an image URL"
                  />
                  <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[12px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                    <ImageUp className="h-3.5 w-3.5" />
                    Upload a cover image
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={uploadImage}
                    />
                  </label>
                  <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                    Use a landscape image. Uploads under 1.5 MB are stored with this site.
                  </p>
                </div>
                <div className="rounded-xl border border-gold-brand/25 bg-gold-brand/8 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  <Sparkles className="mb-1.5 h-4 w-4 text-gold-brand" />
                  Your chosen look is also used for the digital wedding card below.
                </div>
              </div>
            )}

            {section === "content" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="site-title" className="text-[12px]">
                    Names / invitation title
                  </Label>
                  <Input
                    id="site-title"
                    className="mt-1.5"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="welcome" className="text-[12px]">
                    Welcome message
                  </Label>
                  <Textarea
                    id="welcome"
                    className="mt-1.5 min-h-22"
                    value={draft.welcome_message}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, welcome_message: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="story" className="text-[12px]">
                    Your story
                  </Label>
                  <Textarea
                    id="story"
                    className="mt-1.5 min-h-28"
                    value={draft.couple_story}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, couple_story: event.target.value }))
                    }
                  />
                </div>
                <div className="rounded-xl border border-purple-brand/20 bg-gradient-to-br from-purple-brand/8 to-primary/6 p-3">
                  <div className="flex items-center gap-2 text-[12px] font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-purple-brand/12 text-purple-brand">
                      <Wand2 className="h-3.5 w-3.5" />
                    </span>
                    AI copy editor
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                    Describe the tone or details you want. AI updates the selected field, and you
                    can always edit the result manually.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-card/70 p-1">
                    {(
                      [
                        ["title", "Title"],
                        ["welcome_message", "Welcome"],
                        ["couple_story", "Story"],
                      ] as const
                    ).map(([field, label]) => (
                      <button
                        key={field}
                        type="button"
                        aria-pressed={aiField === field}
                        onClick={() => setAiField(field)}
                        className={cn(
                          "h-9 rounded-md text-[10px] font-medium transition",
                          aiField === field
                            ? "bg-card text-purple-brand shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    aria-label="AI editing instruction"
                    className="mt-2 min-h-18 bg-card/80 text-[11.5px]"
                    value={aiInstruction}
                    onChange={(event) => setAiInstruction(event.target.value)}
                    placeholder="e.g. Make it warm, modern, and mention a three-day celebration"
                  />
                  <Button
                    type="button"
                    className="mt-2 h-10 w-full rounded-lg bg-purple-brand text-[12px] text-white hover:bg-purple-brand/90"
                    disabled={!aiInstruction.trim() || aiCopy.isPending}
                    onClick={() => aiCopy.mutate({ field: aiField, instruction: aiInstruction })}
                  >
                    {aiCopy.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {aiCopy.isPending ? "Writing…" : "Rewrite with AI"}
                  </Button>
                </div>
                <div>
                  <Label htmlFor="slug" className="text-[12px]">
                    Invitation link
                  </Label>
                  <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring/35">
                    <span className="shrink-0 text-[11px] text-muted-foreground">/w/</span>
                    <input
                      id="slug"
                      value={draft.slug}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, slug: sluggify(event.target.value) }))
                      }
                      className="h-10 min-w-0 flex-1 bg-transparent pl-1 text-[13px] outline-hidden"
                    />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                    A simple link makes it easy to share over WhatsApp or email.
                  </p>
                </div>
              </div>
            )}

            {section === "ceremonies" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-secondary/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  Choose the rasams you want to share. Every selected rasam appears as its own
                  section on your invitation; RSVP collection is optional for each one.
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-[12px] font-semibold">Choose your rasams</div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                    Add the traditions that are part of your celebration, then personalise every
                    section below.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rasamPresets.map((rasam) => {
                      const isSelected = selectedRasamIds.has(rasam.id);
                      return (
                        <Button
                          key={rasam.id}
                          type="button"
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-8 rounded-full px-3 text-[10.5px]"
                          disabled={isSelected}
                          onClick={() => addRasam(rasam)}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {rasam.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {draft.ceremonies.map((ceremony) => (
                  <div key={ceremony.id} className="rounded-xl border border-border p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <Input
                        aria-label="Ceremony name"
                        className="h-8 border-0 bg-secondary px-2 text-[12px] font-semibold shadow-none"
                        value={ceremony.name}
                        onChange={(event) =>
                          updateCeremony(ceremony.id, { name: event.target.value })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${ceremony.name}`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            ceremonies: current.ceremonies.filter(
                              (item) => item.id !== ceremony.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <CeremonyDateTimePicker
                      ceremony={ceremony}
                      onChange={(patch) => updateCeremony(ceremony.id, patch)}
                    />
                    <Input
                      aria-label={`${ceremony.name} venue`}
                      className="h-8 text-[11.5px]"
                      value={ceremony.venue}
                      onChange={(event) =>
                        updateCeremony(ceremony.id, { venue: event.target.value })
                      }
                      placeholder="Venue"
                    />
                    <div className="mt-2">
                      <Label
                        htmlFor={`${ceremony.id}-description`}
                        className="text-[10.5px] text-muted-foreground"
                      >
                        Rasam introduction
                      </Label>
                      <Textarea
                        id={`${ceremony.id}-description`}
                        className="mt-1 min-h-16 text-[11.5px]"
                        value={ceremony.description}
                        onChange={(event) =>
                          updateCeremony(ceremony.id, { description: event.target.value })
                        }
                        placeholder="Tell guests what makes this moment special"
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>Collect RSVPs</span>
                      <Switch
                        checked={ceremony.accepting_rsvps}
                        onCheckedChange={(checked) =>
                          updateCeremony(ceremony.id, { accepting_rsvps: checked })
                        }
                        aria-label={`Collect RSVPs for ${ceremony.name}`}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full rounded-lg"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      ceremonies: [
                        ...current.ceremonies,
                        {
                          id: `event-${Date.now()}`,
                          name: "New rasam",
                          description: "A beautiful moment in our wedding celebration.",
                          date: "Date to be announced",
                          time: "",
                          venue: "Venue",
                          accepting_rsvps: true,
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add custom rasam
                </Button>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Live preview
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                Changes appear here before you publish.
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                onClick={() =>
                  draft.published
                    ? window.open(`/w/${draft.slug}`, "_blank", "noopener,noreferrer")
                    : toast.message("Publish the site to open the guest view.")
                }
              >
                <Eye className="h-3.5 w-3.5" />
                Guest view
              </button>
            </div>
          </div>
          <div
            className="mb-3 flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/50 p-1"
            aria-label="Preview guest pages"
          >
            {(
              [
                ["home", "Welcome"],
                ["story", "Story"],
                ["schedule", "Schedule"],
                ["rsvp", "RSVP"],
              ] as const
            ).map(([page, label]) => (
              <button
                key={page}
                type="button"
                aria-pressed={previewPage === page}
                onClick={() => setPreviewPage(page)}
                className={cn(
                  "h-8 rounded-lg px-3 text-[10.5px] font-medium transition focus:outline-none focus:ring-2 focus:ring-ring",
                  previewPage === page
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <WebsitePreview draft={draft} page={previewPage} />
          <div className="mt-5">
            <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Digital invitation card
            </div>
            <InvitationCard draft={draft} />
          </div>
        </main>

        <aside className="space-y-4">
          <div className="soft-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Share invitation
                </div>
                <div className="mt-1 font-display text-lg">Send it your way</div>
              </div>
              <div
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl",
                  draft.published
                    ? "bg-success/12 text-success"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Globe2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-secondary/60 p-2.5">
              <div className="truncate text-[11.5px] text-muted-foreground">{shareUrl}</div>
            </div>
            <Button className="mt-3 w-full rounded-lg" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Copy invitation link
            </Button>
            <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
              {draft.published
                ? "Your guests can now respond on this page."
                : "Publish the page when the details are ready."}
            </p>
          </div>

          <div className="soft-card overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    RSVP pulse
                  </div>
                  <div className="mt-1 font-display text-lg">Guest responses</div>
                </div>
                <MessageCircleHeart className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <TinyMetric label="Coming" value={String(responseSummary.attending)} />
              <TinyMetric label="Maybe" value={String(responseSummary.maybe)} />
              <TinyMetric label="No" value={String(responseSummary.declined)} />
            </div>
            <div className="divide-y divide-border">
              {draft.ceremonies
                .filter((ceremony) => ceremony.accepting_rsvps)
                .map((ceremony) => {
                  const heads = replies
                    .filter(
                      (reply) =>
                        reply.response === "yes" &&
                        ceremonyIds(reply.ceremonies).includes(ceremony.id),
                    )
                    .reduce((sum, reply) => sum + Number(reply.guest_count || 1), 0);
                  return (
                    <div key={ceremony.id} className="flex items-center gap-3 p-3.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/8 text-primary">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium">{ceremony.name}</div>
                        <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                          {heads} guest{heads === 1 ? "" : "s"} attending
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-brand/15 bg-gradient-to-br from-purple-brand/8 to-primary/8 p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <Sparkles className="h-4 w-4 text-purple-brand" />
              Thoughtful by default
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Every response records the guest, party size, note, and the ceremonies they plan to
              attend.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EditorNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Palette;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium transition",
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="mb-0.5 h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  tone: "success" | "muted" | "rose" | "purple" | "gold";
}) {
  const tones = {
    success: "bg-success/12 text-success",
    muted: "bg-secondary text-muted-foreground",
    rose: "bg-primary/8 text-primary",
    purple: "bg-purple-brand/10 text-purple-brand",
    gold: "bg-gold-brand/15 text-gold-brand",
  };
  return (
    <div className="soft-card p-3.5">
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-3 font-display text-xl leading-none">{value}</div>
      <div className="mt-1 text-[10.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

function TinyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 text-center">
      <div className="font-display text-lg leading-none">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CeremonyDateTimePicker({
  ceremony,
  onChange,
}: {
  ceremony: WebsiteCeremony;
  onChange: (patch: Partial<WebsiteCeremony>) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = dateFromKey(ceremony.event_date);
  return (
    <div className="mb-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
      <div>
        <Label className="mb-1 block text-[10.5px] text-muted-foreground">Date</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full justify-start px-2 text-left text-[11.5px] font-normal"
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-primary" />
              {selectedDate ? eventDateLabel(ceremony.event_date ?? "") : "Choose a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) return;
                const eventDate = toDateKey(date);
                onChange({
                  event_date: eventDate,
                  date: eventDateLabel(eventDate, ceremony.time),
                });
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label
          htmlFor={`${ceremony.id}-time`}
          className="mb-1 block text-[10.5px] text-muted-foreground"
        >
          Time
        </Label>
        <Input
          id={`${ceremony.id}-time`}
          type="time"
          className="h-8 text-[11.5px]"
          value={ceremony.time}
          onChange={(event) => {
            const time = event.target.value;
            onChange({
              time,
              date: ceremony.event_date ? eventDateLabel(ceremony.event_date, time) : ceremony.date,
            });
          }}
        />
      </div>
    </div>
  );
}

function WebsitePreview({ draft, page }: { draft: WebsiteDraft; page: PreviewPage }) {
  const [imageFailed, setImageFailed] = useState(false);
  const template = getWeddingTemplate(draft.card_design);
  const sideAligned = template.layout === "split";
  const previewNavigation: Array<{ id: PreviewPage; label: string }> = [
    { id: "home", label: "Home" },
    { id: "story", label: "Story" },
    { id: "schedule", label: "Schedule" },
    { id: "rsvp", label: "RSVP" },
  ];
  return (
    <section
      className={cn(
        "relative min-h-[620px] overflow-hidden rounded-[1.75rem] border border-border shadow-[0_30px_70px_-35px_rgba(30,20,20,0.4)]",
        template.surface,
        template.text,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-[43%] overflow-hidden">
        {draft.hero_image_url && !imageFailed ? (
          <img
            src={draft.hero_image_url}
            alt="Wedding website cover"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={cn("h-full w-full bg-gradient-to-br", template.heroFallback)} />
        )}
        <div className={cn("absolute inset-0 bg-gradient-to-t", template.heroOverlay)} />
      </div>
      <div
        className={cn(
          "relative z-10 flex h-14 items-center justify-between border-b px-5 text-[10px] backdrop-blur-sm",
          template.border,
          template.mode === "dark" ? "bg-black/10" : "bg-white/45",
        )}
      >
        <span className={cn("inline-flex items-center gap-1.5 font-semibold", template.heading)}>
          <Flower2 className={cn("h-3.5 w-3.5", template.accent)} />
          Our celebration
        </span>
        <span className={cn("hidden items-center gap-3 sm:inline-flex", template.muted)}>
          {previewNavigation.map((item) => (
            <span key={item.id} className={page === item.id ? "font-semibold" : undefined}>
              {item.label}
            </span>
          ))}
        </span>
        <span className={cn("font-medium uppercase tracking-[0.16em]", template.accent)}>
          {previewNavigation.find((item) => item.id === page)?.label}
        </span>
      </div>
      <div
        className={cn(
          "relative mx-auto flex min-h-[620px] max-w-2xl flex-col px-6 pb-8 pt-40 sm:px-12",
          sideAligned ? "items-start text-left" : "items-center text-center",
        )}
      >
        {page === "home" && (
          <>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                template.chip,
                !sideAligned && "mx-auto",
              )}
            >
              <Flower2 className="h-3 w-3" />
              Save the date
            </div>
            <h2 className={cn("mt-5 text-4xl leading-tight sm:text-5xl", template.heading)}>
              {draft.title}
            </h2>
            <p
              className={cn(
                "mt-4 max-w-lg text-sm leading-relaxed",
                template.muted,
                !sideAligned && "mx-auto",
              )}
            >
              {draft.welcome_message}
            </p>
            {draft.ceremonies[0] && (
              <article
                className={cn("mt-8 w-full rounded-2xl border p-4 text-left", template.card)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={cn("text-lg", template.heading)}>
                      {draft.ceremonies[0].name}
                    </div>
                    <div className={cn("mt-1 text-[11px]", template.muted)}>
                      {ceremonyDateLabel(draft.ceremonies[0])}
                    </div>
                  </div>
                  <CalendarDays className={cn("h-5 w-5", template.accent)} />
                </div>
              </article>
            )}
          </>
        )}

        {page === "story" && (
          <div className={cn("w-full max-w-xl rounded-3xl border p-6 sm:p-8", template.card)}>
            <div
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.2em]",
                template.accent,
              )}
            >
              Our story
            </div>
            <h2 className={cn("mt-4 text-4xl leading-tight", template.heading)}>
              A celebration of us
            </h2>
            <p className={cn("mt-5 text-sm leading-7", template.muted)}>{draft.couple_story}</p>
            <div className={cn("mt-7 border-t pt-4 text-[11px]", template.border, template.muted)}>
              {draft.welcome_message}
            </div>
          </div>
        )}

        {page === "schedule" && (
          <div className="w-full text-left">
            <div
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.2em]",
                template.accent,
              )}
            >
              Our celebrations
            </div>
            <h2 className={cn("mt-3 text-4xl leading-tight", template.heading)}>The schedule</h2>
            <div className="mt-6 space-y-3">
              {draft.ceremonies.map((ceremony, index) => (
                <article
                  key={ceremony.id}
                  className={cn(
                    "rounded-2xl border p-4 sm:flex sm:items-center sm:gap-5",
                    template.card,
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                      template.mode === "dark" ? "bg-white/10" : "bg-current/8",
                      template.accent,
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-3 min-w-0 flex-1 sm:mt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className={cn("text-xl", template.heading)}>{ceremony.name}</h3>
                      <span className={cn("text-[10.5px]", template.muted)}>
                        {ceremonyDateLabel(ceremony)}
                      </span>
                    </div>
                    <p className={cn("mt-2 flex items-center gap-1 text-[10.5px]", template.muted)}>
                      <MapPin className="h-3 w-3" />
                      {ceremony.venue}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {page === "rsvp" && (
          <div
            className={cn("w-full max-w-md rounded-3xl border p-6 text-left sm:p-8", template.card)}
          >
            <div
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.2em]",
                template.accent,
              )}
            >
              You are invited
            </div>
            <h2 className={cn("mt-3 text-4xl leading-tight", template.heading)}>
              Will you join us?
            </h2>
            <p className={cn("mt-3 text-sm leading-6", template.muted)}>
              Guests can reply for each ceremony, add their party size, and leave a note for you.
            </p>
            <div className="mt-6 space-y-3">
              <div
                className={cn(
                  "h-10 rounded-xl border px-3 py-3 text-[11px]",
                  template.border,
                  template.muted,
                )}
              >
                Your name
              </div>
              <div
                className={cn(
                  "h-10 rounded-xl border px-3 py-3 text-[11px]",
                  template.border,
                  template.muted,
                )}
              >
                Email or phone
              </div>
              <div
                className={cn(
                  "inline-flex rounded-full px-4 py-2.5 text-[12px] font-semibold",
                  template.button,
                )}
              >
                Send RSVP
              </div>
            </div>
          </div>
        )}
        <div className="mt-auto pt-9">
          <div
            className={cn(
              "mt-7 flex items-center justify-between border-t pt-4 text-[10px]",
              template.border,
              template.muted,
            )}
          >
            <span>Made with MarryMap</span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3 fill-current" />
              With love
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InvitationCard({ draft }: { draft: WebsiteDraft }) {
  const template = getWeddingTemplate(draft.card_design);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-sm",
        template.surface,
        template.text,
        template.border,
      )}
    >
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-current opacity-[0.06]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={cn("text-[9px] font-semibold uppercase tracking-[0.2em]", template.accent)}
          >
            {template.collection === "Garden"
              ? "A garden celebration"
              : "Together with their families"}
          </div>
          <div className={cn("mt-2 text-2xl leading-tight", template.heading)}>{draft.title}</div>
          <div className={cn("mt-1 text-[11px]", template.muted)}>
            Kindly join us for a joyful celebration.
          </div>
        </div>
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl",
            template.mode === "dark" ? template.button : "bg-current/10",
            template.mode === "light" && template.accent,
          )}
        >
          <Flower2 className="h-4 w-4" />
        </div>
      </div>
      <div
        className={cn(
          "mt-5 flex items-center justify-between border-t pt-3 text-[10.5px]",
          template.border,
          template.muted,
        )}
      >
        <span>
          {draft.ceremonies[0] ? ceremonyDateLabel(draft.ceremonies[0]) : "Date to be announced"}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {draft.ceremonies[0]?.venue || "Venue to be announced"}
        </span>
      </div>
    </div>
  );
}
