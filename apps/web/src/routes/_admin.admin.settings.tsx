import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_admin/admin/settings")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Settings" title="Platform settings" subtitle="Coming soon — feature flags, categories, cities, communities." />
    </div>
  ),
});
