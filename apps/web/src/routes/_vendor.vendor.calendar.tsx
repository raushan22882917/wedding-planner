import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_vendor/vendor/calendar")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Calendar" title="Availability" subtitle="Coming soon — mark blocked and booked dates." />
    </div>
  ),
});
