import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { Users, Building2, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: AdminDashboard,
});

const stats = [
  { label: "Total weddings", value: "0", icon: Heart, accent: "text-primary" },
  { label: "Active users", value: "0", icon: Users, accent: "text-purple-brand" },
  { label: "Vendors", value: "0", icon: Building2, accent: "text-gold-brand" },
  { label: "AI messages (30d)", value: "0", icon: Sparkles, accent: "text-primary" },
];

function AdminDashboard() {
  return (
    <div className="p-6 lg:p-10 space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Platform overview"
        subtitle="Monitor growth, moderate the marketplace, and manage vendors."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="soft-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
                <Icon className={`h-4 w-4 ${s.accent}`} />
              </div>
              <div className="font-display text-3xl mt-3">{s.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
