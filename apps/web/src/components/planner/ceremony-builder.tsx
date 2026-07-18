import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flower2,
  HeartHandshake,
  Landmark,
  Plus,
  ScrollText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ceremonyTraditions, type Ceremony } from "@/lib/ceremony-library";
import { getMyProfile } from "@/lib/profile.functions";
import { upsertTimeline } from "@/lib/planner.functions";

type TimelineEvent = {
  id: string;
  title: string;
  event_date: string;
};

type CeremonyPhase = "pre-wedding" | "wedding-day" | "post-wedding";

const traditionIcons: Record<string, ComponentType<{ className?: string }>> = {
  hindu: Landmark,
  muslim: HeartHandshake,
  christian: BookOpen,
  sikh: Flower2,
  buddhist: Sparkles,
  jewish: ScrollText,
  parsi: Circle,
  jain: Flower2,
  mixed: UsersRound,
};

const weddingDayTerms = [
  "baraat",
  "milni",
  "dwar puja",
  "jaimala",
  "varmala",
  "mala badal",
  "kanyadaan",
  "sampradan",
  "hast milap",
  "hasta milap",
  "gathbandhan",
  "agni puja",
  "phere",
  "saptapadi",
  "sapthapadi",
  "sindoor",
  "mangalsutra",
  "mangalya",
  "anand karaj",
  "laavan",
  "nikah",
  "khutbah",
  "mehr",
  "ijab",
  "nikahnama",
  "rukhsati",
  "wedding mass",
  "church ceremony",
  "processional",
  "vows",
  "rings",
  "pronouncement",
  "chuppah",
  "kiddushin",
  "ketubah",
  "breaking the glass",
  "ara antar",
  "haath borvanu",
  "ashirvad ceremony",
];

const postWeddingTerms = [
  "reception",
  "pag phera",
  "satyanarayan",
  "griha pravesh",
  "walima",
  "bou bhaat",
  "bashor ghar",
  "send-off",
];

