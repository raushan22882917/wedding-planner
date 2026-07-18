import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_vendor/vendor/reviews")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Reviews" title="What couples are saying" subtitle="Coming soon — ratings from couples you've worked with." />
    </div>
  ),
});
