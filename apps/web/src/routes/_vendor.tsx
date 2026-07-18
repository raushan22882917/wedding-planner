import { Outlet, createFileRoute, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryRole } from "@/lib/roles.functions";
import { Building2, Calendar, MessageSquare, Package, LayoutDashboard, Star, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_vendor")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: VendorLayout,
});

const nav = [
  { to: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vendor/profile", label: "Profile", icon: Building2 },
  { to: "/vendor/packages", label: "Packages", icon: Package },
  { to: "/vendor/calendar", label: "Calendar", icon: Calendar },
  { to: "/vendor/leads", label: "Leads", icon: MessageSquare },
  { to: "/vendor/reviews", label: "Reviews", icon: Star },
] as const;

function VendorLayout() {
  const roleFn = useServerFn(getPrimaryRole);
  const roleQ = useQuery({ queryKey: ["primary-role"], queryFn: () => roleFn() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (roleQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (roleQ.data && roleQ.data !== "vendor" && roleQ.data !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <div className="font-display text-2xl">Vendor access only</div>
          <p className="text-muted-foreground text-sm mt-2">This area is for vendor accounts.</p>
          <Link to="/planner" className="mt-4 inline-block text-primary text-sm">Go to your planner →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar/50 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">MarryMap</div>
          <div className="font-display text-lg">Vendor Studio</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition",
                  active
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
            window.location.href = "/auth";
          }}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
