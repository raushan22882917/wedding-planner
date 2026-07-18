import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Sparkles, TrendingDown, TrendingUp, Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listBudget, upsertCategory, deleteCategory, upsertExpense, deleteExpense,
} from "@/lib/planner.functions";

export const Route = createFileRoute("/_app/budget")({ component: BudgetPage });

const palette = [
  "oklch(0.62 0.22 5)", "oklch(0.55 0.24 293)", "oklch(0.75 0.13 88)",
  "oklch(0.7 0.17 152)", "oklch(0.6 0.12 240)", "oklch(0.65 0.15 30)",
  "oklch(0.55 0.1 200)", "oklch(0.5 0.05 260)",
];

function BudgetPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBudget);
  const upsertCatFn = useServerFn(upsertCategory);
  const deleteCatFn = useServerFn(deleteCategory);
  const upsertExpFn = useServerFn(upsertExpense);
  const deleteExpFn = useServerFn(deleteExpense);

  const q = useQuery({ queryKey: ["budget"], queryFn: () => listFn() });

  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [expOpen, setExpOpen] = useState(false);
  const [editExp, setEditExp] = useState<any>(null);

  const inv = () => qc.invalidateQueries({ queryKey: ["budget"] });

  const upsertCat = useMutation({ mutationFn: (d: any) => upsertCatFn({ data: d }), onSuccess: () => { inv(); setCatOpen(false); toast.success("Saved"); }, onError: (e: any) => toast.error(e.message) });
  const delCat = useMutation({ mutationFn: (id: string) => deleteCatFn({ data: { id } }), onSuccess: () => { inv(); toast.success("Removed"); } });
  const upsertExp = useMutation({ mutationFn: (d: any) => upsertExpFn({ data: d }), onSuccess: () => { inv(); setExpOpen(false); }, onError: (e: any) => toast.error(e.message) });
  const delExp = useMutation({ mutationFn: (id: string) => deleteExpFn({ data: { id } }), onSuccess: () => inv() });

  const categories = q.data?.categories ?? [];
  const expenses = q.data?.expenses ?? [];

  const catRows = useMemo(() => categories.map((c, i) => {
    const spent = expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0);
    return { ...c, spent, color: c.color && c.color.startsWith("oklch") ? c.color : palette[i % palette.length] };
  }), [categories, expenses]);

  const total = catRows.reduce((s, c) => s + Number(c.planned), 0);
  const spent = catRows.reduce((s, c) => s + c.spent, 0);
  const remaining = total - spent;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Budget"
        title="Money & margins"
        subtitle="Real-time view of every rupee across your categories."
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setEditCat({}); setCatOpen(true); }}><Plus className="h-4 w-4" />Category</Button>
            <Button className="rounded-full bg-primary hover:bg-primary/90" onClick={() => { setEditExp({}); setExpOpen(true); }} disabled={categories.length === 0}><Plus className="h-4 w-4" />Expense</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="soft-card p-6 lg:col-span-2 bg-gradient-to-br from-primary/5 via-transparent to-purple-brand/5 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total budget</div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <div className="font-display text-4xl sm:text-5xl">{fmt(total)}</div>
            <div className="text-sm text-muted-foreground">across {catRows.length} {catRows.length === 1 ? "category" : "categories"}</div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Spent</div>
              <div className="font-display text-2xl mt-1 tabular-nums">{fmt(spent)}</div>
              <div className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3" /> {total ? `${Math.round((spent/total)*100)}% used` : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Remaining</div>
              <div className="font-display text-2xl mt-1 tabular-nums">{fmt(remaining)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{total ? `${Math.round((remaining/total)*100)}% left` : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Expenses</div>
              <div className="font-display text-2xl mt-1 tabular-nums">{expenses.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{expenses.filter(e => e.paid).length} paid</div>
            </div>
          </div>
          <Progress value={total ? (spent / total) * 100 : 0} className="h-2 mt-6" />
        </div>

        <div className="soft-card p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">By category</div>
          {catRows.length === 0 ? (
            <div className="h-[220px] grid place-items-center text-sm text-muted-foreground">No categories yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catRows} dataKey="spent" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {catRows.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }} formatter={(v: any) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {q.isLoading ? (
        <div className="soft-card p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : catRows.length === 0 ? (
        <EmptyState icon={Wallet} title="No categories yet" subtitle="Add categories like Venue, Catering, Attire to start tracking your budget."
          action={<Button onClick={() => { setEditCat({}); setCatOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" />Add category</Button>}
        />
      ) : (
        <div className="soft-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-display text-lg">Category breakdown</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-secondary/50 text-muted-foreground text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Category</th>
                  <th className="text-right px-5 py-3 font-medium">Planned</th>
                  <th className="text-right px-5 py-3 font-medium">Spent</th>
                  <th className="text-right px-5 py-3 font-medium">Remaining</th>
                  <th className="text-left px-5 py-3 font-medium w-56">Utilization</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catRows.map(c => {
                  const planned = Number(c.planned);
                  const pct = planned ? (c.spent / planned) * 100 : 0;
                  const variance = pct > 90 ? "high" : pct > 50 ? "ok" : "low";
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-secondary/30 group">
                      <td className="px-5 py-3.5 font-medium">
                        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{fmt(planned)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{fmt(c.spent)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{fmt(planned - c.spent)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: c.color }} />
                          </div>
                          <span className={`text-[11px] w-14 text-right ${variance === "high" ? "text-amber-700" : "text-muted-foreground"}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditCat(c); setCatOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => delCat.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="soft-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-display text-lg">Recent expenses</div>
          <Button size="sm" variant="outline" onClick={() => { setEditExp({}); setExpOpen(true); }} disabled={categories.length === 0}>
            <Plus className="h-3.5 w-3.5" />Add expense
          </Button>
        </div>
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No expenses logged yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {expenses.slice(0, 20).map(e => {
              const cat = categories.find(c => c.id === e.category_id);
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 group">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{e.description}</div>
                    <div className="text-[11.5px] text-muted-foreground flex items-center gap-2">
                      {cat?.name ?? "Uncategorized"}
                      {e.vendor && <><span>·</span><span>{e.vendor}</span></>}
                      {e.due_date && <><span>·</span><span>Due {new Date(e.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></>}
                    </div>
                  </div>
                  <span className={`text-[10.5px] font-medium rounded-full px-2 py-0.5 ${e.paid ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                    {e.paid ? "Paid" : "Due"}
                  </span>
                  <div className="text-[13.5px] font-semibold tabular-nums w-24 text-right">{fmt(Number(e.amount))}</div>
                  <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditExp(e); setExpOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => delExp.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="soft-card p-5 bg-gradient-to-br from-primary/5 to-purple-brand/5 border-primary/15">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-purple-brand grid place-items-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-primary">Budget insight</div>
            <div className="text-[14px] mt-1 leading-relaxed max-w-2xl">
              {total === 0 ? "Set your total budget by adding categories — MarryMap will track every expense against them in real time." :
                spent > total ? `You're ${fmt(spent - total)} over budget. Review the largest categories below.` :
                remaining > 0 ? `You still have ${fmt(remaining)} to allocate — that's ${Math.round((remaining/total)*100)}% headroom.` :
                "Budget fully allocated. Nice discipline."}
            </div>
          </div>
        </div>
      </div>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat?.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            upsertCat.mutate({
              id: editCat?.id,
              name: String(f.get("name") || "").trim(),
              planned: Number(f.get("planned") || 0),
            });
          }} className="space-y-3.5">
            <div><Label>Name</Label><Input name="name" required defaultValue={editCat?.name ?? ""} placeholder="Venue, Catering…" /></div>
            <div><Label>Planned amount (₹)</Label><Input name="planned" type="number" min={0} step="0.01" required defaultValue={editCat?.planned ?? 0} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsertCat.isPending}>{upsertCat.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editExp?.id ? "Edit expense" : "New expense"}</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            upsertExp.mutate({
              id: editExp?.id,
              description: String(f.get("description") || "").trim(),
              vendor: (f.get("vendor") as string) || null,
              amount: Number(f.get("amount") || 0),
              paid: f.get("paid") === "on",
              due_date: (f.get("due_date") as string) || null,
              category_id: (f.get("category_id") as string) || null,
            });
          }} className="space-y-3.5">
            <div><Label>Description</Label><Input name="description" required defaultValue={editExp?.description ?? ""} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₹)</Label><Input name="amount" type="number" min={0} step="0.01" required defaultValue={editExp?.amount ?? 0} /></div>
              <div><Label>Due date</Label><Input name="due_date" type="date" defaultValue={editExp?.due_date ?? ""} /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Select name="category_id" defaultValue={editExp?.category_id ?? categories[0]?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vendor</Label><Input name="vendor" defaultValue={editExp?.vendor ?? ""} /></div>
            <div className="flex items-center gap-2"><input id="paid" name="paid" type="checkbox" defaultChecked={editExp?.paid ?? false} className="h-4 w-4 rounded" /><Label htmlFor="paid">Marked as paid</Label></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsertExp.isPending}>{upsertExp.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
