import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  HeartHandshake,
  ImagePlus,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { CoupleAvatar } from "@/components/app-shell/couple-avatar";
import { PageHeader } from "@/components/app-shell/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import {
  createSubscriptionCheckout,
  createUsagePackCheckout,
  getMySubscription,
} from "@/lib/billing.functions";
import {
  FEATURE_LABELS,
  PAID_ADD_ONS,
  formatInr,
  SUBSCRIPTION_PLANS,
  WEDDING_COVERAGE_PRICING,
  getWeddingCoverageQuote,
  type SubscriptionFeature,
  type SubscriptionPlan,
  type UsagePackId,
} from "@/lib/subscription";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const notificationStorageKey = "marrymap-notification-preferences";

type NotificationPreferences = {
  dailyBriefing: boolean;
  vendorReplies: boolean;
  paymentReminders: boolean;
  weeklyDigest: boolean;
};

type PhotoSlot = "one" | "two";

const defaultNotifications: NotificationPreferences = {
  dailyBriefing: true,
  vendorReplies: true,
  paymentReminders: true,
  weeklyDigest: false,
};

const settingsSections = [
  { href: "#couple-profile", label: "Couple profile", icon: Camera },
  { href: "#wedding-details", label: "Wedding details", icon: HeartHandshake },
  { href: "#planning-summary", label: "Planning summary", icon: Sparkles },
  { href: "#notifications", label: "Notifications", icon: BellRing },
  { href: "#plan-and-billing", label: "Plan & billing", icon: CreditCard },
] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const updFn = useServerFn(updateMyProfile);
  const subscriptionFn = useServerFn(getMySubscription);
  const checkoutFn = useServerFn(createSubscriptionCheckout);
  const usagePackCheckoutFn = useServerFn(createUsagePackCheckout);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getFn() });
  const subscription = useQuery({
    queryKey: ["subscription"],
    queryFn: () => subscriptionFn(),
  });

  const [form, setForm] = useState({
    partner_one: "",
    partner_two: "",
    wedding_date: "",
    venue: "",
    city: "",
    guest_count: "",
    budget_total: "",
  });
  const [notifications, setNotifications] = useState<NotificationPreferences>(defaultNotifications);
  const [photoAction, setPhotoAction] = useState<PhotoSlot | null>(null);

  useEffect(() => {
    if (!profile.data) return;

    setForm({
      partner_one: profile.data.partner_one ?? "",
      partner_two: profile.data.partner_two ?? "",
      wedding_date: profile.data.wedding_date ?? "",
      venue: profile.data.venue ?? "",
      city: profile.data.city ?? "",
      guest_count: profile.data.guest_count?.toString() ?? "",
      budget_total: profile.data.budget_total?.toString() ?? "",
    });
  }, [profile.data]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(notificationStorageKey);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Partial<NotificationPreferences>;
      setNotifications({ ...defaultNotifications, ...parsed });
    } catch {
      // Local storage can be unavailable in privacy-focused browsers. Defaults still work.
    }
  }, []);

  const weddingTitle =
    [form.partner_one, form.partner_two].filter(Boolean).join(" & ") || "Your wedding";
  const completedDetails = [
    form.partner_one,
    form.wedding_date,
    form.city,
    form.guest_count,
    form.budget_total,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completedDetails / 5) * 100);
  const detailsChanged = useMemo(() => {
    if (!profile.data) return false;
    return (
      form.partner_one !== (profile.data.partner_one ?? "") ||
      form.partner_two !== (profile.data.partner_two ?? "") ||
      form.wedding_date !== (profile.data.wedding_date ?? "") ||
      form.venue !== (profile.data.venue ?? "") ||
      form.city !== (profile.data.city ?? "") ||
      form.guest_count !== (profile.data.guest_count?.toString() ?? "") ||
      form.budget_total !== (profile.data.budget_total?.toString() ?? "")
    );
  }, [form, profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updFn({
        data: {
          partner_one: form.partner_one || null,
          partner_two: form.partner_two || null,
          wedding_date: form.wedding_date || null,
          venue: form.venue || null,
          city: form.city || null,
          guest_count: form.guest_count ? Number(form.guest_count) : null,
          budget_total: form.budget_total ? Number(form.budget_total) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Wedding details saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save details."),
  });

  const checkout = useMutation({
    mutationFn: ({
      plan,
      weddingCount,
    }: {
      plan: Exclude<SubscriptionPlan, "free">;
      weddingCount: number;
    }) => checkoutFn({ data: { plan, weddingCount } }),
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start secure checkout."),
  });
  const usagePackCheckout = useMutation({
    mutationFn: (pack: UsagePackId) => usagePackCheckoutFn({ data: { pack } }),
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start secure checkout."),
  });

  function setNotificationPreference(key: keyof NotificationPreferences, enabled: boolean) {
    const next = { ...notifications, [key]: enabled };
    setNotifications(next);

    try {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      toast.success(`${enabled ? "Enabled" : "Paused"} on this device`);
    } catch {
      toast.error("Your browser could not save this preference.");
    }
  }

  async function uploadProfilePhoto(slot: PhotoSlot, file: File) {
    const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!supportedTypes.includes(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.");
      return;
    }

    setPhotoAction(slot);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user)
        throw new Error("Your session has expired. Please sign in again.");

      const photoPath = `${authData.user.id}/partner-${slot === "one" ? "one" : "two"}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(photoPath, file, { cacheControl: "3600", contentType: file.type, upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      await updFn({
        data:
          slot === "one"
            ? { partner_one_photo_path: photoPath }
            : { partner_two_photo_path: photoPath },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        `${slot === "one" ? "Bride / partner one" : "Groom / partner two"} photo updated`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload this photo.");
    } finally {
      setPhotoAction(null);
    }
  }

  async function removeProfilePhoto(slot: PhotoSlot) {
    const photoPath =
      slot === "one" ? profile.data?.partner_one_photo_path : profile.data?.partner_two_photo_path;
    const title = slot === "one" ? "Bride / partner one" : "Groom / partner two";
    if (!photoPath || !window.confirm(`Remove the ${title.toLowerCase()} photo?`)) return;

    setPhotoAction(slot);
    try {
      const { error: removeError } = await supabase.storage
        .from("profile-photos")
        .remove([photoPath]);
      if (removeError) throw new Error(removeError.message);

      await updFn({
        data: slot === "one" ? { partner_one_photo_path: null } : { partner_two_photo_path: null },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`${title} photo removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this photo.");
    } finally {
      setPhotoAction(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Settings"
        title="Your planning space"
        subtitle="Keep the wedding details, reminders, and plan that power MarryMap in one place."
      />

      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-purple-brand/10 p-5 shadow-sm sm:p-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
              <HeartHandshake className="h-3.5 w-3.5" />
              MarryMap profile
            </div>
            <h2 className="mt-4 font-display text-2xl sm:text-3xl">{weddingTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Your saved details personalize the timeline, budget guidance, vendor research, and AI
              suggestions across the app.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-card/80 p-4 backdrop-blur sm:min-w-60">
            <div className="flex items-center justify-between gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Profile ready
              <span className="text-primary">{completionPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-brand transition-[width] duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {completedDetails} of 5 key planning details added
            </p>
          </div>
        </div>
      </section>

      {profile.isError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>We could not load your saved wedding details. You can try again safely.</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => profile.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="h-fit rounded-2xl border border-border bg-card p-2 shadow-sm xl:sticky xl:top-6"
        >
          <div className="flex gap-1 overflow-x-auto xl:block xl:space-y-1">
            {settingsSections.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/7 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex"
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </div>
        </nav>

        <main className="min-w-0 space-y-6">
          <section
            id="couple-profile"
            className="soft-card scroll-mt-6 overflow-hidden"
            aria-labelledby="couple-profile-title"
          >
            <div className="border-b border-border bg-gradient-to-r from-rose-brand/8 via-transparent to-purple-brand/8 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Camera className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id="couple-profile-title" className="font-display text-xl">
                      Your couple profile
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Add one portrait for each of you. They appear together in your planner header
                      and wedding workspace.
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Private to your workspace
                </span>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1fr)] lg:items-center">
              <div className="relative overflow-hidden rounded-2xl border border-primary/12 bg-gradient-to-br from-primary/9 via-background to-purple-brand/10 px-5 py-7 text-center">
                <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-purple-brand/10 blur-2xl" />
                <div className="relative mx-auto w-fit">
                  <CoupleAvatar
                    size="xl"
                    partnerOneName={form.partner_one}
                    partnerTwoName={form.partner_two}
                    partnerOnePhotoUrl={profile.data?.partner_one_photo_url}
                    partnerTwoPhotoUrl={profile.data?.partner_two_photo_url}
                  />
                </div>
                <p className="relative mt-5 text-sm font-semibold text-foreground">
                  {weddingTitle}
                </p>
                <p className="relative mt-1 text-xs leading-relaxed text-muted-foreground">
                  Two portraits, one shared planning space
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ProfilePhotoPicker
                  label="Bride / partner one"
                  name={form.partner_one || "Bride"}
                  photoUrl={profile.data?.partner_one_photo_url}
                  uploading={photoAction === "one"}
                  onUpload={(file) => uploadProfilePhoto("one", file)}
                  onRemove={
                    profile.data?.partner_one_photo_path
                      ? () => removeProfilePhoto("one")
                      : undefined
                  }
                />
                <ProfilePhotoPicker
                  label="Groom / partner two"
                  name={form.partner_two || "Groom"}
                  photoUrl={profile.data?.partner_two_photo_url}
                  uploading={photoAction === "two"}
                  onUpload={(file) => uploadProfilePhoto("two", file)}
                  onRemove={
                    profile.data?.partner_two_photo_path
                      ? () => removeProfilePhoto("two")
                      : undefined
                  }
                  tone="purple"
                />
              </div>
            </div>
          </section>

          <section
            id="wedding-details"
            className="soft-card scroll-mt-6 overflow-hidden"
            aria-labelledby="wedding-details-title"
          >
            <div className="border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-purple-brand/5 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <HeartHandshake className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="wedding-details-title" className="font-display text-xl">
                    Wedding details
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    These details stay private to your workspace and make every recommendation more
                    relevant.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {profile.isLoading ? (
                <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Loading your wedding details…
                </div>
              ) : (
                <>
                  <fieldset className="grid gap-5 md:grid-cols-2">
                    <legend className="sr-only">Wedding details</legend>
                    <Field
                      label="Your name"
                      value={form.partner_one}
                      onChange={(value) => setForm({ ...form, partner_one: value })}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                    <Field
                      label="Partner's name"
                      value={form.partner_two}
                      onChange={(value) => setForm({ ...form, partner_two: value })}
                      placeholder="Partner's name"
                      autoComplete="name"
                    />
                    <Field
                      label="Wedding date"
                      type="date"
                      value={form.wedding_date}
                      onChange={(value) => setForm({ ...form, wedding_date: value })}
                    />
                    <Field
                      label="City"
                      value={form.city}
                      onChange={(value) => setForm({ ...form, city: value })}
                      placeholder="Udaipur"
                      autoComplete="address-level2"
                    />
                    <Field
                      label="Venue"
                      value={form.venue}
                      onChange={(value) => setForm({ ...form, venue: value })}
                      placeholder="The Leela Palace"
                    />
                    <Field
                      label="Guest count"
                      type="number"
                      value={form.guest_count}
                      onChange={(value) => setForm({ ...form, guest_count: value })}
                      placeholder="250"
                      min="1"
                      inputMode="numeric"
                    />
                    <Field
                      label="Total budget (₹)"
                      type="number"
                      value={form.budget_total}
                      onChange={(value) => setForm({ ...form, budget_total: value })}
                      placeholder="1500000"
                      min="0"
                      inputMode="numeric"
                    />
                  </fieldset>
                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Changes appear in your planner, timeline, and budget after saving.
                    </p>
                    <Button
                      type="button"
                      onClick={() => save.mutate()}
                      disabled={save.isPending || !detailsChanged}
                      className="min-h-11 bg-gradient-to-r from-primary to-purple-brand hover:opacity-90"
                    >
                      {save.isPending ? (
                        <>
                          <LoaderCircle className="animate-spin" /> Saving details…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 /> Save wedding details
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>

          <section
            id="planning-summary"
            className="soft-card scroll-mt-6 p-5 sm:p-6"
            aria-labelledby="planning-summary-title"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-brand/10 text-purple-brand">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="planning-summary-title" className="font-display text-xl">
                    Planning summary
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A quick check of the details your planner uses most often.
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Private workspace data
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem
                icon={CalendarDays}
                label="Wedding date"
                value={formatWeddingDate(form.wedding_date)}
              />
              <SummaryItem icon={MapPin} label="Location" value={form.city || "Add your city"} />
              <SummaryItem
                icon={UsersRound}
                label="Guests"
                value={
                  form.guest_count
                    ? `${Number(form.guest_count).toLocaleString("en-IN")} guests`
                    : "Add guest count"
                }
              />
              <SummaryItem icon={Wallet} label="Budget" value={formatBudget(form.budget_total)} />
            </div>
          </section>

          <section
            id="notifications"
            className="soft-card scroll-mt-6 overflow-hidden"
            aria-labelledby="notifications-title"
          >
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-brand/10 text-rose-brand">
                  <BellRing className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="notifications-title" className="font-display text-xl">
                    Notification preferences
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Choose the planning updates you want to see on this browser.
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-border">
              <NotificationToggle
                label="Daily AI briefing"
                description="A concise view of what needs attention next."
                checked={notifications.dailyBriefing}
                onCheckedChange={(enabled) => setNotificationPreference("dailyBriefing", enabled)}
              />
              <NotificationToggle
                label="Vendor replies"
                description="Stay on top of new WhatsApp messages from vendors."
                checked={notifications.vendorReplies}
                onCheckedChange={(enabled) => setNotificationPreference("vendorReplies", enabled)}
              />
              <NotificationToggle
                label="Payment reminders"
                description="See a reminder before vendor deposits and payment milestones."
                checked={notifications.paymentReminders}
                onCheckedChange={(enabled) =>
                  setNotificationPreference("paymentReminders", enabled)
                }
              />
              <NotificationToggle
                label="Weekly planning digest"
                description="Receive a weekly summary of progress, decisions, and open risks."
                checked={notifications.weeklyDigest}
                onCheckedChange={(enabled) => setNotificationPreference("weeklyDigest", enabled)}
              />
            </div>
            <p className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground sm:px-6">
              Preferences are saved on this device. Account-wide notification sync will be available
              in a future update.
            </p>
          </section>

          <SubscriptionSection
            plan={subscription.data?.plan ?? "free"}
            status={subscription.data?.status ?? "active"}
            isTrial={subscription.data?.isTrial ?? false}
            renewsAt={subscription.data?.renewsAt ?? null}
            weddingDate={profile.data?.wedding_date ?? null}
            currentWeddingCount={subscription.data?.weddingCount ?? 1}
            coverageEndsAt={subscription.data?.coverageEndsAt ?? null}
            usage={subscription.data?.usage ?? []}
            loading={subscription.isLoading}
            failed={subscription.isError}
            onRetry={() => subscription.refetch()}
            checkoutPlan={(plan, weddingCount) => checkout.mutate({ plan, weddingCount })}
            checkoutPack={(pack) => usagePackCheckout.mutate(pack)}
            checkoutPending={checkout.isPending || usagePackCheckout.isPending}
          />
        </main>
      </div>
    </div>
  );
}

function ProfilePhotoPicker({
  label,
  name,
  photoUrl,
  uploading,
  onUpload,
  onRemove,
  tone = "rose",
}: {
  label: string;
  name: string;
  photoUrl?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  tone?: "rose" | "purple";
}) {
  const inputId = useId();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const colors = tone === "purple" ? "from-purple-brand to-primary" : "from-rose-brand to-primary";

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 border-2 border-card shadow-sm">
          {photoUrl && <AvatarImage src={photoUrl} alt={`${name} profile photo`} />}
          <AvatarFallback
            className={`bg-gradient-to-br text-base font-semibold text-primary-foreground ${colors}`}
          >
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground" title={name}>
            {name}
          </p>
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onUpload(file);
        }}
      />
      <div className="mt-4 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-10 flex-1" asChild>
          <label htmlFor={inputId} className={uploading ? "pointer-events-none" : "cursor-pointer"}>
            {uploading ? (
              <>
                <LoaderCircle className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <ImagePlus /> {photoUrl ? "Replace" : "Upload"}
              </>
            )}
          </label>
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            disabled={uploading}
            aria-label={`Remove ${label} photo`}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        JPEG, PNG, or WebP · up to 5 MB
      </p>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3.5">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-5 px-5 py-4 sm:px-6">
      <div>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

const featureIcons: Record<SubscriptionFeature, typeof Sparkles> = {
  ai_planner: Sparkles,
  vendor_research: Search,
  whatsapp_send: MessageCircle,
  voice_call: PhoneCall,
};

const planHighlights: Record<Exclude<SubscriptionPlan, "free">, string[]> = {
  essential: ["120 AI replies / month", "20 vendor searches / month", "60 WhatsApp sends / month"],
  signature: ["400 AI replies / month", "75 vendor searches / month", "250 WhatsApp sends / month"],
};

function formatCoverageDuration(days: number) {
  if (days < 31) return `${days} calendar day${days === 1 ? "" : "s"}`;
  const months = Math.ceil(days / 30);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return `${years} year${years === 1 ? "" : "s"}${remainder ? `, ${remainder} month${remainder === 1 ? "" : "s"}` : ""}`;
}

function SubscriptionSection({
  plan,
  status,
  isTrial,
  renewsAt,
  weddingDate,
  currentWeddingCount,
  coverageEndsAt,
  usage,
  loading,
  failed,
  onRetry,
  checkoutPlan,
  checkoutPack,
  checkoutPending,
}: {
  plan: SubscriptionPlan;
  status: string;
  isTrial: boolean;
  renewsAt: string | null;
  weddingDate: string | null;
  currentWeddingCount: number;
  coverageEndsAt: string | null;
  usage: Array<{
    feature: SubscriptionFeature;
    used: number;
    limit: number;
    estimatedCostPaise: number;
  }>;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  checkoutPlan: (plan: Exclude<SubscriptionPlan, "free">, weddingCount: number) => void;
  checkoutPack: (pack: UsagePackId) => void;
  checkoutPending: boolean;
}) {
  const currentPlan = SUBSCRIPTION_PLANS[plan];
  const [weddingCount, setWeddingCount] = useState(Math.min(10, Math.max(1, currentWeddingCount)));
  const [selectedPlan, setSelectedPlan] = useState<Exclude<SubscriptionPlan, "free">>(
    plan === "signature" && status === "active" ? "signature" : "essential",
  );
  useEffect(() => {
    setWeddingCount(Math.min(10, Math.max(1, currentWeddingCount)));
  }, [currentWeddingCount]);
  useEffect(() => {
    if (status === "active" && plan !== "free") setSelectedPlan(plan);
  }, [plan, status]);

  const renewal = renewsAt
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(renewsAt),
      )
    : null;
  const activeCoverageEnd = coverageEndsAt
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${coverageEndsAt}T12:00:00`),
      )
    : null;
  const selectedTier = SUBSCRIPTION_PLANS[selectedPlan];
  const selectedQuote = getWeddingCoverageQuote({
    weddingCount,
    weddingDate,
  });
  const selectedPlanIsCurrent = selectedPlan === plan && status === "active";
  const coverageEnd = selectedQuote
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${selectedQuote.endsAt}T12:00:00`),
      )
    : null;

  return (
    <section
      id="plan-and-billing"
      className="soft-card scroll-mt-6 overflow-hidden"
      aria-labelledby="subscription-title"
    >
      <div className="border-b border-border bg-gradient-to-r from-primary/6 via-transparent to-purple-brand/6 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Plan & billing
                </span>
                {status !== "active" && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    {status.replace(/_/g, " ")}
                  </span>
                )}
                {isTrial && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> 14-day free trial
                  </span>
                )}
              </div>
              <h2 id="subscription-title" className="mt-3 font-display text-xl">
                {status === "expired"
                  ? "Coverage complete"
                  : isTrial
                    ? "Signature trial"
                    : `${currentPlan.name} coverage`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isTrial
                  ? "All Signature features included at no cost"
                  : plan === "free"
                    ? "Free to explore"
                    : `${currentWeddingCount} wedding${currentWeddingCount === 1 ? "" : "s"} covered`}
                {activeCoverageEnd
                  ? ` · ${status === "expired" ? "Ended" : "Active through"} ${activeCoverageEnd}`
                  : renewal
                    ? ` · Renews ${renewal}`
                    : " · Allowances reset on the first of each month"}
              </p>
            </div>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground sm:text-right">
            {isTrial
              ? "No payment method is required during your trial. Your access ends automatically on the date shown."
              : "Coverage is charged once for the exact days your AI planner is available, from today through the wedding day. MarryMap never silently renews it."}
          </p>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="border-b border-border bg-muted/[0.18] p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {isTrial ? "Trial allowance" : "This month&apos;s allowance"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {isTrial ? "14-day total" : "Live usage"}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="flex min-h-28 items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Loading usage…
              </div>
            ) : failed ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <div className="flex items-start gap-2 text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  We could not load your usage right now.
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={onRetry}
                >
                  Try again
                </Button>
              </div>
            ) : usage.length ? (
              usage.map((item) => {
                const Icon = featureIcons[item.feature];
                const percent = item.limit ? Math.min(100, (item.used / item.limit) * 100) : 0;
                return (
                  <div key={item.feature}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <Icon className="h-4 w-4 text-primary" /> {FEATURE_LABELS[item.feature]}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {item.used} / {item.limit}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-200"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-xl bg-muted/45 p-4 text-sm leading-relaxed text-muted-foreground">
                Usage will appear here after you use an AI, research, message, or calling allowance.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-purple-brand/[0.07] p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <CalendarDays className="h-3.5 w-3.5" /> AI planning window
                </div>
                <p className="mt-1.5 text-lg font-semibold text-foreground">
                  {selectedQuote
                    ? formatCoverageDuration(selectedQuote.coverageDays)
                    : "Set a future wedding date to calculate coverage"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {selectedQuote
                    ? `Your AI planner will be available from today through ${coverageEnd}.`
                    : "Update your wedding date in Wedding details, then choose the number of weddings to cover."}
                </p>
                <p className="mt-3 text-xs font-medium text-foreground">
                  {formatInr(WEDDING_COVERAGE_PRICING.minimumMonthlyInr)} covers the first{" "}
                  {WEDDING_COVERAGE_PRICING.includedDaysPerWedding} days per wedding ·{" "}
                  {formatInr(WEDDING_COVERAGE_PRICING.additionalDayInr)} for each day after
                </p>
              </div>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground md:min-w-44">
                Weddings to cover
                <select
                  value={weddingCount}
                  onChange={(event) => setWeddingCount(Number(event.target.value))}
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-hidden transition-colors focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
                  aria-label="Number of weddings to cover"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count} wedding{count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Choose your planning pace</legend>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Both paid plans use the same coverage price. Choose the allowance level that fits your
              planning pace.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(["essential", "signature"] as const).map((candidate) => {
                const tier = SUBSCRIPTION_PLANS[candidate];
                const isSelected = candidate === selectedPlan;
                const isCurrent = candidate === plan && status === "active";
                return (
                  <button
                    type="button"
                    key={candidate}
                    onClick={() => setSelectedPlan(candidate)}
                    aria-pressed={isSelected}
                    className={`relative min-h-52 rounded-2xl border p-4 text-left transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? "border-primary/50 bg-primary/[0.045] shadow-[0_12px_28px_-24px_rgba(224,42,111,0.75)]"
                        : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{tier.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatInr(WEDDING_COVERAGE_PRICING.minimumMonthlyInr)} per wedding ·
                          first {WEDDING_COVERAGE_PRICING.includedDaysPerWedding} days
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : tier.featured
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isSelected ? "Selected" : tier.featured ? "Popular" : "Compare"}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
                      {planHighlights[candidate].map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrent && (
                      <p className="mt-4 text-xs font-semibold text-primary">
                        Your current coverage
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.045] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Your {selectedTier.name} estimate
                </p>
                {selectedQuote ? (
                  <>
                    <p className="mt-1 font-display text-3xl tabular-nums text-foreground">
                      {formatInr(selectedQuote.totalInr)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {selectedQuote.weddingCount} wedding
                      {selectedQuote.weddingCount === 1 ? "" : "s"} ·{" "}
                      {selectedQuote.coverageDays.toLocaleString("en-IN")} calendar days · ends{" "}
                      {coverageEnd}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedQuote.additionalDaysTotal
                        ? `${formatInr(selectedQuote.minimumCostInr)} minimum + ${formatInr(selectedQuote.additionalDaysCostInr)} for ${selectedQuote.additionalDaysTotal.toLocaleString("en-IN")} day${selectedQuote.additionalDaysTotal === 1 ? "" : "s"} after the first ${selectedQuote.includedDaysPerWedding} per wedding.`
                        : `The minimum includes the first ${selectedQuote.includedDaysPerWedding} calendar days for each wedding.`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a future wedding date to see your estimate.
                  </p>
                )}
              </div>
              <Button
                type="button"
                className="min-h-11 w-full shrink-0 sm:w-auto"
                disabled={selectedPlanIsCurrent || checkoutPending || !selectedQuote}
                onClick={() => checkoutPlan(selectedPlan, weddingCount)}
              >
                {selectedPlanIsCurrent
                  ? "Current coverage"
                  : checkoutPending
                    ? "Opening checkout…"
                    : selectedQuote
                      ? `Continue with ${selectedTier.name}`
                      : "Add wedding date"}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Secure checkout is handled by Razorpay. This is a one-time payment for the complete
            planning window—there is no silent renewal.
          </p>
          <div className="mt-5 border-t border-border pt-5">
            <div className="text-sm font-semibold">Add capacity without changing your plan</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {PAID_ADD_ONS.map((pack) => (
                <Button
                  key={pack.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-18 justify-start whitespace-normal px-3 py-3 text-left"
                  disabled={checkoutPending}
                  onClick={() => checkoutPack(pack.id)}
                >
                  <span>
                    <span className="block text-xs font-semibold">
                      {formatInr(pack.priceInr)} · {pack.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
                      {pack.includes}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Packs apply to this calendar month and are added only after Razorpay confirms payment.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  min,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  min?: string;
  inputMode?: "numeric";
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        inputMode={inputMode}
        className="h-11 rounded-lg bg-background"
      />
    </div>
  );
}

function formatWeddingDate(value: string) {
  if (!value) return "Add wedding date";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Add wedding date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatBudget(value: string) {
  const amount = Number(value);
  return value && Number.isFinite(amount) && amount > 0 ? formatInr(amount) : "Add total budget";
}
