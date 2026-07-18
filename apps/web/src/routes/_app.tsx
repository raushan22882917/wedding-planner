import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { AppTopbar } from "@/components/app-shell/topbar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", data.user.id)
      .maybeSingle();
    const onOnboarding = location.pathname === "/onboarding";
    if (!profile?.onboarding_completed_at && !onOnboarding) {
      throw redirect({ to: "/onboarding" });
    }
    if (profile?.onboarding_completed_at && onOnboarding) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/onboarding") {
    return <Outlet />;
  }
  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopbar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
