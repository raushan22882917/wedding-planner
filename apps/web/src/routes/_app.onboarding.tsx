import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ceremonyTraditions } from "@/lib/ceremony-library";
import {
  completeWeddingOnboarding,
  getMyProfile,
  type WeddingBrief,
} from "@/lib/profile.functions";
import { startWeddingConciergeResearch } from "@/lib/research.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/onboarding")({
  component: WeddingOnboardingPage,
});

const priorities = [
  "Venue",
  "Catering",
  "Photography & video",
  "Decor & flowers",
  "Makeup & mehendi",
  "Music & entertainment",
  "Accommodation & travel",
  "Invitations & gifts",
];

const planningStyles = [
  "Classic & elegant",
  "Modern & minimal",
  "Vibrant & festive",
  "Intimate & relaxed",
];

type FormState = {
  partner_one: string;
  partner_two: string;
  wedding_date: string;
  city: string;
  venue: string;
  guest_count: string;
  budget_total: string;
  tradition: string;
  region: string;
  ceremonies: string[];
  planning_style: string;
  vendor_priorities: string[];
  family_notes: string;
  food_preferences: string;
  research_consent: boolean;
};

const emptyForm: FormState = {
  partner_one: "",
  partner_two: "",
  wedding_date: "",
  city: "",
  venue: "",
  guest_count: "",
  budget_total: "",
  tradition: "",
  region: "",
  ceremonies: [],
  planning_style: planningStyles[0]!,
  vendor_priorities: ["Venue", "Catering", "Photography & video"],
  family_notes: "",
  food_preferences: "",
  research_consent: false,
};

function briefFrom(value: unknown): Partial<WeddingBrief> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<WeddingBrief>)
    : {};
}

function ToggleCard({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/7 shadow-sm"
          : "border-border bg-card hover:border-primary/35 hover:bg-secondary/45",
      )}
    >
      <span className="block pr-6 text-sm font-semibold text-foreground">{label}</span>
      {description ? (
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      {selected ? (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3.5 w-3.5" aria-label="Selected" />
        </span>
      ) : null}
    </button>
  );
}

function WeddingOnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const saveBrief = useServerFn(completeWeddingOnboarding);
  const startResearch = useServerFn(startWeddingConciergeResearch);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const hydrated = useRef(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customCeremony, setCustomCeremony] = useState("");

  useEffect(() => {
    if (!profile.data || hydrated.current) return;
    hydrated.current = true;
    const brief = briefFrom(profile.data.wedding_brief);
    setForm({
      ...emptyForm,
      partner_one: profile.data.partner_one ?? "",
      partner_two: profile.data.partner_two ?? "",
      wedding_date: profile.data.wedding_date ?? "",
      city: profile.data.city ?? "",
      venue: profile.data.venue ?? "",
      guest_count: profile.data.guest_count?.toString() ?? "",
      budget_total: profile.data.budget_total?.toString() ?? "",
      tradition: typeof brief.tradition === "string" ? brief.tradition : "",
      region: typeof brief.region === "string" ? brief.region : "",
      ceremonies: Array.isArray(brief.ceremonies)
        ? brief.ceremonies.filter((item): item is string => typeof item === "string")
        : [],
      planning_style:
        typeof brief.planning_style === "string" ? brief.planning_style : emptyForm.planning_style,
      vendor_priorities: Array.isArray(brief.vendor_priorities)
        ? brief.vendor_priorities.filter((item): item is string => typeof item === "string")
        : emptyForm.vendor_priorities,
      family_notes: typeof brief.family_notes === "string" ? brief.family_notes : "",
      food_preferences: typeof brief.food_preferences === "string" ? brief.food_preferences : "",
      research_consent: Boolean(profile.data.research_consent_at),
    });
  }, [profile.data]);

  const tradition = useMemo(
    () => ceremonyTraditions.find((item) => item.id === form.tradition),
    [form.tradition],
  );
  const region = tradition?.regions?.find((item) => item.id === form.region);
  const ceremonies = useMemo(() => {
    const items = [...(tradition?.ceremonies ?? []), ...(region?.ceremonies ?? [])];
    return [
      ...new Map(
        [...items, ...form.ceremonies.map((name) => ({ name, optional: false }))].map((item) => [
          item.name.toLocaleLowerCase(),
          item,
        ]),
      ).values(),
    ];
  }, [form.ceremonies, region?.ceremonies, tradition?.ceremonies]);

  const save = useMutation({
    mutationFn: async () => {
      const result = await saveBrief({
        data: {
          partner_one: form.partner_one,
          partner_two: form.partner_two || null,
          wedding_date: form.wedding_date,
          city: form.city,
          venue: form.venue || null,
          guest_count: Number(form.guest_count),
          budget_total: Number(form.budget_total),
          brief: {
            tradition: tradition?.label ?? form.tradition,
            region: region?.label ?? (form.region || null),
            ceremonies: form.ceremonies,
            planning_style: form.planning_style,
            vendor_priorities: form.vendor_priorities,
            family_notes: form.family_notes || null,
            food_preferences: form.food_preferences || null,
            research_consent: form.research_consent,
          },
        },
      });
      try {
        const research = await startResearch({ data: undefined });
        return {
          result,
          researchError: research.errors[0] ?? null,
          queued: research.queued.length,
        };
      } catch (error) {
        return {
          result,
          queued: 0,
          researchError: error instanceof Error ? error.message : "Research could not start yet.",
        };
      }
    },
    onSuccess: ({ result, queued, researchError }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["budget"] });
      void queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success("Your wedding workspace is ready", {
        description: `${result.ceremoniesScheduled} ceremony events and ${result.categoriesCreated} budget categories were prepared.`,
      });
      if (queued) {
        toast.success("MarryMap AI has started matching vendors", {
          description: `${queued} source-backed research passes are now in progress.`,
        });
      }
      if (researchError) {
        toast.message("Your brief is saved", {
          description:
            "Research can be started from the Dashboard when the research service is available.",
        });
      }
      navigate({ to: "/dashboard" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save your wedding brief."),
  });

  const validateStep = () => {
    if (step === 0) {
      if (!form.partner_one.trim() || !form.wedding_date || !form.city.trim()) {
        toast.error("Add a name, wedding date, and city to continue.");
        return false;
      }
      if (Number(form.guest_count) < 1 || Number(form.budget_total) < 1_000) {
        toast.error("Add your guest count and a total budget to continue.");
        return false;
      }
    }
    if (step === 1 && (!form.tradition || form.ceremonies.length === 0)) {
      toast.error("Choose a tradition and at least one ceremony. You can edit these later.");
      return false;
    }
    if (step === 2 && form.vendor_priorities.length === 0) {
      toast.error("Choose at least one vendor priority for AI research.");
      return false;
    }
    return true;
  };

  const chooseTradition = (id: string) => {
    const selected = ceremonyTraditions.find((item) => item.id === id);
    setForm((current) => ({
      ...current,
      tradition: id,
      region: "",
      ceremonies: (selected?.ceremonies ?? [])
        .filter((item) => !item.optional)
        .map((item) => item.name)
        .slice(0, 12),
    }));
  };

  const chooseRegion = (id: string) => {
    const selected = tradition?.regions?.find((item) => item.id === id);
    const defaults = [...(tradition?.ceremonies ?? []), ...(selected?.ceremonies ?? [])]
      .filter((item) => !item.optional)
      .map((item) => item.name);
    setForm((current) => ({
      ...current,
      region: id,
      ceremonies: [...new Set(defaults)].slice(0, 16),
    }));
  };

  const toggle = (key: "ceremonies" | "vendor_priorities", value: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const addCustomCeremony = () => {
    const name = customCeremony.replace(/\s+/g, " ").trim().slice(0, 160);
    if (!name) return;
    if (
      form.ceremonies.some((ceremony) => ceremony.toLocaleLowerCase() === name.toLocaleLowerCase())
    ) {
      toast.message("That ceremony is already in your plan.");
      return;
    }
    setForm((current) => ({ ...current, ceremonies: [...current.ceremonies, name] }));
    setCustomCeremony("");
  };

  const steps = ["The essentials", "Traditions & rasms", "Your priorities", "Review & begin"];

  if (profile.isLoading) {
    return (
      <div className="grid min-h-[calc(100vh-56px)] place-items-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading your workspace…
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-primary/5 via-background to-background px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> MarryMap AI setup
          </div>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Let’s set up your wedding command centre
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tell us what matters to your family. We’ll turn it into your editable timeline, budget,
            and a private vendor research plan.
          </p>
        </header>

        <ol className="mx-auto mb-7 grid max-w-3xl grid-cols-4 gap-2" aria-label="Setup progress">
          {steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div className={cn("h-1 rounded-full", index <= step ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "mt-2 block text-center text-[10px] leading-tight sm:text-xs",
                  index === step ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <main className="soft-card overflow-hidden">
          <div className="min-h-[510px] p-5 sm:p-7">
            {step === 0 && (
              <section aria-labelledby="essentials-title">
                <StepHeading
                  id="essentials-title"
                  icon={CalendarDays}
                  eyebrow="Step 1 of 4"
                  title="The essentials"
                  description="These details unlock your countdown, budget plan, and vendor matching."
                />
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <Field label="Your name" required>
                    <Input
                      value={form.partner_one}
                      onChange={(event) => setForm({ ...form, partner_one: event.target.value })}
                      placeholder="Priya"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Partner’s name">
                    <Input
                      value={form.partner_two}
                      onChange={(event) => setForm({ ...form, partner_two: event.target.value })}
                      placeholder="Arjun"
                    />
                  </Field>
                  <Field label="Wedding date" required>
                    <Input
                      type="date"
                      value={form.wedding_date}
                      onChange={(event) => setForm({ ...form, wedding_date: event.target.value })}
                    />
                  </Field>
                  <Field label="Planning city" required>
                    <Input
                      value={form.city}
                      onChange={(event) => setForm({ ...form, city: event.target.value })}
                      placeholder="Udaipur"
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label="Venue (if decided)">
                    <Input
                      value={form.venue}
                      onChange={(event) => setForm({ ...form, venue: event.target.value })}
                      placeholder="The Leela Palace"
                    />
                  </Field>
                  <Field label="Expected guests" required>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min="1"
                      value={form.guest_count}
                      onChange={(event) => setForm({ ...form, guest_count: event.target.value })}
                      placeholder="250"
                    />
                  </Field>
                  <Field label="Total budget (₹)" required>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min="1000"
                      value={form.budget_total}
                      onChange={(event) => setForm({ ...form, budget_total: event.target.value })}
                      placeholder="1500000"
                    />
                  </Field>
                </div>
              </section>
            )}

            {step === 1 && (
              <section aria-labelledby="rasms-title">
                <StepHeading
                  id="rasms-title"
                  icon={Sparkles}
                  eyebrow="Step 2 of 4"
                  title="Traditions & rasms"
                  description="Choose a starting point, then keep only the ceremonies your family wants. Every item stays editable on your timeline."
                />
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ceremonyTraditions.map((item) => (
                    <ToggleCard
                      key={item.id}
                      selected={form.tradition === item.id}
                      onClick={() => chooseTradition(item.id)}
                      label={item.label}
                      description={item.description}
                    />
                  ))}
                </div>
                {tradition?.regions?.length ? (
                  <div className="mt-7 border-t border-border pt-6">
                    <h3 className="text-sm font-semibold">Region or community</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional — use this to tailor the initial ceremony list.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tradition.regions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => chooseRegion(item.id)}
                          className={cn(
                            "min-h-10 rounded-full border px-3 text-sm transition-colors",
                            form.region === item.id
                              ? "border-primary bg-primary/8 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/35",
                          )}
                          aria-pressed={form.region === item.id}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {tradition ? (
                  <div className="mt-7 border-t border-border pt-6">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">Your ceremony list</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {form.ceremonies.length} selected. Select or deselect any rasam below.
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                        Timeline ready
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {ceremonies.map((item) => (
                        <ToggleCard
                          key={item.name}
                          selected={form.ceremonies.includes(item.name)}
                          onClick={() => toggle("ceremonies", item.name)}
                          label={item.name}
                          description={item.optional ? "Optional" : undefined}
                        />
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/25 p-3 sm:flex sm:items-end sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor="custom-ceremony" className="text-xs text-muted-foreground">
                          Add a family custom or another ceremony
                        </Label>
                        <Input
                          id="custom-ceremony"
                          value={customCeremony}
                          onChange={(event) => setCustomCeremony(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addCustomCeremony();
                            }
                          }}
                          placeholder="e.g. Ring blessing"
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 min-h-10 sm:mt-0"
                        onClick={addCustomCeremony}
                      >
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="priorities-title">
                <StepHeading
                  id="priorities-title"
                  icon={Wallet}
                  eyebrow="Step 3 of 4"
                  title="What should the AI prioritise?"
                  description="We use these preferences to build focused searches. You choose who makes the shortlist and receives any outreach."
                />
                <h3 className="mt-7 text-sm font-semibold">Vendor priorities</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {priorities.map((priority) => (
                    <ToggleCard
                      key={priority}
                      label={priority}
                      selected={form.vendor_priorities.includes(priority)}
                      onClick={() => toggle("vendor_priorities", priority)}
                    />
                  ))}
                </div>
                <h3 className="mt-7 text-sm font-semibold">Overall wedding feel</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {planningStyles.map((style) => (
                    <ToggleCard
                      key={style}
                      label={style}
                      selected={form.planning_style === style}
                      onClick={() => setForm({ ...form, planning_style: style })}
                    />
                  ))}
                </div>
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <Field label="Food, dietary, or menu preferences">
                    <Textarea
                      value={form.food_preferences}
                      onChange={(event) =>
                        setForm({ ...form, food_preferences: event.target.value })
                      }
                      placeholder="Vegetarian dinner, Jain options, and a small continental counter"
                      rows={4}
                    />
                  </Field>
                  <Field label="Family customs or must-haves">
                    <Textarea
                      value={form.family_notes}
                      onChange={(event) => setForm({ ...form, family_notes: event.target.value })}
                      placeholder="A family priest will confirm muhurat; keep both families involved in venue review"
                      rows={4}
                    />
                  </Field>
                </div>
              </section>
            )}

            {step === 3 && (
              <section aria-labelledby="review-title">
                <StepHeading
                  id="review-title"
                  icon={ShieldCheck}
                  eyebrow="Step 4 of 4"
                  title="Review & start your AI concierge"
                  description="You stay in control from research through booking."
                />
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <SummaryCard
                    icon={MapPin}
                    title="Wedding brief"
                    lines={[
                      `${form.city || "City not set"} · ${form.wedding_date || "Date not set"}`,
                      `${form.guest_count || "—"} guests · ₹${Number(form.budget_total || 0).toLocaleString("en-IN")}`,
                      form.venue || "Venue to be decided",
                    ]}
                  />
                  <SummaryCard
                    icon={UsersRound}
                    title="Family plan"
                    lines={[
                      tradition?.label ?? "Tradition to be decided",
                      `${form.ceremonies.length} ceremonies selected`,
                      form.planning_style,
                    ]}
                  />
                  <SummaryCard
                    icon={Sparkles}
                    title="AI research queue"
                    lines={[
                      form.vendor_priorities.join(" · ") || "No priorities selected",
                      "Public sources only",
                      "Matches are saved for your review",
                    ]}
                  />
                  <SummaryCard
                    icon={ShieldCheck}
                    title="Contact & booking guardrails"
                    lines={[
                      "You review and shortlist every vendor",
                      "Calls and messages require separate consent",
                      "Bookings are never made automatically",
                    ]}
                  />
                </div>
                <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={form.research_consent}
                    onChange={(event) =>
                      setForm({ ...form, research_consent: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="font-semibold">
                      Start public-source vendor research for this brief
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      MarryMap AI may search public websites and save source-provided vendor details
                      to your private research library. It will not call, message, share your
                      personal details, or book anyone without a separate confirmation.
                    </span>
                  </span>
                </label>
                {!form.research_consent ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
                    <CircleAlert className="h-3.5 w-3.5" /> This confirmation is required to begin
                    the AI research pass.
                  </p>
                ) : null}
              </section>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border bg-secondary/20 px-5 py-4 sm:px-7">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={step === 0 || save.isPending}
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                className="min-h-11 rounded-full"
                onClick={() => {
                  if (validateStep()) setStep((current) => current + 1);
                }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-11 rounded-full bg-gradient-to-r from-primary to-purple-brand hover:opacity-90"
                disabled={save.isPending || !form.research_consent}
                onClick={() => {
                  if (validateStep() && form.research_consent) save.mutate();
                }}
              >
                {save.isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Saving your plan…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Save & start AI research
                  </>
                )}
              </Button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-primary">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function StepHeading({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  id: string;
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        <Icon className="h-3.5 w-3.5" /> {eyebrow}
      </div>
      <h2 className="mt-2 font-display text-2xl" id={id}>
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  lines,
}: {
  icon: typeof Sparkles;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/8 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
