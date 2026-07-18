import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/page-header";

export const Route = createFileRoute("/_vendor/vendor/packages")({
  component: () => (
    <div className="p-6 lg:p-10">
      <PageHeader eyebrow="Packages" title="Pricing & packages" subtitle="Coming soon — create the offers couples will see." />
    </div>
  ),
});
