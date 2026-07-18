import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlanningWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getWeddingWorkspace } = await import("@/lib/wedding-workspace.server");
    return getWeddingWorkspace(context.supabase, context.userId);
  });
