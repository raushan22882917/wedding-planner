import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Palette, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  listAdminWebsiteCustomRequests,
  updateWebsiteCustomRequestStatus,
  type WebsiteCustomRequestStatus,
} from "@/lib/wedding-website.functions";

export const Route = createFileRoute("/_admin/admin/custom-template-requests")({
  component: AdminCustomTemplateRequestsPage,
});

const statuses: Array<{ id: WebsiteCustomRequestStatus; label: string }> = [
  { id: "new", label: "New" },
  { id: "in_review", label: "In review" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

function AdminCustomTemplateRequestsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminWebsiteCustomRequests);
  const updateFn = useServerFn(updateWebsiteCustomRequestStatus);
  const requests = useQuery({
    queryKey: ["admin-website-custom-requests"],
    queryFn: () => listFn(),
  });
  const updateRequest = useMutation({
    mutationFn: (data: { id: string; status: WebsiteCustomRequestStatus; adminNote: string }) =>
      updateFn({ data }),
    onSuccess: (updated) => {
      qc.setQueryData<Tables<"website_custom_requests">[]>(
        ["admin-website-custom-requests"],
        (current) =>
          current?.map((request) => (request.id === updated.id ? updated : request)) ?? [],
      );
      toast.success("Request update saved");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save the request update."),
  });

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <PageHeader
        eyebrow="Website concierge"
        title="Custom template requests"
        subtitle="Review couples’ bespoke website briefs, contact preference, and saved project context. Status changes are visible to the couple."
      />

      {requests.isLoading ? (
        <div className="h-44 animate-pulse rounded-3xl bg-secondary" />
      ) : requests.data?.length ? (
        <div className="space-y-4">
          {requests.data.map((request) => (
            <AdminRequestCard
              key={request.id}
              request={request}
              saving={updateRequest.isPending && updateRequest.variables?.id === request.id}
              onSave={(status, adminNote) =>
                updateRequest.mutate({ id: request.id, status, adminNote })
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <Palette className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 font-display text-2xl">No custom requests yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New requests from the Website area will arrive here.
          </p>
        </div>
      )}
    </div>
  );
}

function AdminRequestCard({
  request,
  saving,
  onSave,
}: {
  request: Tables<"website_custom_requests">;
  saving: boolean;
  onSave: (status: WebsiteCustomRequestStatus, adminNote: string) => void;
}) {
  const [status, setStatus] = useState<WebsiteCustomRequestStatus>(request.status);
  const [adminNote, setAdminNote] = useState(request.admin_note ?? "");
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl">{request.request_title}</h2>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                request.status === "completed"
                  ? "bg-success/12 text-success"
                  : request.status === "in_progress"
                    ? "bg-purple-brand/10 text-purple-brand"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {statuses.find((item) => item.id === request.status)?.label}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Submitted {new Date(request.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {request.contact_preference}: {request.contact_value}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            Website linked: {request.website_id ? "Yes" : "Not yet"}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-secondary/55 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
        {request.brief}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label htmlFor={`${request.id}-status`} className="text-sm font-semibold">
            Status
          </label>
          <select
            id={`${request.id}-status`}
            value={status}
            onChange={(event) => setStatus(event.target.value as WebsiteCustomRequestStatus)}
            className="mt-1.5 flex min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {statuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${request.id}-admin-note`} className="text-sm font-semibold">
            Update visible to the couple
          </label>
          <Textarea
            id={`${request.id}-admin-note`}
            className="mt-1.5 min-h-20 text-sm"
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="Example: We have reviewed your brief and will contact you within two working days."
          />
        </div>
        <Button
          type="button"
          className="min-h-11 rounded-xl"
          disabled={saving}
          onClick={() => onSave(status, adminNote)}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Save update
        </Button>
      </div>
    </article>
  );
}
