import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Camera,
  Calculator,
  Calendar,
  Utensils,
  MessageCircle,
  ClipboardList,
  Users,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createThread } from "@/lib/threads.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/planner/")({
  component: PlannerIndex,
});

const suggestions = [
  { icon: Camera, label: "Find photographers under \u20b980,000", accent: "text-primary" },
  {
    icon: Calculator,
    label: "Compare decorator quotes for a 350-guest wedding",
    accent: "text-purple-brand",
  },
  { icon: Calendar, label: "Generate a 6-month wedding timeline", accent: "text-gold-brand" },
  {
    icon: Utensils,
    label: "Shortlist caterers with Rajasthani + continental menus",
    accent: "text-primary",
  },
  {
    icon: MessageCircle,
    label: "Draft a WhatsApp inquiry to a venue",
    accent: "text-purple-brand",
  },
  {
    icon: ClipboardList,
    label: "Create a shopping checklist by ceremony",
    accent: "text-gold-brand",
  },
  { icon: Users, label: "Plan guest seating for a mehendi + reception", accent: "text-primary" },
  {
    icon: ListChecks,
    label: "Break down my \u20b915L budget by category",
    accent: "text-purple-brand",
  },
];

function PlannerIndex() {
  const navigate = useNavigate();
  const create = useServerFn(createThread);
  const profileFn = useServerFn(getMyProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const p1 = profile.data?.partner_one?.trim();
  const p2 = profile.data?.partner_two?.trim();
  const greetName = p1 && p2 ? `${p1} & ${p2}` : p1 || p2 || "";

  const mut = useMutation({
    mutationFn: async (title?: string) => create({ data: { title } }),
    onSuccess: (t, title) => {
      navigate({
        to: "/planner/$threadId",
        params: { threadId: t.id },
        search: title ? { q: title } : undefined,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16">
        <div className="animate-fade-in">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            MarryMap AI
          </div>
          <h1 className="font-display text-4xl md:text-5xl mt-3 leading-tight">
            Good to see you
            {greetName ? (
              <>
                , <span className="text-primary">{greetName}</span>
              </>
            ) : null}{" "}
            <span className="text-primary">♥</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-xl">
            I'm your AI wedding planner. Ask me to research vendors, compare quotes, draft WhatsApp
            messages, or build your timeline — I'll take care of the details.
          </p>

          <button
            onClick={() => mut.mutate(undefined)}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-purple-brand text-white px-5 py-3 text-[13px] font-medium hover:opacity-90 transition disabled:opacity-60"
            disabled={mut.isPending}
          >
            Start a new conversation <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-10">
            <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Or try one of these
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => mut.mutate(s.label)}
                    disabled={mut.isPending}
                    className="group text-left flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 hover:shadow-sm transition-all disabled:opacity-60"
                  >
                    <div className="h-8 w-8 rounded-lg bg-secondary grid place-items-center group-hover:bg-primary/8 transition-colors">
                      <Icon className={cn("h-4 w-4", s.accent)} />
                    </div>
                    <span className="text-[13.5px] text-foreground">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
