import { createFileRoute } from "@tanstack/react-router";
import { backfillSharedVendorDirectoryFromUserChats } from "@/lib/search-backend.server";

export const Route = createFileRoute("/api/vendor-directory/backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer ")) {
          return new Response("Sign in before importing chat vendor records.", { status: 401 });
        }

        const result = await backfillSharedVendorDirectoryFromUserChats(authorization);
        return Response.json(result ?? { scannedMessages: 0, imported: 0 });
      },
    },
  },
});
