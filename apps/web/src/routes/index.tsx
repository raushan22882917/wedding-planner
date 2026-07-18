import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  CalendarDays,
  Wallet,
  MessageSquare,
  ShieldCheck,
  Users,
  Check,
  Heart,
  Quote,
} from "lucide-react";

import heroImg from "@/assets/landing-hero.jpg";
import moodboardImg from "@/assets/landing-moodboard.jpg";
import venueImg from "@/assets/landing-venue.jpg";
import {
  PAID_ADD_ONS,
  SUBSCRIPTION_PLANS,
  WEDDING_COVERAGE_PRICING,
  formatInr,
} from "@/lib/subscription";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarryMap — The AI Wedding Operating System" },
      {
        name: "description",
        content:
          "Plan your wedding in one calm workspace. Build an editable timeline, track your budget and guests, research vendors, and draft WhatsApp messages with AI.",
      },
      { property: "og:title", content: "MarryMap — The AI Wedding Operating System" },
      {
        property: "og:description",
        content:
          "Timelines, budgets, guests, vendor research, and AI-drafted WhatsApp messages in one elegant workspace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <LogoStrip />
      <ProblemSection />
      <FeatureGrid />
      <ShowcaseSection />
      <HowItWorks />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ---------------- Nav ---------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-xl tracking-tight">MarryMap</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-full px-4 py-2 text-sm text-foreground/80 hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            Start planning
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-rose-brand to-purple-brand shadow-[0_8px_24px_-8px_var(--primary)]">
      <Heart className="h-4 w-4 fill-white text-white" />
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -right-32 top-40 h-[520px] w-[520px] rounded-full bg-purple-brand/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_oklab,var(--gold-brand)_18%,transparent),transparent_60%)]" />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            The AI Wedding Operating System
          </div>

          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Plan the wedding.{" "}
            <span className="bg-gradient-to-br from-primary via-rose-brand to-purple-brand bg-clip-text text-transparent">
              Skip the planner.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Bring your date, budget, guests, vendors, and ceremony plans into one calm workspace.
            MarryMap helps you create a clear plan, draft vendor messages with AI, and keep every
            decision easy to find.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)] transition-transform hover:-translate-y-0.5"
            >
              Start planning free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:bg-white"
            >
              See how it works
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {["Your plan, in one place", "Review every AI draft before sending"].map((point) => (
              <span
                key={point}
                className="inline-flex items-center rounded-full border border-border/70 bg-white/60 px-3 py-1.5"
              >
                {point}
              </span>
            ))}
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/60 shadow-[0_40px_80px_-40px_rgba(17,17,17,0.35)]">
            <img
              src={heroImg}
              alt="Elegant wedding rings and invitation on a marble table"
              width={1600}
              height={1408}
              className="h-[520px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>

          {/* floating AI card */}
          <div className="absolute -left-6 bottom-8 hidden w-[280px] rounded-2xl border border-border/60 bg-white/90 p-4 shadow-xl backdrop-blur sm:block">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="ai-dot inline-block h-2 w-2 rounded-full bg-primary" />
              MarryMap AI · drafting
            </div>
            <p className="mt-2 text-sm leading-snug text-foreground">
              &ldquo;Hi Bloom &amp; Vine — we&rsquo;re considering you for a 120-guest vineyard
              wedding on June 14. Could you share seasonal peony packages and a full quote?&rdquo;
            </p>
          </div>

          {/* floating budget card */}
          <div className="absolute -right-4 top-8 hidden w-[240px] rounded-2xl border border-border/60 bg-white/90 p-4 shadow-xl backdrop-blur sm:block">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Budget</span>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                On track
              </span>
            </div>
            <div className="mt-2 font-display text-2xl">$42,180</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-purple-brand" />
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              68% of $62,000 · Budget categories in one view
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Logos ---------------- */

