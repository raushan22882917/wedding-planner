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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera,
  Check,
  ExternalLink,
  Globe,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteVendor,
  listVendorResearchLeads,
  listVendors,
  selectVendorForWedding,
  upsertVendor,
} from "@/lib/planner.functions";
import { vendorWhatsAppMessage, whatsappChatUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/_app/vendors")({ component: VendorsPage });

type V = Awaited<ReturnType<typeof listVendors>>[number];
type ResearchLead = Awaited<ReturnType<typeof listVendorResearchLeads>>[number];

const statusTone: Record<string, string> = {
  shortlist: "text-muted-foreground bg-secondary",
  contacted: "text-blue-700 bg-blue-50",
  quoted: "text-purple-brand bg-purple-brand/10",
  booked: "text-emerald-700 bg-emerald-50",
  passed: "text-rose-700 bg-rose-50",
};

function VendorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVendors);
  const upsertFn = useServerFn(upsertVendor);
  const deleteFn = useServerFn(deleteVendor);
  const researchFn = useServerFn(listVendorResearchLeads);
  const selectLeadFn = useServerFn(selectVendorForWedding);

  const q = useQuery({ queryKey: ["vendors"], queryFn: () => listFn() });
  const research = useQuery({
    queryKey: ["vendor-research-leads"],
    queryFn: () => researchFn(),
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<V> | null>(null);

  const upsert = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setOpen(false);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Removed");
    },
  });
  const selectLead = useMutation({
    mutationFn: (directoryId: string) => selectLeadFn({ data: { directoryId } }),
    onSuccess: ({ created }) => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(created ? "Added to your wedding shortlist" : "Already on your shortlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vendors = q.data ?? [];
  const researchLeads = research.data ?? [];
  const selectedDirectoryIds = useMemo(
    () =>
      new Set(
        vendors.flatMap((vendor) =>
          vendor.source_directory_id ? [vendor.source_directory_id] : [],
        ),
      ),
    [vendors],
  );
  const filtered = useMemo(
    () =>
      vendors.filter((v) => {
        if (filter !== "all" && v.status !== filter) return false;
        if (
          search &&
          !v.name.toLowerCase().includes(search.toLowerCase()) &&
          !(v.category ?? "").toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [vendors, search, filter],
  );
  const filteredResearchLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return researchLeads;
    return researchLeads.filter((lead) =>
      [lead.name, lead.category, lead.city, lead.services]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [researchLeads, search]);

  const price = (v: V) => {
    if (v.price_low && v.price_high)
      return `₹${Number(v.price_low).toLocaleString("en-IN")} – ₹${Number(v.price_high).toLocaleString("en-IN")}`;
    if (v.price_low) return `from ₹${Number(v.price_low).toLocaleString("en-IN")}`;
    return "On request";
  };

  const leadServices = (lead: ResearchLead) =>
    Array.isArray(lead.services)
      ? lead.services.filter((service): service is string => typeof service === "string")
      : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Vendors"
        title="Your vendor shortlist"
        subtitle={`${vendors.length} saved · ${vendors.filter((v) => v.status === "booked").length} booked · ${vendors.filter((v) => v.status === "contacted").length} contacted`}
        action={
          <Button
            onClick={() => {
              setEditing({ status: "shortlist" });
              setOpen(true);
            }}
            className="rounded-full bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add vendor
          </Button>
        }
      />

      <section className="soft-card overflow-hidden" aria-labelledby="research-leads-title">
        <div className="flex flex-col gap-4 border-b border-primary/10 bg-gradient-to-r from-primary/8 via-purple-brand/6 to-gold-brand/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Source-backed AI research
            </div>
            <h2 id="research-leads-title" className="mt-1 font-display text-xl">
              Discover vendors for your wedding
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Review leads found in planning chats, then add the ones you want to contact, compare,
              and book.
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-primary/15 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {researchLeads.length} shared lead{researchLeads.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {research.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-[305px] w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredResearchLeads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/35 px-5 py-8 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-lg">
                {researchLeads.length === 0
                  ? "No research leads yet"
                  : "No matching research leads"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {researchLeads.length === 0
                  ? "Use MarryMap AI to research a category or city. Source-backed results will appear here automatically."
                  : "Try a different search to see more source-backed leads."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredResearchLeads.slice(0, 12).map((lead) => {
                const selected = selectedDirectoryIds.has(lead.id);
                const adding = selectLead.isPending && selectLead.variables === lead.id;
                const services = leadServices(lead);
                return (
                  <article
                    key={lead.id}
                    className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"
                  >
                    <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-primary/15 via-purple-brand/10 to-gold-brand/20">
                      {lead.image_url ? (
                        <img
                          src={lead.image_url}
                          alt={`${lead.name} venue or service`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-primary/35">
                          <Camera className="h-8 w-8" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2 py-1 text-[10px] font-semibold text-primary shadow-sm backdrop-blur-sm">
                        Source-backed
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-lg">{lead.name}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {lead.category ?? "Wedding vendor"}
                            {lead.city ? ` · ${lead.city}` : ""}
                          </p>
                        </div>
                        {lead.verification_status && (
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>

                      {lead.summary && (
                        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                          {lead.summary}
                        </p>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-secondary/65 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Price
                          </p>
                          <p className="mt-0.5 truncate font-medium text-foreground">
                            {lead.price ?? "On request"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary/65 px-2.5 py-2">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <UsersRound className="h-3 w-3" /> Capacity
                          </p>
                          <p className="mt-0.5 truncate font-medium text-foreground">
                            {lead.capacity ?? "Ask vendor"}
                          </p>
                        </div>
                      </div>

                      {services.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {services.slice(0, 3).map((service) => (
                            <span
                              key={service}
                              className="rounded-full bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary"
                            >
                              {service}
                            </span>
                          ))}
                          {services.length > 3 && (
                            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                              +{services.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-9 flex-1 rounded-full"
                          disabled={selected || selectLead.isPending}
                          onClick={() => selectLead.mutate(lead.id)}
                        >
                          {selected ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {selected
                            ? "On your shortlist"
                            : adding
                              ? "Adding…"
                              : "Add to my wedding"}
                        </Button>
                        <a
                          href={lead.website ?? lead.source_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${lead.name} source`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="shortlist-title">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your wedding
            </p>
            <h2 id="shortlist-title" className="mt-1 font-display text-xl">
              Selected vendors
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Track outreach, quotes, and bookings here.
          </p>
        </div>

        <div className="soft-card p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-transparent focus:bg-card focus:border-border outline-hidden text-[13.5px]"
              placeholder="Search your shortlist and research leads…"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "shortlist", "contacted", "quoted", "booked", "passed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] capitalize border transition ${filter === s ? "bg-foreground text-background border-foreground" : "border-border bg-card hover:border-primary/40"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {q.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={vendors.length === 0 ? "No vendors saved yet" : "No matches"}
            subtitle={
              vendors.length === 0
                ? "Choose a source-backed lead above, or add a vendor manually, to compare pricing, availability, and status."
                : "Try a different filter."
            }
            action={
              vendors.length === 0 && (
                <Button
                  onClick={() => {
                    setEditing({ status: "shortlist" });
                    setOpen(true);
                  }}
                  className="rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  Add first vendor
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((v) => (
              <div key={v.id} className="soft-card overflow-hidden hover-lift group">
                <div className="aspect-4/3 bg-gradient-to-br from-primary/15 via-purple-brand/10 to-gold-brand/15 relative">
                  <div className="absolute inset-0 grid place-items-center text-primary/30">
                    <Camera className="h-10 w-10" />
                  </div>
                  <span
                    className={`absolute top-3 left-3 rounded-full text-[10.5px] font-medium px-2 py-1 capitalize ${statusTone[v.status]}`}
                  >
                    {v.status}
                  </span>
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      onClick={() => {
                        setEditing(v);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full text-rose-600"
                      onClick={() => del.mutate(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-[16px] truncate">{v.name}</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">
                        {v.category ?? "Uncategorized"}
                      </div>
                    </div>
                    {v.rating != null && (
                      <div className="flex items-center gap-1 text-[12px] shrink-0">
                        <Star className="h-3.5 w-3.5 text-gold-brand fill-current" />
                        <span className="font-medium">{v.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {v.city ?? "—"}
                    </div>
                    <div className="text-[12.5px] font-semibold text-foreground">{price(v)}</div>
                  </div>
                  {(v.contact_phone || v.contact_email || v.website) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
                      {v.contact_phone && (
                        <a
                          href={
                            whatsappChatUrl(v.contact_phone, vendorWhatsAppMessage(v.name)) ??
                            `tel:${v.contact_phone}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                      {v.contact_phone && (
                        <a
                          href={`tel:${v.contact_phone}`}
                          aria-label={`Call ${v.name}`}
                          className="hover:text-primary"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {v.contact_email && (
                        <a href={`mailto:${v.contact_email}`} className="hover:text-primary">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {v.website && (
                        <a
                          href={v.website}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit vendor" : "Add vendor"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const lo = f.get("price_low");
              const hi = f.get("price_high");
              const rt = f.get("rating");
              upsert.mutate({
                id: editing?.id,
                name: String(f.get("name") || "").trim(),
                category: (f.get("category") as string) || null,
                city: (f.get("city") as string) || null,
                price_low: lo ? Number(lo) : null,
                price_high: hi ? Number(hi) : null,
                contact_name: (f.get("contact_name") as string) || null,
                contact_phone: (f.get("contact_phone") as string) || null,
                contact_email: (f.get("contact_email") as string) || null,
                website: (f.get("website") as string) || null,
                status: f.get("status") as any,
                rating: rt ? Number(rt) : null,
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
                <Label>Category</Label>
                <Input
                  name="category"
                  defaultValue={editing?.category ?? ""}
                  placeholder="Photography, Catering…"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input name="city" defaultValue={editing?.city ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Price low</Label>
                <Input
                  name="price_low"
                  type="number"
                  min={0}
                  defaultValue={editing?.price_low ?? ""}
                />
              </div>
              <div>
                <Label>Price high</Label>
                <Input
                  name="price_high"
                  type="number"
                  min={0}
                  defaultValue={editing?.price_high ?? ""}
                />
              </div>
              <div>
                <Label>Rating</Label>
                <Input
                  name="rating"
                  type="number"
                  min={0}
                  max={5}
                  step="1"
                  defaultValue={editing?.rating ?? ""}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={editing?.status ?? "shortlist"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["shortlist", "contacted", "quoted", "booked", "passed"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact name</Label>
                <Input name="contact_name" defaultValue={editing?.contact_name ?? ""} />
              </div>
              <div>
                <Label>WhatsApp / phone</Label>
                <Input
                  name="contact_phone"
                  defaultValue={editing?.contact_phone ?? ""}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  name="contact_email"
                  type="email"
                  defaultValue={editing?.contact_email ?? ""}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  name="website"
                  defaultValue={editing?.website ?? ""}
                  placeholder="https://"
                />
              </div>
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
