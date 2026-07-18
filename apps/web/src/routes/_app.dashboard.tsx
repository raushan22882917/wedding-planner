import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock, Sparkles, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app-shell/page-header";
import { VendorResearchPanel } from "@/components/dashboard/vendor-research-panel";
import { ConciergeFlowCard } from "@/components/dashboard/concierge-flow-card";
import { getMyProfile } from "@/lib/profile.functions";
import { listBudget, listTasks, listTimeline, listVendors } from "@/lib/planner.functions";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const monthName = new Intl.DateTimeFormat("en-IN", { month: "short" });
const categoryColors = [
  "oklch(0.62 0.22 5)",
  "oklch(0.55 0.24 293)",
  "oklch(0.75 0.13 88)",
  "oklch(0.7 0.17 152)",
  "oklch(0.6 0.12 240)",
];

function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  return Math.max(0, Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000));
}

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getCountdown(date: string): Countdown {
  const remainingMs = Math.max(0, new Date(`${date}T00:00:00`).getTime() - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1_000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function DashboardPage() {
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

  const expenses = budget.data?.expenses ?? [];
  const categories = budget.data?.categories ?? [];
  const allTasks = tasks.data ?? [];
  const allVendors = vendors.data ?? [];
  const planned =
    profile.data?.budget_total ??
    categories.reduce((total, category) => total + Number(category.planned), 0);
  const spent = expenses.reduce((total, expense) => total + Number(expense.amount), 0);
  const booked = allVendors.filter((vendor) => vendor.status === "booked").length;
  const completeTasks = allTasks.filter((task) => task.done).length;
  const completion = allTasks.length ? Math.round((completeTasks / allTasks.length) * 100) : 0;
  const days = daysUntil(profile.data?.wedding_date);
  const hasDataError = [profile, budget, tasks, timeline, vendors].some((query) => query.isError);

  const spendData = useMemo(() => {
    const buckets = new Map<string, { date: number; value: number }>();
    for (const expense of expenses) {
      const date = new Date(expense.created_at);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = buckets.get(key) ?? {
        date: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        value: 0,
      };
      bucket.value += Number(expense.amount);
      buckets.set(key, bucket);
    }
    let cumulative = 0;
    return [...buckets.values()]
      .sort((left, right) => left.date - right.date)
      .slice(-6)
      .map((bucket) => {
        cumulative += bucket.value;
        return { m: monthName.format(new Date(bucket.date)), v: cumulative };
      });
  }, [expenses]);

  const categoryData = useMemo(
    () =>
      categories
        .map((category, index) => ({
          name: category.name,
          value: expenses
            .filter((expense) => expense.category_id === category.id)
            .reduce((total, expense) => total + Number(expense.amount), 0),
          color: categoryColors[index % categoryColors.length]!,
        }))
        .filter((category) => category.value > 0),
    [categories, expenses],
  );

  const vendorProgress = ["shortlist", "contacted", "quoted", "booked"].map((status) => ({
    name: status[0]!.toUpperCase() + status.slice(1),
    v: allVendors.filter((vendor) => vendor.status === status).length,
  }));
  const upcoming = (timeline.data ?? [])
    .filter(
      (event) =>
        new Date(`${event.event_date}T12:00:00`).getTime() >= new Date().setHours(0, 0, 0, 0),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        subtitle={
          days === null
            ? "Add your wedding date in Settings to activate your planning countdown."
            : `${days} days until your wedding.`
        }
        eyebrow="Overview"
        action={<WeddingCountdown weddingDate={profile.data?.wedding_date} />}
      />

      {hasDataError && (
        <div
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive"
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Some planning data could not be loaded. Refresh the page or check your Supabase
            connection.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Days remaining"
          value={days === null ? "—" : String(days)}
          delta={profile.data?.wedding_date ?? "Set wedding date"}
          tone="primary"
        />
        <StatCard
          label="Budget spent"
          value={rupees.format(spent)}
          delta={
            planned
              ? `${Math.round((spent / planned) * 100)}% of ${rupees.format(planned)}`
              : "Add your budget"
          }
          tone="purple"
        />
        <StatCard
          label="Vendors booked"
          value={`${booked}/${allVendors.length}`}
          delta={
            allVendors.length
              ? `${allVendors.length - booked} still in progress`
              : "Start researching vendors"
          }
          tone="gold"
        />
        <StatCard
          label="Tasks complete"
          value={`${completeTasks}/${allTasks.length}`}
          delta={allTasks.length ? `${completion}% complete` : "Add your first task"}
          tone="success"
        />
      </div>

      <ConciergeFlowCard vendors={allVendors} />

      <VendorResearchPanel
        defaultQuery={profile.data?.city ? `wedding venues in ${profile.data.city}` : ""}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="soft-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recorded spending
              </div>
              <div className="mt-0.5 font-display text-lg">Cumulative outflow</div>
            </div>
            <div className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              From your expenses
            </div>
          </div>
          {spendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={spendData}>
                <defs>
                  <linearGradient id="dashboard-spending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.22 5)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.62 0.22 5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border)"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="m"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                  formatter={(value) => rupees.format(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="oklch(0.62 0.22 5)"
                  strokeWidth={2.5}
                  fill="url(#dashboard-spending)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Record an expense to see your spending trend." />
          )}
        </div>

        <div className="soft-card p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            By category
          </div>
          <div className="mt-0.5 font-display text-lg">Where your budget goes</div>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                    }}
                    formatter={(value) => rupees.format(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5">
                {categoryData.map((category) => (
                  <li key={category.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: category.color }}
                      />{" "}
                      <span className="truncate">{category.name}</span>
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {rupees.format(category.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyChart message="Assign expenses to categories to see the split." compact />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="soft-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-lg">Upcoming timeline</div>
            <Link
              to="/timeline"
              className="flex min-h-9 items-center gap-1 text-[12px] text-primary hover:underline"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 border-b border-border py-2 last:border-0"
                >
                  <div className="w-14 shrink-0 font-mono text-[12px] text-muted-foreground">
                    {new Date(`${event.event_date}T12:00:00`).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="flex-1 text-[13.5px]">{event.title}</div>
                  {event.location && (
                    <span className="max-w-28 truncate rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {event.location}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No upcoming events yet. Add venue visits, tastings, and ceremonies to your timeline.
            </p>
          )}
        </div>

        <div className="soft-card p-5">
          <div className="font-display text-lg">Vendor status</div>
          {allVendors.length ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={vendorProgress}>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="v" fill="oklch(0.55 0.24 293)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span>Booked progress</span>
                  <span className="font-medium">
                    {Math.round((booked / allVendors.length) * 100)}%
                  </span>
                </div>
                <Progress value={(booked / allVendors.length) * 100} className="h-1.5" />
              </div>
            </>
          ) : (
            <EmptyChart message="Save research leads to track your vendor progress." compact />
          )}
        </div>
      </div>

      <div className="soft-card flex items-start gap-3 border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-purple-brand/5 p-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-purple-brand">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Planning signal
          </div>
          <div className="mt-1 text-[14.5px] leading-relaxed">
            {allVendors.length === 0
              ? "Run a source-backed vendor search above, then save the leads you want to compare."
              : `${booked} of ${allVendors.length} saved vendors are booked. ${allTasks.length - completeTasks} task${allTasks.length - completeTasks === 1 ? "" : "s"} remain open.`}
          </div>
          <Link
            to="/vendors"
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] text-primary-foreground hover:bg-primary/90"
          >
            Review vendors <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function WeddingCountdown({ weddingDate }: { weddingDate: string | null | undefined }) {
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    if (!weddingDate) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => setCountdown(getCountdown(weddingDate));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [weddingDate]);

  if (!weddingDate) {
    return (
      <Link
        to="/settings"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Clock className="h-4 w-4 text-primary" />
        Set wedding date to start the timer
      </Link>
    );
  }

  const units = [
    { label: "Days", value: countdown?.days },
    { label: "Hours", value: countdown?.hours },
    { label: "Minutes", value: countdown?.minutes },
    { label: "Seconds", value: countdown?.seconds },
  ];

  return (
    <section
      aria-label="Wedding countdown"
      className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/7 via-card to-purple-brand/7 p-3 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
        <Clock className="h-3.5 w-3.5" />
        Wedding countdown
      </div>
      <div className="flex divide-x divide-border/80" role="timer" aria-live="off">
        {units.map((unit) => (
          <div key={unit.label} className="min-w-[3.3rem] px-2 text-center first:pl-0 last:pr-0">
            <div className="font-display text-xl tabular-nums text-foreground">
              {unit.value === undefined ? "—" : String(unit.value).padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyChart({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`grid place-items-center text-center text-sm text-muted-foreground ${compact ? "h-52" : "h-[220px]"}`}
    >
      {message}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "purple" | "gold" | "success";
}) {
  const styles = {
    primary: "text-primary bg-primary/8",
    purple: "text-purple-brand bg-purple-brand/8",
    gold: "text-gold-brand bg-gold-brand/8",
    success: "text-emerald-600 bg-emerald-50",
  };
  const Icon = { primary: Clock, purple: TrendingUp, gold: Sparkles, success: CheckCircle2 }[tone];
  return (
    <div className="soft-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`grid h-7 w-7 place-items-center rounded-lg ${styles[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">{delta}</div>
    </div>
  );
}
