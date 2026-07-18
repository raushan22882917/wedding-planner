import { Link, Outlet, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createThread, deleteThread, listThreads } from "@/lib/threads.functions";

export const Route = createFileRoute("/_app/planner")({
  component: PlannerLayout,
});

const quickLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/vendors", label: "Vendors", icon: Store },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
];

function PlannerLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/planner/$threadId", params: { threadId: t.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/planner" });
    },
  });

  const active = useActiveThreadId();
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col md:flex-row">
      <nav
        className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background px-3 py-2 md:hidden"
        aria-label="Quick planning tools"
      >
        {quickLinks.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {tool.label}
            </Link>
          );
        })}
      </nav>
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-sidebar/50 transition-[width] duration-200 md:flex",
          historyCollapsed ? "w-[60px]" : "w-[260px]",
        )}
        aria-label="Conversation history"
      >
        {historyCollapsed ? (
          <div className="flex flex-col items-center gap-2 p-2">
            <button
              type="button"
              onClick={() => setHistoryCollapsed(false)}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Show recent conversations"
              title="Show recent conversations"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-purple-brand text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="New conversation"
              title="New conversation"
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 p-3">
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-purple-brand text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New conversation
              </button>
              <button
                type="button"
                onClick={() => setHistoryCollapsed(true)}
                className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Hide recent conversations"
                title="Hide recent conversations"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Recent conversations
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
              {threadsQuery.isLoading && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">Loading…</div>
              )}
              {threadsQuery.data?.length === 0 && !createMut.isPending && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No conversations yet.
                  <br />
                  Start a new one above.
                </div>
              )}
              {threadsQuery.data?.map((t) => (
                <div key={t.id} className="group relative">
                  <Link
                    to="/planner/$threadId"
                    params={{ threadId: t.id }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                      active === t.id
                        ? "bg-sidebar-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{t.title}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Delete this conversation?")) deleteMut.mutate(t.id);
                    }}
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-background/60 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </nav>
            <div className="border-t border-border p-3">
              <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/6 to-purple-brand/6 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" />
                  MarryMap AI
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Vendor research, quote negotiation, and WhatsApp drafting.
                </p>
              </div>
            </div>
          </>
        )}
      </aside>
      <Outlet />
    </div>
  );
}

function useActiveThreadId() {
  try {
    // useParams throws when not matched — that's fine
    const p = useParams({ from: "/_app/planner/$threadId" });
    return p.threadId as string | undefined;
  } catch {
    return undefined;
  }
}
