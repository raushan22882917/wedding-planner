import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Folder, ImageIcon, Receipt, Search, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listDocuments, upsertDocument, deleteDocument } from "@/lib/planner.functions";

export const Route = createFileRoute("/_app/documents")({ component: DocumentsPage });

type D = Awaited<ReturnType<typeof listDocuments>>[number];

const folderIcons: Record<string, any> = {
  Contracts: FileText, Invoices: Receipt, Quotes: FileText, Receipts: Receipt, Inspiration: ImageIcon,
};

function DocumentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocuments);
  const upsertFn = useServerFn(upsertDocument);
  const deleteFn = useServerFn(deleteDocument);

  const q = useQuery({ queryKey: ["documents"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("All");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<D> | null>(null);

  const upsert = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); setOpen(false); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); toast.success("Removed"); },
  });

  const docs = q.data ?? [];
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    docs.forEach(d => counts.set(d.folder, (counts.get(d.folder) ?? 0) + 1));
    return Array.from(counts.entries());
  }, [docs]);
  const filtered = useMemo(() => docs.filter(d => {
    if (folder !== "All" && d.folder !== folder) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [docs, folder, search]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Documents"
        title="All your paperwork"
        subtitle={`${docs.length} document${docs.length === 1 ? "" : "s"} across ${folders.length} folder${folders.length === 1 ? "" : "s"}.`}
        action={
          <Button onClick={() => { setEditing({ folder: "Contracts" }); setOpen(true); }} className="rounded-full bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />Add document
          </Button>
        }
      />

      {folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["All", docs.length] as [string, number], ...folders].map(([name, count]) => {
            const Icon = folderIcons[name] ?? Folder;
            const active = folder === name;
            return (
              <button key={name} onClick={() => setFolder(name)} className={`soft-card p-4 text-left hover-lift transition ${active ? "ring-2 ring-primary/40" : ""}`}>
                <div className="h-9 w-9 rounded-xl bg-primary/8 text-primary grid place-items-center"><Icon className="h-4 w-4" /></div>
                <div className="text-[13.5px] font-medium mt-3">{name}</div>
                <div className="text-[11.5px] text-muted-foreground">{count} file{count === 1 ? "" : "s"}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="soft-card p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-lg bg-secondary outline-hidden text-[13.5px]"
            placeholder="Search documents…" />
        </div>
      </div>

      {q.isLoading ? (
        <div className="soft-card p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title={docs.length === 0 ? "No documents yet" : "No matches"}
          subtitle={docs.length === 0 ? "Track contracts, invoices, and quotes with a link to the file." : "Try a different search."}
          action={docs.length === 0 && <Button onClick={() => { setEditing({ folder: "Contracts" }); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" />Add document</Button>}
        />
      ) : (
        <div className="soft-card overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(d => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 group">
                <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate">{d.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {d.folder}
                    {d.tag && <> · {d.tag}</>}
                    {d.size_bytes && <> · {(d.size_bytes / 1024).toFixed(0)} KB</>}
                    <> · {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>
                  </div>
                </div>
                {d.storage_path && <a href={d.storage_path} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => del.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit document" : "Add document"}</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const size = f.get("size_bytes");
            upsert.mutate({
              id: editing?.id,
              name: String(f.get("name") || "").trim(),
              folder: String(f.get("folder") || "General"),
              tag: (f.get("tag") as string) || null,
              storage_path: (f.get("storage_path") as string) || null,
              size_bytes: size ? Number(size) : null,
            });
          }} className="space-y-3.5">
            <div><Label>Name</Label><Input name="name" required defaultValue={editing?.name ?? ""} placeholder="Leela Palace contract.pdf" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Folder</Label>
                <Select name="folder" defaultValue={editing?.folder ?? "Contracts"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Contracts", "Invoices", "Quotes", "Receipts", "Inspiration", "General"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tag</Label><Input name="tag" defaultValue={editing?.tag ?? ""} /></div>
            </div>
            <div><Label>Link (URL)</Label><Input name="storage_path" defaultValue={editing?.storage_path ?? ""} placeholder="https://drive.google.com/…" /></div>
            <div><Label>Size (bytes, optional)</Label><Input name="size_bytes" type="number" min={0} defaultValue={editing?.size_bytes ?? ""} /></div>
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
