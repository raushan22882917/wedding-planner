import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { Building2, Package, MessageSquare, Star, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_vendor/vendor/dashboard")({
  component: VendorDashboard,
});

const stats = [
  { label: "New leads", value: "0", icon: MessageSquare, accent: "text-primary" },
  { label: "Active packages", value: "0", icon: Package, accent: "text-purple-brand" },
  { label: "Bookings this month", value: "0", icon: TrendingUp, accent: "text-gold-brand" },
  { label: "Average rating", value: "—", icon: Star, accent: "text-primary" },
];

function VendorDashboard() {
  return (
    <div className="p-6 lg:p-10 space-y-8">
      <PageHeader
        eyebrow="Vendor Studio"
        title="Welcome to your workspace"
        subtitle="Manage your listings, respond to couples, and grow your wedding business."
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
      <div className="soft-card p-8 text-center">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="font-display text-xl mt-3">Set up your vendor profile</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add your business details, upload portfolio images, and publish packages so couples can find and book you.
        </p>
      </div>
    </div>
  );
}
