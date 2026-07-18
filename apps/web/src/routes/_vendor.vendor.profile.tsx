import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_vendor/vendor/profile")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Profile" title="Business profile" subtitle="Coming soon — business details, contact, and hero image." />
    </div>
  ),
});
