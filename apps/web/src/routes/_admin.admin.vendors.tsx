import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_admin/admin/vendors")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Vendors" title="Vendor management" subtitle="Coming soon — approve, verify, and feature vendors." />
    </div>
  ),
});