function LogoStrip() {
  const items = ["Timeline", "Budget", "Vendors", "Guests", "Tasks"];
  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          One shared home for your wedding plan
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6 text-center font-display text-lg text-muted-foreground/70 sm:grid-cols-3 md:grid-cols-5">
          {items.map((i) => (
            <div key={i} className="italic">
              {i}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Problem ---------------- */

function ProblemSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">The reality</p>
        <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Planning a wedding is a lot of decisions.{" "}
          <span className="italic text-primary">Keep the judgment yours.</span>
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          The guest list, every vendor reply, the budget, and the ceremony schedule all deserve a
          clear home. MarryMap organizes the work so you and your family can make confident calls
          without losing the details.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { n: "Timeline", label: "Ceremonies, events, and tasks" },
          { n: "Budget", label: "Categories and expenses" },
          { n: "Guests", label: "RSVPs, dietary notes, and seating" },
        ].map((s) => (
          <div key={s.label} className="soft-card hover-lift p-8 text-center">
            <div className="font-display text-5xl tracking-tight text-primary">{s.n}</div>
            <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

const features = [
  {
    icon: CalendarDays,
    title: "Timeline that thinks ahead",
    body: "Start with your date, city, guest count, budget, and ceremonies. MarryMap creates editable planning and budget starting points you can shape together.",
  },
  {
    icon: MessageSquare,
    title: "Vendor WhatsApp messages in your voice",
    body: "Ask AI to draft vendor enquiries and follow-ups in your voice, then review the message before opening WhatsApp to send it.",
  },
  {
    icon: Wallet,
    title: "Live budget, real numbers",
    body: "Set a target budget, organize spending by category, and record expenses as your plans become real.",
  },
  {
    icon: ShieldCheck,
    title: "Vendor decisions, organized",
    body: "Research vendors, save a shortlist, and keep contact links, notes, quotes, and document references close to the decision.",
  },
  {
    icon: Users,
    title: "Guests, in order",
    body: "Import your list, track RSVPs, dietary notes, and seating in one calm view. No more color-coded spreadsheets at midnight.",
  },
  {
    icon: Sparkles,
    title: "One dashboard, less noise",
    body: "Move between your plan, timeline, budget, vendors, guest list, messages, and tasks without hunting through separate tools.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border/60 bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Everything, in one place
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            An operating system, not a checklist.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The essentials for a clear, collaborative wedding plan — with AI help when you want it.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group soft-card hover-lift relative overflow-hidden p-7">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-purple-brand/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Showcase ---------------- */

function ShowcaseSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-28">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="relative">
          <img
            src={moodboardImg}
            alt="Wedding mood board flatlay"
            loading="lazy"
            width={1408}
            height={1008}
            className="rounded-3xl border border-border/60 object-cover shadow-[0_30px_60px_-30px_rgba(17,17,17,0.3)]"
          />
          <div className="absolute -bottom-6 -right-6 hidden w-64 rounded-2xl border border-border/60 bg-white/95 p-4 shadow-xl backdrop-blur md:block">
            <div className="text-xs font-medium text-muted-foreground">Florist quotes</div>
            <div className="mt-3 space-y-2">
              {[
                { n: "Bloom & Vine", p: "$4,200", ok: true },
                { n: "Petal Studio", p: "$5,800", ok: false },
                { n: "Wildflower Co.", p: "$3,950", ok: true },
              ].map((q) => (
                <div key={q.n} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{q.n}</span>
                  <span className={q.ok ? "text-success" : "text-primary"}>{q.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Vendor workspace</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            Keep every vendor decision easy to revisit.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Save the vendors you are considering, keep their contact details and documents in reach,
            and let AI help you write a clear enquiry or follow-up when you are ready.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Source-backed vendor research and shortlists",
              "Contact links and vendor notes in one place",
              "Quote, invoice, and contract document references",
              "AI-drafted enquiries and follow-ups for your review",
            ].map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Start with the wedding details",
      d: "Add your date, city, guest count, budget, and ceremonies. We give you an editable planning foundation.",
    },
    {
      n: "02",
      t: "Let AI draft the outreach",
      d: "Vendor WhatsApp messages are drafted in your voice, ready for you to review and send.",
    },
    {
      n: "03",
      t: "Approve, adjust, arrive",
      d: "Keep your timeline, tasks, guests, vendors, and budget together as plans evolve. You stay in control of every decision.",
    },
  ];

  return (
    <section id="how" className="relative overflow-hidden bg-foreground text-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-purple-brand/25 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-brand">How it works</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            Three steps between engaged and married.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur transition-transform hover:-translate-y-1"
            >
              <div className="font-display text-4xl text-gold-brand">{s.n}</div>
              <h3 className="mt-3 font-display text-2xl">{s.t}</h3>
              <p
                className="mt-3 text-sm leading-relaxed text-background/70"
                dangerouslySetInnerHTML={{ __html: s.d }}
              />
            </div>
          ))}
        </div>

        <div className="mt-16 overflow-hidden rounded-3xl border border-white/10">
          <img
            src={venueImg}
            alt="Golden hour vineyard wedding table"
            loading="lazy"
            width={1408}
            height={912}
            className="h-[380px] w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

const testimonials = [
  {
    q: "We planned a 140-person wedding in four months, without a planner. MarryMap caught two florist overcharges before I signed anything.",
    n: "Ava & Nathan",
    d: "Married in Napa",
  },
  {
    q: "The AI drafts sound like me. My mom asked how I had time to write such nice emails to twelve vendors in one afternoon.",
    n: "Priya & Dev",
    d: "Married in Austin",
  },
  {
    q: "It felt like having a very calm, very organized friend who happened to know what everything should cost.",
    n: "Lena & James",
    d: "Married in Charleston",
  },
];

function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Couples, on the record</p>
        <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          Planned by two. Guided by one.
        </h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <figure key={t.n} className="soft-card hover-lift flex flex-col justify-between p-7">
            <Quote className="h-6 w-6 text-primary/60" />
            <blockquote className="mt-4 font-display text-lg leading-snug text-foreground">
              &ldquo;{t.q}&rdquo;
            </blockquote>
            <figcaption className="mt-6 border-t border-border pt-4 text-sm">
              <div className="font-medium text-foreground">{t.n}</div>
              <div className="text-muted-foreground">{t.d}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

const tiers = [SUBSCRIPTION_PLANS.free, SUBSCRIPTION_PLANS.essential, SUBSCRIPTION_PLANS.signature];

function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border/60 bg-secondary/30 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            Priced against the dinner, not the planner.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A wedding has a busy season, not an endless software lifecycle. Paid coverage is
            calculated for the weddings and calendar days you need, with every allowance visible
            before we spend a paid API, search, or call credit on your behalf.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "relative overflow-hidden rounded-3xl border p-8 " +
                (t.featured
                  ? "border-primary/40 bg-white shadow-[0_30px_80px_-30px_var(--primary)]"
                  : "border-border bg-white")
              }
            >
              {t.featured && (
                <div className="absolute right-6 top-6 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Best value
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-5xl tracking-tight">
                  {t.name === "Explore"
                    ? formatInr(0)
                    : formatInr(WEDDING_COVERAGE_PRICING.minimumMonthlyInr)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t.name === "Explore" ? "to start" : "/ wedding · first 30 days"}
                </span>
              </div>
              <div className="mt-1 min-h-10 text-sm text-muted-foreground">
                {t.name === "Explore"
                  ? t.summary
                  : `${t.summary} + ${formatInr(WEDDING_COVERAGE_PRICING.additionalDayInr)} / day after the first 30 days.`}
              </div>

              <ul className="mt-7 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/auth"
                className={
                  "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 " +
                  (t.featured
                    ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)]"
                    : "border border-border bg-foreground text-background")
                }
              >
                {t.name !== "Explore" ? `Choose ${t.name}` : "Start free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-6xl gap-4 rounded-2xl border border-border bg-background p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="font-medium">Need more capacity for one intense month?</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Add-ons are one-time usage packs, never an automatic plan upgrade. Voice calls are
              paid separately because telephony pricing varies by provider and destination.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-xs sm:text-sm">
            {PAID_ADD_ONS.map((addOn) => (
              <div key={addOn.name}>
                <div className="font-semibold tabular-nums">{formatInr(addOn.priceInr)}</div>
                <div className="mt-0.5 text-muted-foreground">{addOn.name}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-relaxed text-muted-foreground">
          Manual planning tools remain available on every plan. AI replies, source-backed vendor
          research, sends from MarryMap, and availability calls are usage-metered because they
          create real provider costs.
        </p>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const faqs = [
  {
    q: "Does MarryMap actually replace a wedding planner?",
    a: "MarryMap gives you one workspace for planning: timeline, budget, guests, vendors, tasks, documents, and AI-assisted outreach. It does not replace an on-site professional coordinator if you want someone physically present to run the wedding day.",
  },
  {
    q: "How does the AI WhatsApp drafting work?",
    a: "MarryMap drafts WhatsApp inquiries and negotiations in your voice, then shows every draft for your approval. You can open WhatsApp directly or send through your connected OpenWA session.",
  },
  {
    q: "How do I manage vendor quotes?",
    a: "Save your shortlisted vendors, contact links, notes, and quote or contract document references in MarryMap. You can use the AI chat to prepare questions and follow-ups, then make the final decision with your own quote review.",
  },
  {
    q: "What if I already started planning?",
    a: "Bring in your guest list, add your vendors and budget categories, and create or edit your events and tasks. MarryMap is designed to meet you wherever your planning is today.",
  },
];

function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-6 py-28">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Questions</p>
        <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          Answers for the doubting parent.
        </h2>
      </div>

      <div className="mt-12 divide-y divide-border rounded-3xl border border-border bg-white">
        {faqs.map((f) => (
          <details key={f.q} className="group px-6 py-5 open:bg-secondary/40">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg text-foreground">
              {f.q}
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-28">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-gradient-to-br from-primary via-rose-brand to-purple-brand p-12 text-center text-white shadow-[0_40px_100px_-40px_var(--primary)] sm:p-20">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-6xl">
            Your wedding, planned by two. Guided by one.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">
            Free to start. Every dollar you spend from here on out flows through a workspace that
            quietly protects it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
            >
              Start planning free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              See pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-12 md:flex-row md:items-center">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <BrandMark />
            <span className="font-display text-lg">MarryMap</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            The AI Wedding Operating System. Made with care for couples doing this for the first
            time.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="space-y-2">
            <div className="font-medium text-foreground">Product</div>
            <a href="#features" className="block hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="block hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="block hover:text-foreground">
              FAQ
            </a>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-foreground">Company</div>
            <a className="block hover:text-foreground" href="#">
              About
            </a>
            <a className="block hover:text-foreground" href="#">
              Journal
            </a>
            <a className="block hover:text-foreground" href="#">
              Contact
            </a>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-foreground">Legal</div>
            <a className="block hover:text-foreground" href="#">
              Privacy
            </a>
            <a className="block hover:text-foreground" href="#">
              Terms
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MarryMap. All rights reserved.
      </div>
    </footer>
  );
}
