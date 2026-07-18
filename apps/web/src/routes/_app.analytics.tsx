import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

const monthly = [
  { m: "Aug", v: 40 },
  { m: "Sep", v: 50 },
  { m: "Oct", v: 220 },
  { m: "Nov", v: 170 },
  { m: "Dec", v: 140 },
  { m: "Jan", v: 240 },
];
const perf = [
  { v: "Studio Aperture", s: 94 },
  { v: "Meher Caterers", s: 88 },
  { v: "House of Blooms", s: 82 },
  { v: "Sabyasachi", s: 91 },
  { v: "The Leela", s: 96 },
];

function AnalyticsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Planning intelligence"
        subtitle="How your wedding is trending across every dimension."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { l: "Planning score", v: "82", d: "+6 this week", tone: "text-primary" },
          { l: "Budget health", v: "A", d: "Under target", tone: "text-emerald-600" },
          { l: "Task completion", v: "74%", d: "34/46 done", tone: "text-purple-brand" },
          { l: "Vendor score", v: "91", d: "Above avg.", tone: "text-gold-brand" },
        ].map((s) => (
          <div key={s.l} className="soft-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className={`font-display text-4xl mt-2 ${s.tone}`}>{s.v}</div>
            <div className="text-[12px] text-muted-foreground mt-1">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="soft-card p-5">
          <div className="font-display text-lg mb-3">Monthly spending</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="m" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke="oklch(0.55 0.24 293)"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, fill: "white" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="soft-card p-5">
          <div className="font-display text-lg mb-3">Vendor performance</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={perf} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid
                stroke="var(--color-border)"
                horizontal={false}
                strokeDasharray="3 3"
              />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                dataKey="v"
                type="category"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="s" fill="oklch(0.62 0.22 5)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="soft-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div className="font-display text-lg">Upcoming risks</div>
          </div>
          <ul className="space-y-3">
            {[
              { t: "Photographer contract pending 5 days", p: 70 },
              { t: "Guest list still 24% incomplete", p: 45 },
              { t: "Advance payment to decorator overdue", p: 85 },
            ].map((r) => (
              <li key={r.t}>
                <div className="flex items-center justify-between text-[13px]">
                  <span>{r.t}</span>
                  <span className="text-muted-foreground">{r.p}%</span>
                </div>
                <Progress value={r.p} className="h-1.5 mt-1.5" />
              </li>
            ))}
          </ul>
        </div>

        <div className="soft-card p-5 bg-gradient-to-br from-primary/5 to-purple-brand/5 border-primary/15">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-display text-lg">AI recommendations</div>
          </div>
          <ul className="space-y-3 text-[13.5px] leading-relaxed">
            <li>• Lock in Studio Aperture this week — 2 other couples are inquiring for Feb.</li>
            <li>• Reallocate ₹30k from music budget to a live sitar ensemble for mehendi.</li>
            <li>• Send WhatsApp RSVP nudges to 84 pending guests on Sunday evening.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
