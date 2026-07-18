import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_admin/admin/users")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Users" title="Users & weddings" subtitle="Coming soon — search couples, view weddings, support." />
    </div>
  ),
});