function normalise(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function uniqueCeremonies(items: Ceremony[]) {
  const merged = new Map<string, Ceremony>();
  for (const item of items) {
    const key = normalise(item.name);
    const existing = merged.get(key);
    merged.set(key, existing ? { ...item, optional: Boolean(existing.optional && item.optional) } : item);
  }
  return Array.from(merged.values());
}

function phaseFor(name: string): CeremonyPhase {
  const value = normalise(name);
  if (postWeddingTerms.some((term) => value.includes(term))) return "post-wedding";
  if (weddingDayTerms.some((term) => value.includes(term))) return "wedding-day";
  return "pre-wedding";
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

function suggestedSchedule(ceremonies: Ceremony[], weddingDate: string) {
  const groups = {
    "pre-wedding": ceremonies.filter((ceremony) => phaseFor(ceremony.name) === "pre-wedding"),
    "wedding-day": ceremonies.filter((ceremony) => phaseFor(ceremony.name) === "wedding-day"),
    "post-wedding": ceremonies.filter((ceremony) => phaseFor(ceremony.name) === "post-wedding"),
  };

  return (Object.entries(groups) as Array<[CeremonyPhase, Ceremony[]]>).flatMap(([phase, items]) =>
    items.map((ceremony, index) => {
      const offset =
        phase === "pre-wedding"
          ? -Math.max(1, Math.ceil((items.length - index) / 4))
          : phase === "post-wedding"
            ? 1 + Math.floor(index / 4)
            : 0;
      return { ceremony, phase, event_date: addDays(weddingDate, offset) };
    }),
  );
}

function phaseLabel(phase: CeremonyPhase) {
  if (phase === "wedding-day") return "Wedding day";
  if (phase === "post-wedding") return "After the wedding";
  return "Before the wedding";
}

export function CeremonyBuilder({ events }: { events: TimelineEvent[] }) {
  const queryClient = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const saveTimeline = useServerFn(upsertTimeline);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const [traditionId, setTraditionId] = useState<string>();
  const [regionId, setRegionId] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [customCeremonies, setCustomCeremonies] = useState<Ceremony[]>([]);
  const [customName, setCustomName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  useEffect(() => {
    if (!weddingDate && profile.data?.wedding_date) setWeddingDate(profile.data.wedding_date);
  }, [profile.data?.wedding_date, weddingDate]);

  const tradition = ceremonyTraditions.find((item) => item.id === traditionId);
  const region = tradition?.regions?.find((item) => item.id === regionId);
  const availableCeremonies = useMemo(
    () => uniqueCeremonies([...(tradition?.ceremonies ?? []), ...(region?.ceremonies ?? []), ...customCeremonies]),
    [customCeremonies, region?.ceremonies, tradition?.ceremonies],
  );
  const selectedCeremonies = availableCeremonies.filter((ceremony) => selected.includes(ceremony.name));
  const schedule = weddingDate ? suggestedSchedule(selectedCeremonies, weddingDate) : [];
  const existingTitles = useMemo(() => new Set(events.map((event) => normalise(event.title))), [events]);
  const unscheduled = schedule.filter((item) => !existingTitles.has(normalise(item.ceremony.name)));

  const save = useMutation({
    mutationFn: async () => {
      if (!tradition) throw new Error("Choose a wedding tradition first.");
      if (!weddingDate) throw new Error("Choose your wedding date to place ceremonies on the timeline.");
      if (selectedCeremonies.length === 0) throw new Error("Select at least one ceremony.");
      if (unscheduled.length === 0) throw new Error("These ceremonies are already on your timeline.");

      await Promise.all(
        unscheduled.map((item) =>
          saveTimeline({
            data: {
              title: item.ceremony.name,
              event_date: item.event_date,
              notes: `Ceremony plan · ${tradition.label}${region ? ` · ${region.label}` : ""}. Suggested placement: ${phaseLabel(item.phase)}. Confirm details with your family and edit freely.`,
              color: item.phase === "wedding-day" ? "primary" : item.phase === "post-wedding" ? "purple" : "gold",
            },
          }),
        ),
      );
      return unscheduled.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success(`${count} ceremonies added to your timeline`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add ceremonies to your timeline."),
  });

  const chooseTradition = (nextTraditionId: string) => {
    const nextTradition = ceremonyTraditions.find((item) => item.id === nextTraditionId);
    const defaults = (nextTradition?.ceremonies ?? [])
      .filter((ceremony) => !ceremony.optional)
      .map((ceremony) => ceremony.name);
    setTraditionId(nextTraditionId);
    setRegionId(undefined);
    setCustomCeremonies([]);
    setSelected(defaults);
  };

  const chooseRegion = (nextRegionId: string) => {
    const nextRegion = tradition?.regions?.find((item) => item.id === nextRegionId);
    const defaults = uniqueCeremonies([...(tradition?.ceremonies ?? []), ...(nextRegion?.ceremonies ?? [])])
      .filter((ceremony) => !ceremony.optional)
      .map((ceremony) => ceremony.name);
    setRegionId(nextRegionId || undefined);
    setSelected(defaults);
  };

  const toggleCeremony = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const addCustomCeremony = () => {
    const name = customName.replace(/\s+/g, " ").trim();
    if (!name) return;
    if (availableCeremonies.some((ceremony) => normalise(ceremony.name) === normalise(name))) {
      toast.message("That ceremony is already in this plan.");
      return;
    }
    setCustomCeremonies((current) => [...current, { name }]);
    setSelected((current) => [...current, name]);
    setCustomName("");
  };

  return (
    <section className="soft-card overflow-hidden" aria-labelledby="ceremony-builder-title">
      <header className="border-b border-border bg-gradient-to-r from-primary/9 via-purple-brand/7 to-gold-brand/7 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Your ceremony plan
            </div>
            <h2 id="ceremony-builder-title" className="font-display mt-1 text-2xl leading-tight">
              Build a wedding that feels like your family
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose a tradition, keep only the rasms that matter to you, and turn them into an editable timeline. Nothing is assumed or sent to anyone.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{selectedCeremonies.length} ceremonies selected</span>
          </div>
        </div>
      </header>

      <div className="space-y-7 p-5 sm:p-6">
        <section aria-labelledby="tradition-title">
          <StepTitle number="1" title="Start with your tradition" description="Select one starting point. You can freely change, mix, or remove every ceremony afterwards." />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ceremonyTraditions.map((item) => {
              const Icon = traditionIcons[item.id] ?? HeartHandshake;
              const active = item.id === traditionId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseTradition(item.id)}
                  className={`group flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "border-primary bg-primary/7 shadow-sm"
                      : "border-border bg-card hover:border-primary/35 hover:bg-secondary/45"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {item.label}
                      {active ? <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Selected" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {tradition?.regions?.length ? (
          <section className="rounded-xl border border-border bg-secondary/20 p-4 sm:p-5" aria-labelledby="region-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 id="region-title" className="text-sm font-semibold">Add a regional tradition</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">This adds local rasms to your editable selection. It does not remove the base list.</p>
              </div>
              <div className="w-full sm:w-56">
                <Label htmlFor="ceremony-region" className="text-xs text-muted-foreground">Region or community</Label>
                <select
                  id="ceremony-region"
                  value={regionId ?? ""}
                  onChange={(event) => chooseRegion(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">No regional set</option>
                  {tradition.regions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
            </div>
          </section>
        ) : null}

        {tradition ? (
          <section aria-labelledby="ceremony-selection-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <StepTitle number="2" title="Choose your rasms" description="Core ceremonies are selected as a starting point. Optional and family-specific moments stay fully in your control." />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 shrink-0"
                onClick={() => setSelected(availableCeremonies.map((ceremony) => ceremony.name))}
                disabled={availableCeremonies.length === 0}
              >
                Select all
              </Button>
            </div>

            {availableCeremonies.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {availableCeremonies.map((ceremony) => {
                  const isSelected = selected.includes(ceremony.name);
                  return (
                    <button
                      key={ceremony.name}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleCeremony(ceremony.name)}
                      className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? "border-primary/45 bg-primary/6"
                          : "border-border bg-card hover:border-primary/30 hover:bg-secondary/45"
                      }`}
                    >
                      {isSelected ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-primary" aria-hidden="true" /> : <Circle className="h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{ceremony.name}</span>
                      {ceremony.optional ? <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">Optional</Badge> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/25 p-5 text-sm text-muted-foreground">
                Start with your family’s own rasms below, then add them to the timeline.
              </div>
            )}

            <div className="mt-4 rounded-xl border border-dashed border-primary/25 bg-primary/4 p-4">
              <Label htmlFor="custom-ceremony" className="text-sm font-semibold">Add a family custom</Label>
              <p className="mt-1 text-xs text-muted-foreground">Use the name your family uses. It will appear exactly that way on the timeline.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="custom-ceremony"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomCeremony();
                    }
                  }}
                  className="min-h-11 flex-1"
                  placeholder="e.g. Family blessing or a local rasam"
                />
                <Button type="button" variant="secondary" className="min-h-11" onClick={addCustomCeremony}>
                  <Plus className="h-4 w-4" /> Add rasam
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {tradition ? (
          <section className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-gold-brand/8 p-4 sm:p-5" aria-labelledby="timeline-placement-title">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <StepTitle number="3" title="Place your ceremony plan" description="We’ll suggest days around your wedding date. These are planning placeholders, not religious rules—edit every event after adding it." />
              </div>
              <div className="w-full lg:w-56">
                <Label htmlFor="ceremony-wedding-date" className="text-xs text-muted-foreground">Wedding date</Label>
                <Input id="ceremony-wedding-date" type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} className="mt-1 min-h-11" />
              </div>
            </div>

            {weddingDate && schedule.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested ceremony schedule">
                {(["pre-wedding", "wedding-day", "post-wedding"] as CeremonyPhase[]).map((phase) => {
                  const items = schedule.filter((item) => item.phase === phase);
                  if (items.length === 0) return null;
                  return (
                    <span key={phase} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{items.length}</span>
                      {phaseLabel(phase)}
                      <ChevronRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {new Date(`${items[0].event_date}T12:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-primary/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {unscheduled.length > 0
                  ? `${unscheduled.length} new ceremony ${unscheduled.length === 1 ? "event" : "events"} will be added. Existing timeline events are left untouched.`
                  : selectedCeremonies.length > 0
                    ? "These selected ceremonies are already on your timeline."
                    : "Select the ceremonies you want before adding them to the timeline."}
              </p>
              <Button
                type="button"
                className="min-h-11 shrink-0 rounded-xl bg-gradient-to-r from-primary to-purple-brand hover:opacity-90"
                disabled={save.isPending || !weddingDate || selectedCeremonies.length === 0 || unscheduled.length === 0}
                onClick={() => save.mutate()}
              >
                <CalendarPlus className="h-4 w-4" />
                {save.isPending ? "Adding ceremonies…" : "Add to timeline"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function StepTitle({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{number}</span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
