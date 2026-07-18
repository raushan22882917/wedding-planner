import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, HeartHandshake, Loader2, Palette, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import {
  createWebsiteCustomRequest,
  getMyWebsiteCustomRequests,
  type WebsiteCustomRequestStatus,
} from "@/lib/wedding-website.functions";

export const Route = createFileRoute("/_app/website/custom-request")({
  component: WebsiteCustomRequestPage,
});

const statusLabel: Record<WebsiteCustomRequestStatus, string> = {
  new: "Received",
  in_review: "In review",
  in_progress: "In progress",
  completed: "Completed",
};

function WebsiteCustomRequestPage() {
  const qc = useQueryClient();
  const requestsFn = useServerFn(getMyWebsiteCustomRequests);
  const createRequestFn = useServerFn(createWebsiteCustomRequest);
  const requests = useQuery({
    queryKey: ["website-custom-requests"],
    queryFn: () => requestsFn(),
    refetchOnWindowFocus: true,
  });
  const [requestTitle, setRequestTitle] = useState("Custom wedding website design");
  const [brief, setBrief] = useState("");
  const [contactPreference, setContactPreference] = useState<"email" | "phone" | "whatsapp">(
    "email",
  );
  const [contactValue, setContactValue] = useState("");

  const createRequest = useMutation({
    mutationFn: () =>
      createRequestFn({
        data: { requestTitle, brief, contactPreference, contactValue },
      }),
    onSuccess: (request) => {
      qc.setQueryData<Tables<"website_custom_requests">[]>(
        ["website-custom-requests"],
        (current) => [request, ...(current ?? [])],
      );
      setBrief("");
      toast.success("Your custom website request has been sent to the admin team.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not send your request."),
  });

  const contactPlaceholder =
    contactPreference === "email"
      ? "you@example.com"
      : contactPreference === "whatsapp"
        ? "WhatsApp number with country code"
        : "Phone number with country code";

  return (
    <div className="space-y-7 p-6 lg:p-8">
      <PageHeader
        eyebrow="Custom website service"
        title="Work with our website team"
        subtitle="Tell the MarryMap admin team what you need. Your saved wedding website is attached automatically, so they can start with the right details."
        action={
          <Link
            to="/website"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-3xl leading-tight">
                Describe your dream invitation
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                Share your preferred colours, cultural details, pages, RSVP needs, and any design
                references. An admin reviews the request before work begins.
              </p>
            </div>
          </div>

          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              createRequest.mutate();
            }}
          >
            <div>
              <Label htmlFor="custom-request-title">Request title</Label>
              <Input
                id="custom-request-title"
                className="mt-1.5 min-h-11"
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div>
              <Label htmlFor="custom-request-brief">What should the team create?</Label>
              <Textarea
                id="custom-request-brief"
                className="mt-1.5 min-h-44 text-sm leading-6"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                minLength={20}
                maxLength={2000}
                required
                placeholder="Example: We want a warm marigold and ivory website with a separate mehendi page, a photo timeline, bilingual Hindi/English copy, and a memorable RSVP experience."
              />
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {brief.length}/2,000 characters · Include links to any inspiration if helpful.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <div>
                <Label htmlFor="custom-contact-preference">Best way to reply</Label>
                <select
                  id="custom-contact-preference"
                  value={contactPreference}
                  onChange={(event) =>
                    setContactPreference(event.target.value as "email" | "phone" | "whatsapp")
                  }
                  className="mt-1.5 flex min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <Label htmlFor="custom-contact-value">Your contact detail</Label>
                <Input
                  id="custom-contact-value"
                  className="mt-1.5 min-h-11"
                  value={contactValue}
                  onChange={(event) => setContactValue(event.target.value)}
                  placeholder={contactPlaceholder}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="min-h-11 rounded-xl"
              disabled={createRequest.isPending}
            >
              {createRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {createRequest.isPending ? "Sending request…" : "Send request to admin"}
            </Button>
          </form>
        </section>

        <aside className="h-fit rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-purple-brand/[0.08] p-5">
          <HeartHandshake className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-display text-2xl">How it works</h2>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
            <li>
              <span className="mr-2 font-semibold text-foreground">1.</span>
              You send a brief with your contact preference.
            </li>
            <li>
              <span className="mr-2 font-semibold text-foreground">2.</span>
              An admin reviews your saved website and request.
            </li>
            <li>
              <span className="mr-2 font-semibold text-foreground">3.</span>
              The team contacts you before beginning paid custom work.
            </li>
          </ol>
          <p className="mt-5 border-t border-border/70 pt-4 text-[12px] leading-5 text-muted-foreground">
            No payment is charged and no message is sent outside MarryMap when you submit this
            request.
          </p>
        </aside>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Your requests
            </div>
            <h2 className="mt-1 font-display text-2xl">Saved admin requests</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-muted-foreground">
            {requests.data?.length ?? 0} saved
          </span>
        </div>
        {requests.isLoading ? (
          <div className="mt-5 h-24 animate-pulse rounded-2xl bg-secondary" />
        ) : requests.data?.length ? (
          <div className="mt-5 space-y-3">
            {requests.data.map((request) => (
              <article key={request.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{request.request_title}</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Sent{" "}
                      {new Date(request.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      request.status === "completed"
                        ? "bg-success/12 text-success"
                        : request.status === "in_progress"
                          ? "bg-purple-brand/10 text-purple-brand"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {request.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {statusLabel[request.status]}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {request.brief}
                </p>
                {request.admin_note && (
                  <div className="mt-3 rounded-xl bg-secondary/65 p-3 text-[12px] leading-5 text-muted-foreground">
                    <strong className="font-semibold text-foreground">Admin update: </strong>
                    {request.admin_note}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            No custom requests yet. Your first request will appear here with its review status.
          </p>
        )}
      </section>
    </div>
  );
}
