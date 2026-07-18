import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, PhoneCall, Search, Sparkles, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type ConciergeVendor = {
  status: string;
  contact_phone: string | null;
  contact_email: string | null;
};

export function ConciergeFlowCard({ vendors }: { vendors: ConciergeVendor[] }) {
  const shortlisted = vendors.filter((vendor) => vendor.status !== "passed").length;
  const contacted = vendors.filter((vendor) =>
    ["contacted", "quoted", "booked"].includes(vendor.status),
  ).length;
  const booked = vendors.filter((vendor) => vendor.status === "booked").length;
  const contactable = vendors.filter(
    (vendor) => vendor.contact_phone || vendor.contact_email,
  ).length;
  const stages = [
    {
      label: "Wedding brief saved",
      detail: "Timeline and budget are ready",
      done: true,
      icon: CheckCircle2,
      href: "/settings" as const,
    },
    {
      label: "AI matches public sources",
      detail: shortlisted
        ? `${shortlisted} saved matches to review`
        : "Research is finding source-backed options",
      done: shortlisted > 0,
      icon: Search,
      href: "/vendors" as const,
    },
    {
      label: "You build the shortlist",
      detail: shortlisted
        ? `${contactable} have contact details`
        : "Review matches before adding anyone",
      done: shortlisted > 0,
      icon: UserRoundCheck,
      href: "/vendors" as const,
    },
    {
      label: "Approved outreach",
      detail: contacted
        ? `${contacted} vendors contacted or quoted`
        : "Select contacts, then approve a message or call",
      done: contacted > 0,
      icon: PhoneCall,
      href: "/messages" as const,
    },
    {
      label: "Booking confirmation",
      detail: booked ? `${booked} vendors marked booked` : "Only you confirm bookings and payments",
      done: booked > 0,
      icon: Sparkles,
      href: "/vendors" as const,
    },
  ];

  return (
    <section className="soft-card overflow-hidden" aria-labelledby="concierge-flow-title">
      <div className="border-b border-primary/10 bg-gradient-to-r from-primary/8 via-purple-brand/6 to-transparent p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Your AI concierge
            </div>
            <h2 id="concierge-flow-title" className="mt-1 font-display text-xl">
              From brief to booking, with you in control
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Research can run in the background. Shortlisting, outreach, and booking always move
              forward only when you choose.
            </p>
          </div>
        </div>
      </div>
      <ol className="grid divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
        {stages.map((stage, index) => {
          const Icon = stage.done ? CheckCircle2 : Circle;
          return (
            <li key={stage.label} className="relative min-w-0 p-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="mt-2 flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    stage.done ? "text-emerald-600" : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{stage.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {stage.detail}
                  </p>
                </div>
              </div>
              <Link
                to={stage.href}
                className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
              >
                Open
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-border bg-secondary/25 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        Public research permission does not grant permission to call, message, negotiate, or book.
        Those actions require a separate, per-campaign confirmation.
      </p>
    </section>
  );
}
