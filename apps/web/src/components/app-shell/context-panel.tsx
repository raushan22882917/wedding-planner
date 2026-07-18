import { Link } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ListChecks,
  Store,
  TrendingUp,
  Users2,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Progress } from "@/components/ui/progress";
import { getMyProfile } from "@/lib/profile.functions";
import { listBudget, listTasks, listTimeline, listVendors } from "@/lib/planner.functions";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const quickLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/vendors", label: "Vendors", icon: Store },
  { to: "/guests", label: "Guests", icon: Users2 },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/timeline", label: "Timeline", icon: Calendar },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
];

const staffingScales = [
  { guests: "50–100 guests", team: "20–40" },
  { guests: "200–500 guests", team: "50–100" },
  { guests: "500–1,000 guests", team: "100–200+" },
  { guests: "1,000+ guests", team: "200–500+" },
];

const staffingGroups = [
  { label: "Planning & family", range: "2–10 + 2–6" },
  { label: "Venue & hospitality", range: "5–30 + 4–15" },
  { label: "Food & service", range: "20–100" },
  { label: "Décor & production", range: "3–30" },
  { label: "Media & beauty", range: "1–20" },
  { label: "Safety & transport", range: "1–50" },
];

export function ContextPanel() {
  const profileFn = useServerFn(getMyProfile);
  const budgetFn = useServerFn(listBudget);
  const tasksFn = useServerFn(listTasks);
  const timelineFn = useServerFn(listTimeline);
  const vendorsFn = useServerFn(listVendors);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const budget = useQuery({ queryKey: ["budget"], queryFn: () => budgetFn() });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => tasksFn() });
  const timeline = useQuery({ queryKey: ["timeline"], queryFn: () => timelineFn() });
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => vendorsFn() });

  const weddingDate = profile.data?.wedding_date
    ? new Date(`${profile.data.wedding_date}T12:00:00`)
    : null;
  const daysToWedding = weddingDate
    ? Math.ceil((weddingDate.getTime() - Date.now()) / 86_400_000)
    : null;
  const allTasks = tasks.data ?? [];
  const completedTasks = allTasks.filter((task) => task.done).length;
  const completion = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;
  const categories = budget.data?.categories ?? [];
  const expenses = budget.data?.expenses ?? [];
  const planned = categories.reduce((sum, category) => sum + Number(category.planned), 0);
  const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = planned - spent;
  const booked = (vendors.data ?? []).filter((vendor) => vendor.status === "booked").length;
  const upcoming = (timeline.data ?? [])
    .filter((event) => new Date(`${event.event_date}T00:00:00`) >= new Date())
    .slice(0, 3);
  const dueToday = allTasks.filter(
    (task) => !task.done && task.due_date === new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <aside
      className="hidden min-h-0 w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-background/50 p-5 xl:flex"
      aria-label="Wedding planning context"
    >
      <section className="soft-card shrink-0 overflow-hidden" aria-label="Quick planning shortcuts">
        <header className="border-b border-border bg-gradient-to-r from-primary/6 via-card to-purple-brand/6 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Quick access
          </p>
          <h2 className="mt-0.5 font-display text-lg text-foreground">Jump to your plan</h2>
        </header>
        <nav className="grid grid-cols-3 gap-2 p-3" aria-label="Planning shortcuts">
          {quickLinks.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-1.5 text-[10px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" />
                <span className="truncate">{tool.label}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="soft-card shrink-0 overflow-hidden" aria-label="Wedding staffing guide">
        <header className="flex items-start gap-2.5 border-b border-border bg-gradient-to-r from-purple-brand/7 via-card to-primary/7 px-4 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-brand/10 text-purple-brand">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-brand">
              Wedding team guide
            </p>
            <h2 className="mt-0.5 font-display text-lg text-foreground">Plan your people</h2>
          </div>
        </header>
        <div className="space-y-3 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estimate your on-site team by guest count, then adjust for functions, venue size, and
            service style.
          </p>
          <div className="grid grid-cols-2 gap-2" aria-label="Typical team size by guest count">
            {staffingScales.map((scale) => (
              <div key={scale.guests} className="rounded-lg bg-secondary/65 px-2.5 py-2">
                <p className="text-[10px] font-medium text-muted-foreground">{scale.guests}</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{scale.team} people</p>
              </div>
            ))}
          </div>
          <details className="group rounded-lg border border-border bg-card">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[11px] font-semibold text-foreground marker:content-none">
              Explore essential team groups
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                6 groups
              </span>
            </summary>
            <ul className="space-y-1.5 border-t border-border px-3 py-2.5">
              {staffingGroups.map((group) => (
                <li
                  key={group.label}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="text-muted-foreground">{group.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">{group.range}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <div className="soft-card relative shrink-0 overflow-hidden p-5">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Countdown
        </div>
        {weddingDate ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-5xl text-foreground">
                {Math.max(0, daysToWedding ?? 0)}
              </div>
              <div className="text-sm text-muted-foreground">days</div>
            </div>
            <div className="text-[12px] text-muted-foreground mt-1">
              until{" "}
              {weddingDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-purple-brand rounded-full"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              {completion}% planning complete
            </div>
          </>
        ) : (
          <div className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">
            Add your wedding date in Settings to activate the planning countdown.
          </div>
        )}
      </div>

      <div className="soft-card shrink-0 p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Budget
          </div>
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-2xl tabular-nums">{rupees.format(spent)}</span>
          <span className="text-xs text-muted-foreground">/ {rupees.format(planned)}</span>
        </div>
        <Progress
          value={planned ? Math.min(100, (spent / planned) * 100) : 0}
          className="mt-3 h-1.5"
        />
        <div
          className={`text-[11px] mt-2 flex items-center gap-1 ${remaining < 0 ? "text-destructive" : "text-emerald-700"}`}
        >
          <TrendingUp className="h-3 w-3" />
          {remaining < 0
            ? `${rupees.format(-remaining)} over budget`
            : `${rupees.format(remaining)} remaining`}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3">
        <div className="soft-card p-4">
          <Users2 className="h-4 w-4 text-purple-brand" />
          <div className="font-display text-2xl mt-2">
            {booked}/{vendors.data?.length ?? 0}
          </div>
          <div className="text-[11px] text-muted-foreground">Vendors booked</div>
        </div>
        <div className="soft-card p-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <div className="font-display text-2xl mt-2">{dueToday}</div>
          <div className="text-[11px] text-muted-foreground">Tasks due today</div>
        </div>
      </div>

      <div className="soft-card shrink-0 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Upcoming
          </div>
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {upcoming.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No upcoming events. Add a vendor visit or ceremony to your timeline.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((event) => (
              <li key={event.id} className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{event.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(`${event.event_date}T12:00:00`).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                    {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
