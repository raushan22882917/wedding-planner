import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/app-shell/empty-state";
import { CeremonyBuilder } from "@/components/planner/ceremony-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarClock, Trash2, Pencil, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listTimeline, upsertTimeline, deleteTimeline } from "@/lib/planner.functions";

export const Route = createFileRoute("/_app/timeline")({ component: TimelinePage });

type TL = Awaited<ReturnType<typeof listTimeline>>[number];

function TimelinePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTimeline);
  const upsertFn = useServerFn(upsertTimeline);
  const deleteFn = useServerFn(deleteTimeline);

  const q = useQuery({ queryKey: ["timeline"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TL> | null>(null);

  const upsert = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timeline"] }); setOpen(false); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timeline"] }); toast.success("Removed"); },
  });

  const events = q.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, TL[]>();
    for (const e of events) {
      const key = e.event_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Timeline"
        title="Wedding week schedule"
        subtitle="Every event, ceremony, and vendor visit — organized by day."
        action={
          <Button onClick={() => { setEditing({ event_date: new Date().toISOString().slice(0, 10) }); setOpen(true); }} className="rounded-full bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />New event
          </Button>
        }
      />

      <CeremonyBuilder events={events} />

      {q.isLoading ? (
        <div className="soft-card p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No events scheduled" subtitle="Add ceremony blocks, vendor visits, or family events to build your timeline."
          action={<Button onClick={() => { setEditing({ event_date: new Date().toISOString().slice(0, 10) }); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" />Add first event</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="soft-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{new Date(date).toLocaleDateString(undefined, { weekday: "long" })}</div>
                  <div className="font-display text-lg">{new Date(date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
                </div>
                <span className="text-[11px] text-muted-foreground">{items.length} {items.length === 1 ? "event" : "events"}</span>
              </div>
              <div className="divide-y divide-border">
                {items.map(e => (
                  <div key={e.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-secondary/30">
                    <div className="w-20 shrink-0 text-[12px] tabular-nums text-muted-foreground pt-0.5">
                      {e.start_time ? e.start_time.slice(0, 5) : "All day"}
                      {e.end_time && <div className="text-[10.5px]">– {e.end_time.slice(0, 5)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium">{e.title}</div>
                      {e.location && <div className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{e.location}</div>}
                      {e.notes && <div className="text-[12.5px] text-muted-foreground mt-1">{e.notes}</div>}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => del.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            upsert.mutate({
              id: editing?.id,
              title: String(f.get("title") || "").trim(),
              event_date: String(f.get("event_date") || ""),
              start_time: (f.get("start_time") as string) || null,
              end_time: (f.get("end_time") as string) || null,
              location: (f.get("location") as string) || null,
              notes: (f.get("notes") as string) || null,
            });
          }} className="space-y-3.5">
            <div><Label>Title</Label><Input name="title" required defaultValue={editing?.title ?? ""} placeholder="Mehendi ceremony" /></div>
            <div><Label>Date</Label><Input name="event_date" type="date" required defaultValue={editing?.event_date ?? ""} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start time</Label><Input name="start_time" type="time" defaultValue={editing?.start_time ?? ""} /></div>
              <div><Label>End time</Label><Input name="end_time" type="time" defaultValue={editing?.end_time ?? ""} /></div>
            </div>
            <div><Label>Location</Label><Input name="location" defaultValue={editing?.location ?? ""} /></div>
            <div><Label>Notes</Label><Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
