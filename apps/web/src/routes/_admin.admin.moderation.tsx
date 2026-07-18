import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_admin/admin/moderation")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Moderation" title="Reviews & reports" subtitle="Coming soon — moderate reviews and handle abuse reports." />
    </div>
  ),
});
