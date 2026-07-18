import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_vendor/vendor/leads")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Leads" title="Couple inquiries" subtitle="Coming soon — booking requests and quote conversations." />
    </div>
  ),
});
