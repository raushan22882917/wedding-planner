import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Users,
  Trash2,
  Pencil,
  Search,
  Upload,
  FileSpreadsheet,
  CircleAlert,
  CheckCircle2,
  Download,
  MessageCircleHeart,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { importGuests, listGuests, upsertGuest, deleteGuest } from "@/lib/planner.functions";
import { guestImportTemplate, parseGuestImport, type GuestImportPreview } from "@/lib/guest-import";
import { listWeddingRsvps } from "@/lib/wedding-website.functions";

export const Route = createFileRoute("/_app/guests")({
  component: GuestsPage,
});

type GuestRow = Awaited<ReturnType<typeof listGuests>>[number];
type WeddingRsvpRow = Awaited<ReturnType<typeof listWeddingRsvps>>[number];

type GuestDirectoryRow = {
  id: string;
  name: string;
  source: "guest_list" | "website_rsvp";
  side: string;
  relationship: string | null;
  rsvpStatus: "pending" | "yes" | "no" | "maybe";
  partySize: number;
  phone: string | null;
  email: string | null;
  note: string | null;
  ceremonies: string[];
  createdAt: string;
  guest?: GuestRow;
};

const rsvpTone: Record<string, string> = {
  yes: "text-emerald-700 bg-emerald-50 border-emerald-100",
  pending: "text-amber-700 bg-amber-50 border-amber-100",
  no: "text-rose-700 bg-rose-50 border-rose-100",
  maybe: "text-blue-700 bg-blue-50 border-blue-100",
};

const guestTemplateUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(guestImportTemplate)}`;

function ceremonyLabels(value: WeddingRsvpRow["ceremonies"]) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((id) => id.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function GuestsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGuests);
  const upsertFn = useServerFn(upsertGuest);
  const deleteFn = useServerFn(deleteGuest);
  const importFn = useServerFn(importGuests);
  const listWeddingRsvpsFn = useServerFn(listWeddingRsvps);

  const q = useQuery({ queryKey: ["guests"], queryFn: () => listFn() });
  const weddingRsvps = useQuery({
    queryKey: ["wedding-rsvps"],
    queryFn: () => listWeddingRsvpsFn(),
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<GuestRow> | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<GuestImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const upsert = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      setOpen(false);
      toast.success("Guest saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      toast.success("Guest removed");
    },
  });
  const bulkImport = useMutation({
    mutationFn: () => importFn({ data: { guests: importPreview?.guests ?? [] } }),
    onSuccess: ({ imported, skipped }) => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      setImportOpen(false);
      setImportPreview(null);
      setImportFileName("");
      toast.success(`Imported ${imported} guest${imported === 1 ? "" : "s"}`, {
        description: skipped
          ? `${skipped} duplicate guest${skipped === 1 ? " was" : "s were"} skipped.`
          : undefined,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guests = q.data ?? [];
  const guestDirectory = useMemo<GuestDirectoryRow[]>(() => {
    const manualGuests = guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      source: "guest_list" as const,
      side: guest.side,
      relationship: guest.relationship,
      rsvpStatus: guest.rsvp_status as GuestDirectoryRow["rsvpStatus"],
      partySize: guest.plus_one ? 2 : 1,
      phone: guest.phone,
      email: guest.email,
      note: guest.notes,
      ceremonies: [],
      createdAt: guest.created_at,
      guest,
    }));
    const invitationRsvps = (weddingRsvps.data ?? []).map((rsvp) => ({
      id: `website-rsvp-${rsvp.id}`,
      name: rsvp.name,
      source: "website_rsvp" as const,
      side: "invitation",
      relationship: "Submitted through wedding website",
      rsvpStatus: rsvp.response as GuestDirectoryRow["rsvpStatus"],
      partySize: rsvp.guest_count,
      phone: rsvp.phone,
      email: rsvp.email,
      note: rsvp.message,
      ceremonies: ceremonyLabels(rsvp.ceremonies),
      createdAt: rsvp.created_at,
    }));
    return [...invitationRsvps, ...manualGuests].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [guests, weddingRsvps.data]);
  const filtered = useMemo(
    () =>
      guestDirectory.filter(
        (guest) =>
          !search ||
          guest.name.toLowerCase().includes(search.toLowerCase()) ||
          (guest.relationship ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (guest.phone ?? "").includes(search) ||
          (guest.email ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [guestDirectory, search],
  );

  const stats = useMemo(
    () => ({
      total: guestDirectory.length,
      websiteRsvps: guestDirectory.filter((guest) => guest.source === "website_rsvp").length,
      yes: guestDirectory.filter((guest) => guest.rsvpStatus === "yes").length,
      pending: guestDirectory.filter((guest) => guest.rsvpStatus === "pending").length,
      no: guestDirectory.filter((guest) => guest.rsvpStatus === "no").length,
      maybe: guestDirectory.filter((guest) => guest.rsvpStatus === "maybe").length,
    }),
    [guestDirectory],
  );

  const openNew = () => {
    setEditing({ side: "both", rsvp_status: "pending", plus_one: false });
    setOpen(true);
  };
  const openEdit = (g: GuestRow) => {
    setEditing(g);
    setOpen(true);
  };
  const selectImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name)) {
      toast.error("Upload a CSV or TSV file exported from Excel or Google Sheets.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Keep the guest file under 2 MB.");
      return;
    }
    const preview = parseGuestImport(await file.text());
    setImportFileName(file.name);
    setImportPreview(preview);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Guests"
        title="Guest management"
        subtitle={`${stats.total} guest records · ${stats.yes} confirmed · ${stats.websiteRsvps} website RSVPs`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-full">
              <Upload className="h-4 w-4" />
              Import guests
            </Button>
            <Button onClick={openNew} className="rounded-full bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add guest
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "Total", n: stats.total, c: "text-primary bg-primary/8" },
          { l: "Website RSVPs", n: stats.websiteRsvps, c: "text-primary bg-primary/8" },
          { l: "Confirmed", n: stats.yes, c: "text-emerald-700 bg-emerald-50" },
          { l: "Pending", n: stats.pending, c: "text-amber-700 bg-amber-50" },
          { l: "Declined", n: stats.no, c: "text-rose-700 bg-rose-50" },
          { l: "Maybe", n: stats.maybe, c: "text-purple-brand bg-purple-brand/8" },
        ].map((s) => (
          <div key={s.l} className="soft-card p-4">
            <div
              className={`inline-block text-[10.5px] font-medium rounded-full px-2 py-0.5 ${s.c}`}
            >
              {s.l}
            </div>
            <div className="font-display text-2xl mt-2 tabular-nums">{s.n}</div>
          </div>
        ))}
      </div>

      <div className="soft-card p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-lg bg-secondary outline-hidden text-[13.5px]"
            placeholder="Search name, contact, or relation…"
            aria-label="Search guest names, contact details, or relationships"
          />
        </div>
      </div>

      {weddingRsvps.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div>
            <p className="font-medium">Website RSVP replies could not load right now.</p>
            <p className="mt-1 text-xs text-amber-800">
              Your manual guest list is still available. Try refreshing the invitation replies.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-amber-200 bg-white"
            onClick={() => weddingRsvps.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {q.isLoading || weddingRsvps.isLoading ? (
        <div className="soft-card p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={guestDirectory.length === 0 ? "No guests yet" : "No matches"}
          subtitle={
            guestDirectory.length === 0
              ? "Add guests manually or publish your invitation to collect website RSVP replies here."
              : "Try a different search term."
          }
          action={
            guestDirectory.length === 0 && (
              <Button onClick={openNew} className="rounded-full">
                <Plus className="h-4 w-4" />
                Add first guest
              </Button>
            )
          }
        />
      ) : (
        <div className="soft-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-secondary/50 text-muted-foreground text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Guest</th>
                  <th className="text-left px-5 py-3 font-medium">Source</th>
                  <th className="text-left px-5 py-3 font-medium">RSVP</th>
                  <th className="text-left px-5 py-3 font-medium">Party</th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium">RSVP details</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((guest) => (
                  <tr key={guest.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/25 to-purple-brand/25 grid place-items-center text-[10px] font-semibold text-primary shrink-0">
                          {guest.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">{guest.name}</span>
                          {guest.source === "guest_list" && (guest.side !== "both" || guest.relationship) && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {guest.side !== "both" ? `${guest.side} side` : "Both sides"}
                              {guest.relationship ? ` · ${guest.relationship}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {guest.source === "website_rsvp" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-2 py-1 text-[11px] font-medium text-primary">
                          <MessageCircleHeart className="h-3.5 w-3.5" />
                          Website RSVP
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Guest list</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${rsvpTone[guest.rsvpStatus]}`}
                      >
                        {guest.rsvpStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {guest.partySize} guest{guest.partySize === 1 ? "" : "s"}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-[12px]">
                      {guest.phone || guest.email || "—"}
                    </td>
                    <td className="max-w-[19rem] px-5 py-3.5">
                      {guest.source === "website_rsvp" ? (
                        <div className="space-y-1.5 text-[11px] leading-5 text-muted-foreground">
                          {guest.ceremonies.length > 0 && <p>{guest.ceremonies.join(" · ")}</p>}
                          {guest.note && <p className="line-clamp-2">“{guest.note}”</p>}
                          {!guest.ceremonies.length && !guest.note && <span>—</span>}
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">{guest.note || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {guest.guest ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Edit ${guest.name}`}
                            onClick={() => openEdit(guest.guest!)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-600"
                            aria-label={`Remove ${guest.name}`}
                            onClick={() => del.mutate(guest.guest!.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                          Saved by RSVP
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={importOpen}
        onOpenChange={(next) => {
          setImportOpen(next);
          if (!next) {
            setImportPreview(null);
            setImportFileName("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import guests</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Upload a CSV or TSV guest list</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Export your file from Excel or Google Sheets first. We match common column names
                    such as Name, Phone, WhatsApp, RSVP, and Plus one.
                  </p>
                  <a
                    href={guestTemplateUrl}
                    download="marrymap-guest-import-template.csv"
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download CSV template
                  </a>
                </div>
              </div>
            </div>

            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-secondary/20 p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring">
              <Upload className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-medium">{importFileName || "Choose a guest file"}</p>
              <p className="mt-1 text-xs text-muted-foreground">CSV or TSV · up to 500 guests</p>
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                className="sr-only"
                onClick={(event) => {
                  event.currentTarget.value = "";
                }}
                onChange={(event) => void selectImportFile(event.currentTarget.files?.[0])}
              />
            </label>

            {importPreview && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-secondary/60 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Rows found
                    </p>
                    <p className="mt-1 font-display text-xl">{importPreview.totalRows}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-emerald-700">
                      Ready to import
                    </p>
                    <p className="mt-1 font-display text-xl text-emerald-800">
                      {importPreview.guests.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-amber-700">
                      Needs attention
                    </p>
                    <p className="mt-1 font-display text-xl text-amber-800">
                      {importPreview.issues.length}
                    </p>
                  </div>
                </div>

                {importPreview.guests.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="border-b border-border bg-secondary/40 px-4 py-2 text-xs font-medium">
                      Preview · first {Math.min(5, importPreview.guests.length)} guests
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Side</th>
                            <th className="px-4 py-2">RSVP</th>
                            <th className="px-4 py-2">Contact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.guests.slice(0, 5).map((guest, index) => (
                            <tr key={`${guest.name}-${index}`} className="border-t border-border">
                              <td className="px-4 py-2.5 font-medium">{guest.name}</td>
                              <td className="px-4 py-2.5 capitalize">{guest.side}</td>
                              <td className="px-4 py-2.5 capitalize">{guest.rsvp_status}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {guest.phone || guest.email || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importPreview.issues.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Rows with issues are not imported
                    </div>
                    <ul className="mt-2 space-y-1 text-amber-800">
                      {importPreview.issues.slice(0, 5).map((issue) => (
                        <li key={`${issue.row}-${issue.message}`}>
                          Row {issue.row}: {issue.message}
                        </li>
                      ))}
                    </ul>
                    {importPreview.issues.length > 5 && (
                      <p className="mt-2 text-amber-800">
                        +{importPreview.issues.length - 5} more row issues
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!importPreview?.guests.length || bulkImport.isPending}
              onClick={() => bulkImport.mutate()}
            >
              {bulkImport.isPending ? (
                "Importing…"
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Import {importPreview?.guests.length ?? 0} guests
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit guest" : "New guest"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              upsert.mutate({
                id: editing?.id,
                name: String(f.get("name") || "").trim(),
                side: f.get("side") as any,
                relationship: (f.get("relationship") as string) || null,
                phone: (f.get("phone") as string) || null,
                email: (f.get("email") as string) || null,
                rsvp_status: f.get("rsvp_status") as any,
                plus_one: f.get("plus_one") === "on",
                dietary: (f.get("dietary") as string) || null,
                notes: (f.get("notes") as string) || null,
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <Label>Name</Label>
              <Input name="name" required defaultValue={editing?.name ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Side</Label>
                <Select name="side" defaultValue={editing?.side ?? "both"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bride">Bride</SelectItem>
                    <SelectItem value="groom">Groom</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RSVP</Label>
                <Select name="rsvp_status" defaultValue={editing?.rsvp_status ?? "pending"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Relationship</Label>
              <Input
                name="relationship"
                defaultValue={editing?.relationship ?? ""}
                placeholder="Cousin, colleague…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input name="phone" defaultValue={editing?.phone ?? ""} />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={editing?.email ?? ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch name="plus_one" defaultChecked={editing?.plus_one ?? false} />
              <Label>Plus-one</Label>
            </div>
            <div>
              <Label>Dietary</Label>
              <Input name="dietary" defaultValue={editing?.dietary ?? ""} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
