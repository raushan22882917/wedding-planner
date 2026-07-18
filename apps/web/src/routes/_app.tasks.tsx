import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Plus, Trash2, Pencil, ListChecks } from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listTasks, upsertTask, deleteTask } from "@/lib/planner.functions";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

const tone: Record<string, string> = {
  high: "text-rose-700 bg-rose-50 border-rose-100",
  medium: "text-amber-700 bg-amber-50 border-amber-100",
  low: "text-muted-foreground bg-secondary border-border",
};

function TasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const upsertFn = useServerFn(upsertTask);
  const deleteFn = useServerFn(deleteTask);

  const q = useQuery({ queryKey: ["tasks"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<TaskRow> | null>(null);
  const [open, setOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (t: TaskRow) => upsertFn({ data: { id: t.id, title: t.title, done: !t.done, priority: t.priority as "low" | "medium" | "high" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task removed"); },
  });

  const tasks = q.data ?? [];
  const stats = useMemo(() => {
    const now = new Date();
    return {
      done: tasks.filter(t => t.done).length,
      open: tasks.filter(t => !t.done).length,
      overdue: tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < now).length,
    };
  }, [tasks]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Tasks"
        title="Your checklist"
        subtitle={`${stats.done} completed · ${stats.open} open · ${stats.overdue} overdue`}
        action={
          <Button onClick={() => { setEditing({ priority: "medium" }); setOpen(true); }} className="rounded-full bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />New task
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="soft-card p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet" subtitle="Add your first to-do and stay ahead of every deadline."
          action={<Button onClick={() => { setEditing({ priority: "medium" }); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" />Add task</Button>}
        />
      ) : (
        <div className="soft-card overflow-hidden">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/40 group">
              <Checkbox checked={task.done} onCheckedChange={() => toggle.mutate(task)} />
              <div className="flex-1 min-w-0">
                <div className={`text-[14px] ${task.done ? "line-through text-muted-foreground" : "font-medium"}`}>{task.title}</div>
                <div className="flex items-center gap-2 mt-1 text-[11.5px] text-muted-foreground">
                  {task.due_date && <>{new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<span>·</span></>}
                  <span>{task.category ?? "General"}</span>
                </div>
              </div>
              <span className={`text-[10.5px] font-medium rounded-full px-2 py-0.5 border ${tone[task.priority]}`}>{task.priority}</span>
              <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(task); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => del.mutate(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            upsert.mutate({
              id: editing?.id,
              title: String(f.get("title") || "").trim(),
              notes: (f.get("notes") as string) || null,
              due_date: (f.get("due_date") as string) || null,
              priority: f.get("priority") as any,
              category: (f.get("category") as string) || null,
              done: editing?.done ?? false,
            });
          }} className="space-y-3.5">
            <div><Label>Title</Label><Input name="title" required defaultValue={editing?.title ?? ""} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Due date</Label><Input name="due_date" type="date" defaultValue={editing?.due_date ?? ""} /></div>
              <div>
                <Label>Priority</Label>
                <Select name="priority" defaultValue={editing?.priority ?? "medium"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Category</Label><Input name="category" defaultValue={editing?.category ?? ""} placeholder="Decor, Attire, Venue…" /></div>
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
