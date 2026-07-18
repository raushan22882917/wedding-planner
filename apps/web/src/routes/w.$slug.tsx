import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  CalendarDays,
  Check,
  ChevronLeft,
  Flower2,
  Heart,
  Menu,
  MapPin,
  MessageCircleHeart,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { getWeddingTemplate } from "@/lib/wedding-templates";
import {
  getPublicWeddingWebsite,
  submitWeddingRsvp,
  type WebsiteCeremony,
} from "@/lib/wedding-website.functions";

export const Route = createFileRoute("/w/$slug")({ component: PublicWeddingWebsite });

type WebsiteRow = Tables<"wedding_websites">;

function asCeremonies(value: unknown): WebsiteCeremony[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const ceremony = (item ?? {}) as Partial<WebsiteCeremony>;
    return {
      id: ceremony.id || `event-${index}`,
      name: ceremony.name || "Wedding event",
      description: ceremony.description || "",
      date: ceremony.date || "Date to be announced",
      event_date: ceremony.event_date || undefined,
      time: ceremony.time || "",
      venue: ceremony.venue || "Venue to be announced",
      accepting_rsvps: ceremony.accepting_rsvps !== false,
    };
  });
}

function PublicWeddingWebsite() {
  const { slug } = Route.useParams();
  const getWebsite = useServerFn(getPublicWeddingWebsite);
  const submitRsvp = useServerFn(submitWeddingRsvp);
  const website = useQuery({
    queryKey: ["public-wedding-site", slug],
    queryFn: () => getWebsite({ data: { slug } }),
  });
  const [response, setResponse] = useState<"yes" | "no" | "maybe">("yes");
  const [selectedCeremonies, setSelectedCeremonies] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const site: WebsiteRow | null | undefined = website.data;
  const ceremonySections = useMemo(() => asCeremonies(site?.ceremonies), [site?.ceremonies]);
  const ceremonies = useMemo(
    () => ceremonySections.filter((ceremony) => ceremony.accepting_rsvps),
    [ceremonySections],
  );
  const ceremonyIds = useMemo(() => ceremonies.map((ceremony) => ceremony.id), [ceremonies]);
  useEffect(() => {
    if (!site?.id || ceremonyIds.length === 0) return;
    setSelectedCeremonies((current) => (current.length === 0 ? ceremonyIds : current));
  }, [ceremonyIds, site?.id]);

  const rsvp = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form);
      return submitRsvp({
        data: {
          slug,
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          phone: String(data.get("phone") || ""),
          response,
          guest_count: Number(data.get("guest_count") || 1),
          message: String(data.get("message") || ""),
          ceremonies: selectedCeremonies,
        },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Your RSVP has been saved");
    },
    onError: (error: Error) => toast.error(error.message || "We could not send your RSVP."),
  });

  if (website.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf7] text-[#513432]">
        <div className="text-center">
          <Heart className="mx-auto h-7 w-7 animate-pulse fill-primary text-primary" />
          <p className="mt-3 font-display text-xl">Preparing your invitation…</p>
        </div>
      </div>
    );
  }

  if (website.isError || !site) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf7] px-6 text-center text-[#513432]">
        <div>
          <Flower2 className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 font-display text-3xl">This invitation is private</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#513432]/65">
            The link may be incomplete, or the couple has not published their wedding website yet.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            MarryMap
          </Link>
        </div>
      </div>
    );
  }

  const template = getWeddingTemplate(site.card_design);
  const isDark = template.mode === "dark";
  const darkText = template.text;
  const mutedText = template.muted;
  const surface = template.surface;
  const card = template.card;

  const toggleCeremony = (id: string) =>
    setSelectedCeremonies((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const primaryCeremony = ceremonySections[0];
  const navigation = [
    { href: "#home", label: "Home" },
    { href: "#story", label: "Our story" },
    { href: "#celebrations", label: "Celebrations" },
    { href: "#rsvp", label: "RSVP" },
  ];
  const heroCopy = (className?: string) => (
    <div className={cn("relative z-10", className)}>
      <div
        className={cn(
          "wedding-site-reveal inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
          template.chip,
        )}
      >
        <Sparkles className="h-3 w-3" />
        Together with our families
      </div>
      <h1
        className={cn(
          "wedding-site-reveal wedding-site-reveal-delay-1 mt-5 max-w-3xl text-5xl leading-[1.03] sm:text-6xl lg:text-7xl",
          template.heading,
        )}
      >
        {site.title}
      </h1>
      <p
        className={cn(
          "wedding-site-reveal wedding-site-reveal-delay-2 mt-5 max-w-xl text-base leading-relaxed sm:text-lg",
          mutedText,
        )}
      >
        {site.welcome_message}
      </p>
      <div className="wedding-site-reveal wedding-site-reveal-delay-3 mt-7 flex flex-wrap items-center gap-3">
        <a
          href="#rsvp"
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2",
            template.button,
          )}
        >
          <MessageCircleHeart className="h-4 w-4" />
          RSVP to celebrate
        </a>
        {primaryCeremony && (
          <a
            href="#celebrations"
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2",
              template.border,
            )}
          >
            View the schedule
            <ArrowDown className="h-4 w-4" />
          </a>
        )}
      </div>
      {primaryCeremony && (
        <div
          className={cn(
            "wedding-site-reveal wedding-site-reveal-delay-4 mt-8 flex items-center gap-3 border-l-2 pl-3 text-sm",
            template.border,
          )}
        >
          <CalendarDays className={cn("h-4 w-4 shrink-0", template.accent)} />
          <span className={mutedText}>{primaryCeremony.date}</span>
          <span className={cn("hidden sm:inline", mutedText)}>·</span>
          <span className={cn("hidden sm:inline", mutedText)}>{primaryCeremony.venue}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("min-h-screen", surface, darkText)}>
      <a
        href="#invitation-content"
        className="sr-only z-50 rounded-b-lg bg-white px-4 py-3 text-sm font-semibold text-black focus:not-sr-only focus:absolute focus:left-4 focus:top-0"
      >
        Skip to invitation details
      </a>
      <header
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur-xl",
          template.border,
          isDark ? "bg-black/25" : "bg-white/75",
        )}
      >
        <div className="relative mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <a
            href="#home"
            className={cn(
              "inline-flex min-h-11 items-center gap-2.5 rounded-lg pr-2 text-lg focus:outline-none focus:ring-2 focus:ring-current",
              template.heading,
            )}
          >
            <span className={cn("grid h-9 w-9 place-items-center rounded-xl", template.button)}>
              <Heart className="h-4 w-4 fill-current" />
            </span>
            <span>Our celebration</span>
          </a>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Invitation navigation">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3 text-[12px] font-medium transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current",
                  mutedText,
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <a
              href="#rsvp"
              className={cn(
                "hidden min-h-10 items-center rounded-full px-4 text-[12px] font-semibold sm:inline-flex",
                template.button,
              )}
            >
              RSVP
            </a>
            <button
              type="button"
              aria-label={menuOpen ? "Close invitation menu" : "Open invitation menu"}
              aria-controls="invitation-mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current lg:hidden",
                template.border,
              )}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {menuOpen && (
            <nav
              id="invitation-mobile-navigation"
              className={cn(
                "absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-2xl border p-2 shadow-xl lg:hidden",
                template.card,
              )}
              aria-label="Invitation navigation"
            >
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current",
                    mutedText,
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main id="invitation-content" tabIndex={-1}>
        <section id="home" className="relative overflow-hidden">
          {template.layout === "classic" ? (
            <div className="relative min-h-[690px] overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
              <div className="absolute inset-0">
                {site.hero_image_url ? (
                  <img
                    src={site.hero_image_url}
                    alt="Wedding celebration"
                    className="h-full w-full object-cover wedding-site-image-drift"
                  />
                ) : (
                  <div className={cn("h-full w-full bg-gradient-to-br", template.heroFallback)} />
                )}
                <div className={cn("absolute inset-0 bg-gradient-to-t", template.heroOverlay)} />
                <div className={cn("absolute inset-0", isDark ? "bg-black/20" : "bg-black/10")} />
              </div>
              <div className="relative mx-auto flex min-h-[520px] max-w-4xl items-center justify-center">
                <div
                  className={cn(
                    "wedding-site-panel-rise max-w-3xl rounded-[2rem] border p-7 text-center shadow-2xl backdrop-blur-md sm:p-12",
                    card,
                  )}
                >
                  {heroCopy("flex flex-col items-center")}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:gap-12",
                template.layout === "split" && "lg:grid-cols-[1.08fr_0.92fr]",
                template.layout === "romantic" && "lg:grid-cols-[0.9fr_1.1fr]",
                template.layout === "modern" && "lg:grid-cols-[1.05fr_0.95fr]",
              )}
            >
              {template.layout === "romantic" && (
                <div className="order-2 lg:order-1">{heroCopy("lg:pr-8")}</div>
              )}
              <div
                className={cn(
                  "wedding-site-panel-rise relative min-h-[410px] overflow-hidden border shadow-2xl sm:min-h-[530px]",
                  template.layout === "split" && "rounded-[2rem] lg:rounded-[2.5rem]",
                  template.layout === "romantic" && "order-1 rounded-[999px] p-3 lg:order-2",
                  template.layout === "modern" && "rounded-sm p-3 sm:p-5",
                  card,
                )}
              >
                <div className="absolute inset-0 overflow-hidden">
                  {site.hero_image_url ? (
                    <img
                      src={site.hero_image_url}
                      alt="Wedding celebration"
                      className={cn(
                        "h-full w-full object-cover wedding-site-image-drift",
                        template.layout === "romantic" && "rounded-[999px]",
                      )}
                    />
                  ) : (
                    <div className={cn("h-full w-full bg-gradient-to-br", template.heroFallback)} />
                  )}
                  <div className={cn("absolute inset-0 bg-gradient-to-t", template.heroOverlay)} />
                </div>
                <div className="pointer-events-none absolute inset-0">
                  <span
                    className={cn(
                      "wedding-site-orbit absolute left-[12%] top-[18%] h-20 w-20 rounded-full border",
                      template.border,
                    )}
                  />
                  <Sparkles
                    className={cn(
                      "wedding-site-float absolute right-[12%] top-[18%] h-7 w-7",
                      template.accent,
                    )}
                  />
                  <Sparkles
                    className={cn(
                      "wedding-site-float-slow absolute bottom-[17%] left-[15%] h-5 w-5",
                      template.accent,
                    )}
                  />
                </div>
                <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-black/25 px-4 py-3 text-white backdrop-blur-md">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      Save the date
                    </div>
                    <div className="mt-0.5 text-sm font-medium">
                      {primaryCeremony?.date || "Date to be announced"}
                    </div>
                  </div>
                  <Heart className="h-5 w-5 fill-white text-white" />
                </div>
              </div>
              {template.layout !== "romantic" && (
                <div className={cn(template.layout === "modern" && "lg:pl-5")}>
                  {heroCopy(template.layout === "modern" ? "lg:border-l lg:pl-8" : undefined)}
                </div>
              )}
            </div>
          )}
        </section>

        <section id="story" className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="wedding-site-reveal mx-auto max-w-2xl text-center">
            <div
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.2em]",
                template.accent,
              )}
            >
              Our story
            </div>
            <h2 className={cn("mt-3 text-4xl sm:text-5xl", template.heading)}>
              A celebration of us
            </h2>
            <p className={cn("mt-5 text-[15px] leading-8", mutedText)}>{site.couple_story}</p>
          </div>
          {ceremonySections.length > 0 && (
            <div id="celebrations" className="mt-16 scroll-mt-24 sm:mt-20">
              <div className="wedding-site-reveal mb-7 text-center">
                <div
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.2em]",
                    template.accent,
                  )}
                >
                  Our rasams
                </div>
                <h2 className={cn("mt-2 text-3xl", template.heading)}>Celebrate every moment</h2>
              </div>
              <div className="space-y-4">
                {ceremonySections.map((ceremony, index) => (
                  <article
                    key={ceremony.id}
                    className={cn(
                      "wedding-site-reveal relative overflow-hidden rounded-3xl border p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:flex sm:items-center sm:gap-8 sm:p-8",
                      card,
                    )}
                    style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                  >
                    <div
                      className={cn(
                        "grid h-12 w-12 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        isDark ? "bg-white/10" : "bg-current/8",
                        template.accent,
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-5 min-w-0 flex-1 sm:mt-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className={cn("text-3xl", template.heading)}>{ceremony.name}</h3>
                        <p className={cn("text-sm", mutedText)}>{ceremony.date}</p>
                      </div>
                      {ceremony.description && (
                        <p className={cn("mt-3 max-w-2xl text-[14px] leading-7", mutedText)}>
                          {ceremony.description}
                        </p>
                      )}
                      <p className={cn("mt-4 flex items-center gap-1.5 text-[12px]", mutedText)}>
                        <MapPin className="h-3.5 w-3.5" />
                        {ceremony.venue}
                      </p>
                    </div>
                    <CalendarDays
                      className={cn(
                        "absolute -bottom-8 -right-7 h-28 w-28 opacity-[0.06]",
                        template.accent,
                      )}
                    />
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section
          id="rsvp"
          className={cn(
            "scroll-mt-20 border-y py-20 sm:py-28",
            template.border,
            isDark ? "bg-white/[0.035]" : "bg-white/28",
          )}
        >
          <div className="wedding-site-reveal mx-auto max-w-xl px-5 sm:px-8">
            {submitted ? (
              <div className={cn("rounded-3xl border p-10 text-center", card)}>
                <span
                  className={cn(
                    "mx-auto grid h-12 w-12 place-items-center rounded-full",
                    template.button,
                  )}
                >
                  <Check className="h-6 w-6" />
                </span>
                <h2 className={cn("mt-5 text-3xl", template.heading)}>Thank you for replying</h2>
                <p className={cn("mt-2 text-sm leading-relaxed", mutedText)}>
                  Your details and RSVP have been saved for the couple. They are so happy to
                  celebrate with you.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.2em]",
                      template.accent,
                    )}
                  >
                    Kindly reply
                  </div>
                  <h2 className={cn("mt-2 text-4xl", template.heading)}>Will you be there?</h2>
                  <p className={cn("mt-2 text-sm", mutedText)}>
                    Please help the couple plan a beautiful celebration.
                  </p>
                </div>
                <form
                  className={cn("mt-7 rounded-3xl border p-5 sm:p-7", card)}
                  onSubmit={(event) => {
                    event.preventDefault();
                    rsvp.mutate(event.currentTarget);
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="rsvp-name" className={darkText}>
                        Your name
                      </Label>
                      <Input
                        id="rsvp-name"
                        name="name"
                        required
                        className={cn(
                          "mt-1.5",
                          isDark &&
                            "border-white/15 bg-white/8 text-white placeholder:text-white/40",
                        )}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rsvp-email" className={darkText}>
                        Email <span className={mutedText}>(optional)</span>
                      </Label>
                      <Input
                        id="rsvp-email"
                        name="email"
                        type="email"
                        className={cn(
                          "mt-1.5",
                          isDark &&
                            "border-white/15 bg-white/8 text-white placeholder:text-white/40",
                        )}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rsvp-phone" className={darkText}>
                        Phone <span className={mutedText}>(optional)</span>
                      </Label>
                      <Input
                        id="rsvp-phone"
                        name="phone"
                        type="tel"
                        className={cn(
                          "mt-1.5",
                          isDark &&
                            "border-white/15 bg-white/8 text-white placeholder:text-white/40",
                        )}
                        placeholder="Your phone number"
                      />
                    </div>
                  </div>
                  <fieldset className="mt-5">
                    <legend className="text-sm font-medium">Your response</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["yes", "maybe", "no"] as const).map((option) => (
                        <label
                          key={option}
                          className={cn(
                            "flex h-11 cursor-pointer items-center justify-center rounded-xl border text-[12px] font-semibold capitalize transition",
                            response === option
                              ? template.button
                              : isDark
                                ? "border-white/14 bg-white/5 text-white/75 hover:bg-white/10"
                                : "border-current/10 bg-white/50 hover:bg-white",
                          )}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={response === option}
                            onChange={() => setResponse(option)}
                          />
                          {option === "yes"
                            ? "Joyfully, yes"
                            : option === "maybe"
                              ? "Maybe"
                              : "Regretfully, no"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {response !== "no" && (
                    <>
                      <div className="mt-5">
                        <Label htmlFor="guest-count" className={darkText}>
                          Number in your party
                        </Label>
                        <Input
                          id="guest-count"
                          name="guest_count"
                          type="number"
                          min={1}
                          max={10}
                          defaultValue={1}
                          className={cn(
                            "mt-1.5 max-w-28",
                            isDark && "border-white/15 bg-white/8 text-white",
                          )}
                        />
                      </div>
                      {ceremonies.length > 0 && (
                        <fieldset className="mt-5">
                          <legend className="text-sm font-medium">
                            Which ceremonies will you attend?
                          </legend>
                          <div className="mt-2 space-y-2">
                            {ceremonies.map((ceremony) => (
                              <label
                                key={ceremony.id}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition",
                                  selectedCeremonies.includes(ceremony.id)
                                    ? isDark
                                      ? "border-white/35 bg-white/10"
                                      : "border-current/30 bg-current/5"
                                    : isDark
                                      ? "border-white/12 bg-white/5"
                                      : "border-current/10 bg-white/45",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedCeremonies.includes(ceremony.id)}
                                  onChange={() => toggleCeremony(ceremony.id)}
                                  className="h-4 w-4 accent-current"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-semibold">
                                    {ceremony.name}
                                  </span>
                                  <span className={cn("block text-[11px]", mutedText)}>
                                    {ceremony.date}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    </>
                  )}
                  <div className="mt-5">
                    <Label htmlFor="rsvp-note" className={darkText}>
                      A note for the couple <span className={mutedText}>(optional)</span>
                    </Label>
                    <Textarea
                      id="rsvp-note"
                      name="message"
                      className={cn(
                        "mt-1.5 min-h-24",
                        isDark && "border-white/15 bg-white/8 text-white placeholder:text-white/40",
                      )}
                      placeholder="Share a little love…"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={rsvp.isPending}
                    className={cn("mt-5 w-full rounded-xl", template.button)}
                  >
                    {rsvp.isPending ? "Sending your RSVP…" : "Send RSVP"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <footer className={cn("border-t", template.border)}>
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <a
            href="#home"
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 text-lg md:justify-start",
              template.heading,
            )}
          >
            <span className={cn("grid h-8 w-8 place-items-center rounded-xl", template.button)}>
              <Heart className="h-4 w-4 fill-current" />
            </span>
            Our celebration
          </a>
          <nav
            className="flex flex-wrap justify-center gap-x-4 gap-y-1"
            aria-label="Footer navigation"
          >
            {navigation.slice(1).map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-10 items-center text-[11px] font-medium transition hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-current",
                  mutedText,
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className={cn("text-center text-[11px] leading-relaxed md:text-right", mutedText)}>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 fill-current" />
              Made with MarryMap
            </span>
            <div className="mt-1">With love, from our families to yours.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
