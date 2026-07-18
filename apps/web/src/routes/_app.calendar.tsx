import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTimeline } from "@/lib/planner.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

const tones = ["bg-primary/10 text-primary", "bg-purple-brand/10 text-purple-brand", "bg-emerald-50 text-emerald-700", "bg-gold-brand/15 text-gold-brand", "bg-blue-50 text-blue-700"];

function CalendarPage() {
  const listFn = useServerFn(listTimeline);
  const q = useQuery({ queryKey: ["timeline"], queryFn: () => listFn() });
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const { firstWeekday, daysInMonth } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // Monday = 0
    const dow = (first.getDay() + 6) % 7;
    return { firstWeekday: dow, daysInMonth: last.getDate() };
  }, [cursor]);

  const events = q.data ?? [];
  const byDay = useMemo(() => {
    const map = new Map<number, typeof events>();
    for (const e of events) {
      const d = new Date(e.event_date);
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const k = d.getDate();
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(e);
      }
    }
    return map;
  }, [events, cursor]);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === d;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title={cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        subtitle="All your wedding events at a glance — synced with the timeline."
        action={
          <div className="flex gap-1 items-center">
            <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" className="rounded-full" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
            <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />

      <div className="soft-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const evs = d ? byDay.get(d) ?? [] : [];
            return (
              <div key={i} className="min-h-[110px] border-r border-b border-border p-2 last:border-r-0">
                <div className={`text-[12px] font-medium ${d && isToday(d) ? "h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center" : d ? "" : "text-muted-foreground/40"}`}>
                  {d ?? ""}
                </div>
                <div className="mt-1.5 space-y-1">
                  {evs.slice(0, 3).map((e, j) => (
                    <div key={e.id} className={`text-[10.5px] rounded px-1.5 py-0.5 truncate ${tones[j % tones.length]}`}>
                      {e.start_time ? `${e.start_time.slice(0, 5)} ` : ""}{e.title}
                    </div>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[12.5px] text-muted-foreground text-center">
        Manage events on the <Link to="/timeline" className="text-primary hover:underline">Timeline</Link> page.
      </div>
    </div>
  );
}
