import { Outlet, createFileRoute, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryRole } from "@/lib/roles.functions";
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Loader2,
  ShieldCheck,
  Settings,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AdminLayout,
});

const nav = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/vendors", label: "Vendors", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { to: "/admin/custom-template-requests", label: "Website requests", icon: Palette },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
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
  if (roleQ.data !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <div className="font-display text-2xl">Admin access only</div>
          <p className="text-muted-foreground text-sm mt-2">
            You don't have permission to view this area.
          </p>
          <Link to="/" className="mt-4 inline-block text-primary text-sm">
            Back home →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar/50 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            MarryMap
          </div>
          <div className="font-display text-lg">Admin Console</div>
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
