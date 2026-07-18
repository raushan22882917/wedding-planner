import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  ListChecks,
  Wallet,
  Store,
  MessageSquare,
  Users,
  Calendar,
  FileText,
  CheckSquare,
  BarChart3,
  LayoutTemplate,
  Scale,
  Settings,
  Heart,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { CoupleAvatar } from "@/components/app-shell/couple-avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Sparkles;
  accent?: boolean;
};

const items: NavItem[] = [
  { to: "/planner", label: "AI Planner", icon: Sparkles, accent: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/timeline", label: "Timeline", icon: ListChecks },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/vendors", label: "Vendors", icon: Store },
  { to: "/court-marriage", label: "Court marriage help", icon: Scale },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/website", label: "Wedding website", icon: LayoutTemplate },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

const navigationGroups = [
  { label: "Plan", items: items.slice(0, 6) },
  { label: "Coordinate", items: items.slice(6, 11) },
  { label: "Share & review", items: items.slice(11) },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const templateStudioOpen = useRouterState({
    select: (state) => {
      const search = state.location.search as { template?: unknown };
      return state.location.pathname === "/website" && typeof search.template === "string";
    },
  });
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const [manualCollapsed, setManualCollapsed] = useState(false);
  const collapsed = templateStudioOpen || manualCollapsed;

  const p1 = profile.data?.partner_one?.trim();
  const p2 = profile.data?.partner_two?.trim();
  const nameLine = p1 && p2 ? `${p1} & ${p2}` : p1 || p2 || email?.split("@")[0] || "Your wedding";
  const dateLine = profile.data?.wedding_date
    ? new Date(profile.data.wedding_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) + (profile.data.city ? ` \u00b7 ${profile.data.city}` : "")
    : (email ?? "Set your wedding date in Settings");

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  };

  const width = collapsed ? "w-[68px]" : "w-[248px]";

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 flex-col border-r border-border bg-sidebar h-screen sticky top-0 transition-[width] duration-200",
        width,
      )}
    >
      <div
        className={cn(
          "pt-5 pb-4 flex items-center gap-2.5",
          collapsed ? "px-3 justify-center" : "px-5",
        )}
      >
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-purple-brand grid place-items-center shadow-sm shrink-0">
          <Heart className="h-4.5 w-4.5 text-white" fill="white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-display text-[17px] leading-none text-foreground">MarryMap</div>
            <div className="text-[11px] text-muted-foreground mt-1 tracking-wide uppercase">
              Wedding OS
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setManualCollapsed(true)}
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && !templateStudioOpen && (
        <div className="px-2 mb-2">
          <button
            onClick={() => setManualCollapsed(false)}
            className="w-full h-8 grid place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="px-3 mt-2">
          <div className="rounded-2xl border border-border bg-card px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
            <CoupleAvatar
              size="sm"
              partnerOneName={p1}
              partnerTwoName={p2}
              partnerOnePhotoUrl={profile.data?.partner_one_photo_url}
              partnerTwoPhotoUrl={profile.data?.partner_two_photo_url}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{nameLine}</div>
              <div className="text-[11px] text-muted-foreground truncate">{dateLine}</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Wedding planning navigation">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex === 0 ? "" : "mt-5"}>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center rounded-lg text-[13.5px] transition-all",
                      collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-3 px-3 py-2",
                      active
                        ? "bg-sidebar-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                        item.accent && !active && "text-primary",
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("pb-3 border-t border-border pt-3", collapsed ? "px-2" : "px-2")}>
        <Link
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center rounded-lg text-[13.5px] transition-all",
            collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2",
            pathname === "/settings"
              ? "bg-sidebar-accent text-foreground font-medium"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={signOut}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center rounded-lg text-[13.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all",
            collapsed ? "justify-center h-10 w-10 mx-auto" : "w-full gap-3 px-3 py-2",
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
