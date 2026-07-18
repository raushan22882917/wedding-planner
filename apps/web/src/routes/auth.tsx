import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SignupRole = "couple" | "vendor";

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.from("user_roles").select("role");
  const roles = (data ?? []).map((r) => r.role as string);
  const primary = roles.includes("admin") ? "admin" : roles.includes("vendor") ? "vendor" : "couple";
  if (primary === "admin") return navigate({ to: "/admin/dashboard", replace: true });
  if (primary === "vendor") return navigate({ to: "/vendor/dashboard", replace: true });
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .maybeSingle();
  if (!profile?.onboarding_completed_at) return navigate({ to: "/onboarding", replace: true });
  return navigate({ to: "/planner", replace: true });
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — MarryMap" },
      { name: "description", content: "Sign in to your MarryMap wedding operating system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<SignupRole>("couple");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) routeByRole(navigate);
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data:
              role === "vendor"
                ? { role: "vendor", partner_one: businessName || email.split("@")[0] }
                : { role: "couple", partner_one: partnerOne, partner_two: partnerTwo },
          },
        });
        if (error) throw error;
        toast.success(role === "vendor" ? "Vendor account created 🏢" : "Welcome to MarryMap ❤");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      await routeByRole(navigate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-rose-brand/8 via-background to-purple-brand/8 p-12 flex-col justify-between">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-purple-brand/10 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2.5 z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-brand grid place-items-center shadow-md">
            <Heart className="h-5 w-5 text-white" fill="white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-xl leading-none">MarryMap</div>
            <div className="text-[11px] text-muted-foreground mt-1 tracking-widest uppercase">Wedding OS</div>
          </div>
        </Link>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-primary bg-primary/8 rounded-full px-3 py-1.5 mb-6">
            <Sparkles className="h-3 w-3" /> AI Wedding Operating System
          </div>
          <h1 className="font-display text-5xl leading-tight text-foreground">
            Plan the wedding of your dreams — without hiring a planner.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            MarryMap researches vendors, negotiates quotes, drafts emails, and keeps every timeline,
            budget line and guest in one calm workspace.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { n: "8,400+", l: "vendors curated" },
              { n: "₹3.2L", l: "avg savings" },
              { n: "42 hrs", l: "planning saved/mo" },
            ].map((s) => (
              <div key={s.l} className="soft-card p-4">
                <div className="font-display text-2xl text-foreground">{s.n}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[12px] text-muted-foreground">
          "It felt like we hired the best planner in the city." — Priya &amp; Arjun
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-brand grid place-items-center">
              <Heart className="h-5 w-5 text-white" fill="white" strokeWidth={2.5} />
            </div>
            <div className="font-display text-xl">MarryMap</div>
          </div>

          <h2 className="font-display text-3xl">
            {mode === "signin" ? "Welcome back" : "Start planning"}
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "signin"
              ? "Sign in to continue where you left off."
              : "Create your wedding workspace in seconds."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label className="text-[12px]">I'm signing up as</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["couple", "vendor"] as const).map((r) => {
                      const active = role === r;
                      const Icon = r === "couple" ? Heart : Building2;
                      return (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRole(r)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] transition text-left",
                            active
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                          <div>
                            <div className="font-medium capitalize">{r}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {r === "couple" ? "Plan our wedding" : "Sell my services"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {role === "couple" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="p1" className="text-[12px]">Your name</Label>
                      <Input id="p1" value={partnerOne} onChange={(e) => setPartnerOne(e.target.value)} placeholder="Priya" className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="p2" className="text-[12px]">Partner's name</Label>
                      <Input id="p2" value={partnerTwo} onChange={(e) => setPartnerTwo(e.target.value)} placeholder="Arjun" className="mt-1.5" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="biz" className="text-[12px]">Business name</Label>
                    <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Studio Aperture" className="mt-1.5" />
                  </div>
                )}
              </>
            )}


            <div>
              <Label htmlFor="email" className="text-[12px]">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-[12px]">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-primary to-purple-brand hover:opacity-90 transition"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to MarryMap?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
