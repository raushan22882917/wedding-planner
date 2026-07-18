import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Globe2,
  LoaderCircle,
  Mail,
  Phone,
  Search,
  Sparkles,
  Store,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlanningWorkspace } from "@/lib/planner-workspace.functions";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatDate(value: string | null) {
  if (!value) return "No date set";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

export function FullPlanPanel({
  onGeneratePlan,
  generating,
}: {
  onGeneratePlan: () => void;
  generating: boolean;
}) {
  const workspaceFn = useServerFn(getPlanningWorkspace);
  const workspace = useQuery({
    queryKey: ["planning-workspace"],
    queryFn: () => workspaceFn(),
  });

  if (workspace.isLoading) {
    return (
      <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading your wedding plan…
        </span>
      </div>
    );
  }
  if (workspace.isError || !workspace.data) {
    return (
      <div
        className="m-6 rounded-xl border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert className="mr-2 inline h-4 w-4" /> Your plan could not be loaded. Refresh the
        page and try again.
      </div>
    );
  }

  const plan = workspace.data;
  const completedTasks = plan.tasks.filter((task) => task.done).length;
  const openTasks = plan.tasks.filter((task) => !task.done);
  const booked = plan.vendors.filter((vendor) => vendor.status === "booked").length;
  const contactable = plan.vendors.filter(
    (vendor) => vendor.contact_phone || vendor.contact_email,
  ).length;
  const couple = [plan.profile?.partner_one, plan.profile?.partner_two].filter(Boolean).join(" & ");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-7 lg:px-10">
      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 via-card to-purple-brand/8 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Live planning workspace
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl">
              {couple ? `${couple}’s full plan` : "Your full wedding plan"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This is built from your saved wedding brief, budget, timeline, tasks, guests, vendors,
              and research library. Ask the AI to turn it into a prioritised plan whenever details
              change.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 shrink-0 rounded-full bg-gradient-to-r from-primary to-purple-brand hover:opacity-90"
            disabled={generating}
            onClick={onGeneratePlan}
          >
            {generating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Building plan…" : "Ask AI to refresh plan"}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Plan overview">
        <Stat
          icon={CalendarDays}
          label="Wedding"
          value={formatDate(plan.profile?.wedding_date ?? null)}
          detail={plan.profile?.city ?? "Set city"}
        />
        <Stat
          icon={Wallet}
          label="Budget remaining"
          value={rupees.format(plan.budget.remaining)}
          detail={`${rupees.format(plan.budget.spent)} spent`}
          tone={plan.budget.remaining < 0 ? "danger" : "success"}
        />
        <Stat
          icon={ClipboardList}
          label="Tasks complete"
          value={`${completedTasks}/${plan.tasks.length}`}
          detail={`${openTasks.length} still open`}
        />
        <Stat
          icon={Store}
          label="Vendor plan"
          value={`${booked}/${plan.vendors.length}`}
          detail={`${contactable} with contact details`}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="soft-card overflow-hidden" aria-labelledby="plan-timeline-title">
          <SectionHeader
            icon={CalendarDays}
            eyebrow="Timeline"
            title="Upcoming celebrations"
            linkTo="/timeline"
          />
          {plan.timeline.length ? (
            <ol className="divide-y divide-border">
              {plan.timeline.slice(0, 8).map((event) => (
                <li key={event.id} className="flex gap-3 px-5 py-4 sm:px-6">
                  <div className="w-12 shrink-0 rounded-lg bg-primary/7 px-1.5 py-2 text-center text-xs font-semibold text-primary">
                    {formatDate(event.event_date)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[event.start_time?.slice(0, 5), event.location]
                        .filter(Boolean)
                        .join(" · ") || "Timing to be confirmed"}
                    </p>
                    {event.notes ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {event.notes}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyCopy message="Your ceremony and event schedule will appear here once you add it to the timeline." />
          )}
        </section>

        <section className="soft-card overflow-hidden" aria-labelledby="plan-tasks-title">
          <SectionHeader
            icon={ClipboardList}
            eyebrow="Next actions"
            title="Keep moving"
            linkTo="/tasks"
          />
          {openTasks.length ? (
            <ul className="space-y-2 p-4">
              {openTasks.slice(0, 6).map((task) => (
                <li key={task.id} className="rounded-xl border border-border bg-secondary/25 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          task.category,
                          task.due_date ? `Due ${formatDate(task.due_date)}` : null,
                          `${task.priority} priority`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyCopy message="No open tasks. Ask MarryMap AI to create a practical next-steps checklist." />
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="soft-card overflow-hidden" aria-labelledby="plan-vendors-title">
          <SectionHeader
            icon={Store}
            eyebrow="Vendor desk"
            title="Saved vendors & details"
            linkTo="/vendors"
          />
          {plan.vendors.length ? (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {plan.vendors.slice(0, 6).map((vendor) => (
                <SavedVendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyCopy message="Ask the AI to research a category, then use Save vendor on any source-backed result to keep it here." />
            </div>
          )}
        </section>

        <section className="soft-card overflow-hidden" aria-labelledby="plan-research-title">
          <SectionHeader icon={Search} eyebrow="Research library" title="AI working set" />
          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-secondary/45 p-4">
              <p className="text-3xl font-display">{plan.research.sourceCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">recent indexed research sources</p>
            </div>
            {plan.research.recentTitles.length ? (
              <ul className="space-y-2">
                {plan.research.recentTitles.slice(0, 5).map((title) => (
                  <li
                    key={title}
                    className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                New research appears here after the AI finds relevant public sources.
              </p>
            )}
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <UsersRound className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
              {plan.guests.total} guests saved · {plan.guests.attending} attending ·{" "}
              {plan.guests.pending} RSVP pending
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="soft-card p-4">
      <Icon
        className={
          tone === "danger"
            ? "h-4 w-4 text-destructive"
            : tone === "success"
              ? "h-4 w-4 text-emerald-600"
              : "h-4 w-4 text-primary"
        }
      />
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  linkTo,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  linkTo?: "/timeline" | "/tasks" | "/vendors";
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-secondary/20 px-5 py-4 sm:px-6">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Icon className="h-3.5 w-3.5" />
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-lg">{title}</h2>
      </div>
      {linkTo ? (
        <Link
          to={linkTo}
          className="inline-flex min-h-10 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </header>
  );
}

function SavedVendorCard({
  vendor,
}: {
  vendor: Awaited<ReturnType<typeof getPlanningWorkspace>>["vendors"][number];
}) {
  const price = vendor.price_low
    ? `${rupees.format(vendor.price_low)}${vendor.price_high ? ` – ${rupees.format(vendor.price_high)}` : "+"}`
    : "Quote requested";
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{vendor.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[vendor.category, vendor.city].filter(Boolean).join(" · ") || "Wedding vendor"}
          </p>
        </div>
        <span className="rounded-full bg-primary/8 px-2 py-1 text-[10px] font-semibold capitalize text-primary">
          {vendor.status}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{price}</span>
        {vendor.rating ? <span>★ {vendor.rating}/5</span> : null}
      </div>
      {vendor.notes ? (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {vendor.notes}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {vendor.contact_phone ? (
          <a
            href={`tel:${vendor.contact_phone.replace(/[^+\d]/g, "")}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium hover:border-primary/35 hover:text-primary"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </a>
        ) : null}
        {vendor.contact_email ? (
          <a
            href={`mailto:${vendor.contact_email}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium hover:border-primary/35 hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
        ) : null}
        {vendor.website ? (
          <a
            href={vendor.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium hover:border-primary/35 hover:text-primary"
          >
            <Globe2 className="h-3.5 w-3.5" />
            Website
          </a>
        ) : null}
      </div>
    </article>
  );
}

function EmptyCopy({ message }: { message: string }) {
  return <p className="p-5 text-sm leading-relaxed text-muted-foreground">{message}</p>;
}
