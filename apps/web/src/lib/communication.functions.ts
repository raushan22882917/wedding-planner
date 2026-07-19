import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WhatsAppGatewayStatus = {
  configured: boolean;
  reachable: boolean;
  connectionMissing: boolean;
  sessionReady: boolean | null;
  sessionStatus: string | null;
  message: string;
  connection: {
    sessionId: string;
    sessionName: string;
    phone: string | null;
    pushName: string | null;
  } | null;
};

export type WhatsAppMessage = {
  id: string;
  messageId: string | null;
  chatId: string;
  body: string;
  direction: "incoming" | "outgoing";
  status: string;
  type: string;
  timestamp: number | null;
  createdAt: string | null;
};

export type WhatsAppContact = {
  id: string;
  name: string | null;
  phone: string | null;
  isMyContact: boolean;
};

export type WhatsAppChat = {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number | null;
  lastMessage: string | null;
};

export type WhatsAppProfilePicture = {
  url: string | null;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type VoiceCallRun = {
  id: string;
  vendorId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  status: "queued" | "initiated" | "in_progress" | "completed" | "failed";
  dograhRunId: number | null;
  initialContext: JsonObject;
  gatheredContext: JsonObject;
  transcriptUrl: string | null;
  recordingUrl: string | null;
  error: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type VoiceCallCampaign = {
  id: string;
  name: string;
  status: "active" | "completed" | "failed";
  weddingBrief: JsonObject;
  targetCount: number;
  initiatedCount: number;
  completedCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
  runs: VoiceCallRun[];
};

export type DograhVoiceStatus = {
  configured: boolean;
  message: string;
};

const unavailableGateway: WhatsAppGatewayStatus = {
  configured: false,
  reachable: false,
  connectionMissing: false,
  sessionReady: false,
  sessionStatus: null,
  message: "OpenWA is not configured. You can still open WhatsApp directly.",
  connection: null,
};

function backendUrl(): string | null {
  return process.env.SEARCH_BACKEND_URL?.replace(/\/$/, "") ?? null;
}

async function backendRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = backendUrl();
  if (!baseUrl)
    throw new Error("WhatsApp sending is not configured. Open WhatsApp directly instead.");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  // Fastify rejects an empty POST body advertised as JSON. Only declare JSON
  // when this proxy request actually carries a body (such as send-message).
  if (init?.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("The WhatsApp gateway is unavailable. Open WhatsApp directly instead.");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok || payload.data === undefined) {
    throw new Error(
      payload.error?.message ?? payload.message ?? "WhatsApp could not complete this request.",
    );
  }
  return payload.data;
}

export const getWhatsAppGatewayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!backendUrl()) return unavailableGateway;
    try {
      return await backendRequest<WhatsAppGatewayStatus>(
        context.accessToken,
        "/v1/whatsapp/status",
      );
    } catch (error) {
      return {
        ...unavailableGateway,
        message:
          error instanceof Error
            ? error.message
            : "The MarryMap API is unavailable, so OpenWA cannot be checked right now.",
      };
    }
  });

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string; text: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<{ provider: "openwa"; chatId: string; messageId: string | null }>(
      context.accessToken,
      "/v1/whatsapp/messages",
      {
        method: "POST",
        body: JSON.stringify({ phone: data.phone, text: data.text }),
      },
    ),
  );

export const connectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<WhatsAppGatewayStatus>(context.accessToken, "/v1/whatsapp/connection", {
      method: "POST",
    }),
  );

export const getWhatsAppQr = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<{ qrCode: string | null; status: string }>(
      context.accessToken,
      "/v1/whatsapp/connection/qr",
    ),
  );

export const listWhatsAppContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<WhatsAppContact[]>(context.accessToken, "/v1/whatsapp/contacts"),
  );

export const listWhatsAppChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<WhatsAppChat[]>(context.accessToken, "/v1/whatsapp/chats"),
  );

export const getWhatsAppProfilePicture = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { chatId: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<WhatsAppProfilePicture>(
      context.accessToken,
      `/v1/whatsapp/contacts/profile-picture?chatId=${encodeURIComponent(data.chatId)}`,
    ),
  );

export const getDograhVoiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<DograhVoiceStatus>(context.accessToken, "/v1/voice/status"),
  );

export const listVoiceCallCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    backendRequest<VoiceCallCampaign[]>(context.accessToken, "/v1/voice/campaigns"),
  );

export const startVoiceCallCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      vendorIds: string[];
      includeBudget: boolean;
      confirmed: true;
    }) => data,
  )
  .handler(({ data, context }) =>
    backendRequest<VoiceCallCampaign>(context.accessToken, "/v1/voice/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );

export const syncVoiceCallCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { campaignId: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<VoiceCallCampaign | null>(
      context.accessToken,
      `/v1/voice/campaigns/${encodeURIComponent(data.campaignId)}/sync`,
      { method: "POST" },
    ),
  );

export const listWhatsAppChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { chatId: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<WhatsAppMessage[]>(
      context.accessToken,
      `/v1/whatsapp/chat/messages?chatId=${encodeURIComponent(data.chatId)}`,
    ),
  );

export const sendWhatsAppChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { chatId: string; text: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<{ provider: "openwa"; chatId: string; messageId: string | null }>(
      context.accessToken,
      "/v1/whatsapp/chat/messages",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  );

export const listWhatsAppMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string }) => data)
  .handler(({ data, context }) =>
    backendRequest<WhatsAppMessage[]>(
      context.accessToken,
      `/v1/whatsapp/messages?phone=${encodeURIComponent(data.phone)}`,
    ),
  );
