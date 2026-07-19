import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import { supabase } from "./supabase.js";

type StoredConnection = {
  user_id: string;
  session_id: string;
  session_name: string;
  status: string;
  phone: string | null;
  push_name: string | null;
  connected_at: string | null;
  last_error: string | null;
};

type OpenwaSession = {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  pushName: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

export type OpenwaConnection = {
  sessionId: string;
  sessionName: string;
  phone: string | null;
  pushName: string | null;
};

export type OpenwaGatewayStatus = {
  configured: boolean;
  reachable: boolean;
  /**
   * The gateway is online, but its persisted session disappeared. This can
   * happen after a gateway replacement and is safe to repair by creating a
   * fresh, owner-scoped QR session.
   */
  connectionMissing: boolean;
  sessionReady: boolean | null;
  sessionStatus: string | null;
  message: string;
  connection: OpenwaConnection | null;
};

export type OpenwaChatMessage = {
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

export type OpenwaContact = {
  id: string;
  name: string | null;
  phone: string | null;
  isMyContact: boolean;
};

export type OpenwaChat = {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number | null;
  lastMessage: string | null;
};

export type OpenwaProfilePicture = {
  url: string | null;
};

function normalizedPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // MarryMap is India-first. Preserve all other international numbers as supplied.
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  if (!/^\d{8,15}$/.test(digits)) {
    throw new AppError(
      "Enter a WhatsApp number with a valid country code.",
      400,
      "invalid_phone",
    );
  }
  return digits;
}

function isConfigured() {
  return Boolean(config.OPENWA_BASE_URL && config.OPENWA_API_KEY);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function responseRecord(body: unknown): Record<string, unknown> | null {
  const record = asRecord(body);
  if (!record) return null;
  return asRecord(record.data) ?? record;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function chatId(value: string): string {
  const normalized = value.trim();
  if (
    !/^[^/\s]{1,180}@(c\.us|g\.us|lid|broadcast|newsletter)$/.test(normalized)
  ) {
    throw new AppError(
      "This WhatsApp conversation cannot be opened.",
      400,
      "invalid_chat_id",
    );
  }
  return normalized;
}

function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function openwaSession(body: unknown): OpenwaSession {
  const record = responseRecord(body);
  const id = stringValue(record?.id);
  const name = stringValue(record?.name);
  const status = stringValue(record?.status);
  if (!id || !name || !status) {
    throw new AppError(
      "OpenWA returned an invalid session response.",
      502,
      "openwa_invalid_response",
    );
  }
  return {
    id,
    name,
    status: status.toLowerCase(),
    phone: stringValue(record?.phone),
    pushName: stringValue(record?.pushName),
    connectedAt: stringValue(record?.connectedAt),
    lastError: stringValue(record?.lastError),
  };
}

function sessionReady(status: string) {
  // Exact upstream OpenWA SessionStatus values, verified against its OpenAPI.
  if (status === "ready") return true;
  if (
    [
      "created",
      "initializing",
      "qr_ready",
      "authenticating",
      "disconnected",
      "failed",
    ].includes(status)
  ) {
    return false;
  }
  return null;
}

function connectionFrom(
  row: StoredConnection | OpenwaSession,
): OpenwaConnection {
  if ("session_id" in row) {
    return {
      sessionId: row.session_id,
      sessionName: row.session_name,
      phone: row.phone,
      pushName: row.push_name,
    };
  }
  return {
    sessionId: row.id,
    sessionName: row.name,
    phone: row.phone,
    pushName: row.pushName,
  };
}

function sessionMessage(status: string, lastError: string | null) {
  if (status === "ready")
    return "Your WhatsApp account is connected and ready to send.";
  if (status === "qr_ready")
    return "Scan the QR code with WhatsApp to finish connecting.";
  if (status === "authenticating")
    return "WhatsApp is confirming the connection. This usually takes a moment.";
  if (status === "initializing" || status === "created") {
    return "Preparing your private WhatsApp session. Refresh in a moment to get the QR code.";
  }
  if (status === "disconnected")
    return "Your WhatsApp session is disconnected. Reconnect and scan the QR code.";
  if (status === "failed")
    return lastError ?? "OpenWA could not start this WhatsApp session.";
  return "OpenWA is reachable. Its session state was not recognized, so sending will be checked by OpenWA.";
}

function openwaFailureMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return "OpenWA rejected the API key. Use a server-only OpenWA OPERATOR key and restart the API.";
  }
  if (status === 404) {
    return "The private OpenWA session was not found. Connect WhatsApp again to create a new session.";
  }

  const record = responseRecord(body);
  const upstream = [record?.message, record?.error, record?.detail]
    .flatMap((value) =>
      typeof value === "string" ? [value] : Array.isArray(value) ? value : [],
    )
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (
    upstream &&
    /(qr|scan|connect|logout|not ready|not running|disconnected)/i.test(
      upstream,
    )
  ) {
    return "Your WhatsApp session is not connected. Scan the QR code in MarryMap, then try again.";
  }
  if (upstream && /(invalid|not registered|not on whatsapp|chat.*not found|recipient)/i.test(upstream)) {
    return "This contact could not be reached on WhatsApp. Check the saved phone number and try again.";
  }
  if (upstream && /(rate limit|too many|throttl)/i.test(upstream)) {
    return "WhatsApp is temporarily limiting sends. Wait a moment, then try again.";
  }
  return "OpenWA could not complete this request. Check that the WhatsApp session is connected, then try again.";
}

async function gatewayFetch(path: string, init?: RequestInit) {
  if (!isConfigured()) {
    throw new AppError(
      "OpenWA is not configured. Add OPENWA_BASE_URL and OPENWA_API_KEY to the API environment.",
      503,
      "whatsapp_not_configured",
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.OPENWA_BASE_URL!.replace(/\/$/, "")}/api/${path.replace(/^\//, "")}`,
      {
        ...init,
        headers: {
          "x-api-key": config.OPENWA_API_KEY!,
          ...init?.headers,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new AppError(
      "Could not reach the OpenWA gateway. Start OpenWA, then try again.",
      502,
      "whatsapp_unavailable",
    );
  }

  const body = (await response.json().catch(() => null)) as unknown;
  return { response, body };
}

async function openwaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { response, body } = await gatewayFetch(path, init);
  if (!response.ok) {
    throw new AppError(
      openwaFailureMessage(response.status, body),
      502,
      response.status === 404
        ? "openwa_session_not_found"
        : "openwa_request_failed",
    );
  }
  return body as T;
}

async function findConnection(
  ownerId: string,
): Promise<StoredConnection | null> {
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select(
      "user_id, session_id, session_name, status, phone, push_name, connected_at, last_error",
    )
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) {
    throw new AppError(
      "WhatsApp connection storage is unavailable. Apply the latest Supabase migration.",
      500,
      error.code ?? "database_error",
    );
  }
  return (data as StoredConnection | null) ?? null;
}

async function storeConnection(
  ownerId: string,
  session: OpenwaSession,
): Promise<StoredConnection> {
  const payload = {
    user_id: ownerId,
    session_id: session.id,
    session_name: session.name,
    status: session.status,
    phone: session.phone,
    push_name: session.pushName,
    connected_at: session.connectedAt,
    last_error: session.lastError,
  };
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .upsert(payload, { onConflict: "user_id" })
    .select(
      "user_id, session_id, session_name, status, phone, push_name, connected_at, last_error",
    )
    .single();
  if (error) {
    throw new AppError(error.message, 500, error.code ?? "database_error");
  }
  return data as StoredConnection;
}

async function fetchSession(sessionId: string) {
  return openwaSession(
    await openwaRequest<unknown>(`sessions/${encodeURIComponent(sessionId)}`),
  );
}

async function updateSessionFromGateway(ownerId: string, sessionId: string) {
  const session = await fetchSession(sessionId);
  await storeConnection(ownerId, session);
  return session;
}

async function startSessionIfNeeded(ownerId: string, session: OpenwaSession) {
  if (!["created", "disconnected", "failed"].includes(session.status))
    return session;

  const started = openwaSession(
    await openwaRequest<unknown>(
      `sessions/${encodeURIComponent(session.id)}/start`,
      {
        method: "POST",
      },
    ),
  );
  await storeConnection(ownerId, started);
  return started;
}

function statusForSession(session: OpenwaSession): OpenwaGatewayStatus {
  return {
    configured: true,
    reachable: true,
    connectionMissing: false,
    sessionReady: sessionReady(session.status),
    sessionStatus: session.status,
    message: sessionMessage(session.status, session.lastError),
    connection: connectionFrom(session),
  };
}

/**
 * The browser calls this through MarryMap's authenticated API. It never sees
 * the upstream OpenWA key and can only learn about its own mapped session.
 */
export async function getOpenwaStatus(
  ownerId: string,
): Promise<OpenwaGatewayStatus> {
  if (!isConfigured()) {
    return {
      configured: false,
      reachable: false,
      connectionMissing: false,
      sessionReady: false,
      sessionStatus: null,
      message:
        "OpenWA is not configured. You can still open WhatsApp directly.",
      connection: null,
    };
  }

  const connection = await findConnection(ownerId);
  if (!connection) {
    try {
      await openwaRequest<unknown>("sessions?limit=1");
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        connectionMissing: false,
        sessionReady: false,
        sessionStatus: null,
        message:
          error instanceof Error
            ? error.message
            : "OpenWA could not be reached.",
        connection: null,
      };
    }
    return {
      configured: true,
      reachable: true,
      connectionMissing: false,
      sessionReady: false,
      sessionStatus: null,
      message:
        "Connect your WhatsApp account to create a private messaging session.",
      connection: null,
    };
  }

  try {
    return statusForSession(
      await updateSessionFromGateway(ownerId, connection.session_id),
    );
  } catch (error) {
    const connectionMissing =
      error instanceof AppError && error.code === "openwa_session_not_found";
    return {
      configured: true,
      // A 404 for this owner's session proves the gateway answered the
      // request. Treat it as a recoverable missing session rather than a
      // gateway outage so the UI can offer Reconnect WhatsApp immediately.
      reachable: connectionMissing,
      connectionMissing,
      sessionReady: false,
      sessionStatus: connectionMissing ? "missing" : connection.status,
      message:
        error instanceof Error ? error.message : "OpenWA could not be reached.",
      connection: connectionFrom(connection),
    };
  }
}

export async function connectOpenwa(
  ownerId: string,
): Promise<OpenwaGatewayStatus> {
  if (!isConfigured()) {
    throw new AppError(
      "OpenWA is not configured. Add OPENWA_BASE_URL and OPENWA_API_KEY to the API environment.",
      503,
      "whatsapp_not_configured",
    );
  }

  const existing = await findConnection(ownerId);
  if (existing) {
    try {
      const current = await fetchSession(existing.session_id);
      return statusForSession(await startSessionIfNeeded(ownerId, current));
    } catch (error) {
      if (
        !(error instanceof AppError) ||
        error.code !== "openwa_session_not_found"
      )
        throw error;
      // A deleted upstream session is safe to replace; the user still owns the
      // same MarryMap connection row because `user_id` is unique.
    }
  }

  const name = `marrymap-${ownerId.slice(0, 8)}-${Date.now().toString(36)}`;
  const created = openwaSession(
    await openwaRequest<unknown>("sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  const started = openwaSession(
    await openwaRequest<unknown>(
      `sessions/${encodeURIComponent(created.id)}/start`,
      {
        method: "POST",
      },
    ),
  );
  await storeConnection(ownerId, started);
  return statusForSession(started);
}

export async function getOpenwaQr(ownerId: string) {
  const connection = await findConnection(ownerId);
  if (!connection) {
    throw new AppError(
      "Connect your WhatsApp account first.",
      404,
      "whatsapp_connection_missing",
    );
  }
  let session = await updateSessionFromGateway(ownerId, connection.session_id);
  session = await startSessionIfNeeded(ownerId, session);
  if (sessionReady(session.status) === true)
    return { qrCode: null, status: session.status };

  const { response, body } = await gatewayFetch(
    `sessions/${encodeURIComponent(session.id)}/qr`,
  );
  // OpenWA returns 400 while its engine is still producing a QR code. Do not
  // hide other 400 responses: they indicate a real session problem the UI
  // needs to show to the user.
  const record = responseRecord(body);
  const upstreamMessage = [record?.message, record?.error, record?.detail].find(
    (value): value is string => typeof value === "string",
  );
  if (
    response.status === 400 &&
    /QR code is not ready yet/i.test(upstreamMessage ?? "")
  ) {
    return { qrCode: null, status: session.status };
  }
  if (!response.ok) {
    throw new AppError(
      openwaFailureMessage(response.status, body),
      502,
      "openwa_request_failed",
    );
  }
  return {
    qrCode: stringValue(record?.qrCode),
    status: stringValue(record?.status) ?? session.status,
  };
}

async function readySession(ownerId: string) {
  const connection = await findConnection(ownerId);
  if (!connection) {
    throw new AppError(
      "Connect your WhatsApp account before sending messages.",
      409,
      "whatsapp_connection_missing",
    );
  }
  const session = await updateSessionFromGateway(
    ownerId,
    connection.session_id,
  );
  if (sessionReady(session.status) !== true) {
    throw new AppError(
      sessionMessage(session.status, session.lastError),
      409,
      "whatsapp_session_not_ready",
    );
  }
  return session;
}

function normalizeMessages(body: unknown): OpenwaChatMessage[] {
  const record = responseRecord(body);
  const items = Array.isArray(body)
    ? body
    : Array.isArray(record?.messages)
      ? record.messages
      : Array.isArray(record?.data)
        ? record.data
        : [];

  return items.flatMap((item, index) => {
    const message = asRecord(item);
    if (!message) return [];
    const id =
      stringValue(message.id) ??
      stringValue(message.waMessageId) ??
      `openwa-${index}`;
    const rawDirection = stringValue(message.direction)?.toLowerCase();
    const direction =
      rawDirection === "incoming"
        ? "incoming"
        : rawDirection === "outgoing" || message.fromMe === true
          ? "outgoing"
          : "incoming";
    return [
      {
        id,
        messageId:
          stringValue(message.waMessageId) ??
          stringValue(message.messageId) ??
          stringValue(message.id),
        chatId: stringValue(message.chatId) ?? "",
        body: stringValue(message.body) ?? "[Media message]",
        direction,
        status: stringValue(message.status) ?? "sent",
        type: stringValue(message.type) ?? "text",
        timestamp:
          typeof message.timestamp === "number" ? message.timestamp : null,
        createdAt: stringValue(message.createdAt),
      },
    ];
  });
}

export async function listOpenwaMessages(ownerId: string, phone: string) {
  const session = await readySession(ownerId);
  const chatId = `${normalizedPhone(phone)}@c.us`;
  return listMessagesForChat(session, chatId);
}

async function listMessagesForChat(session: OpenwaSession, chatId: string) {
  const storedBody = await openwaRequest<unknown>(
    `sessions/${encodeURIComponent(session.id)}/messages?chatId=${encodeURIComponent(chatId)}&limit=100`,
  );
  const storedMessages = normalizeMessages(storedBody);

  // The stored gateway log begins when OpenWA is connected. Load WhatsApp's
  // own recent history too, so users can see messages that existed beforehand.
  // Some engines do not support live history; retaining the stored log is a
  // better experience than failing the entire inbox in that case.
  let liveMessages: OpenwaChatMessage[] = [];
  let liveHistoryError: unknown = null;
  try {
    const historyBody = await openwaRequest<unknown>(
      `sessions/${encodeURIComponent(session.id)}/messages/${encodeURIComponent(chatId)}/history?limit=100`,
    );
    liveMessages = normalizeMessages(historyBody);
  } catch (error) {
    // Live history is best-effort (for example, it is unsupported by Baileys).
    liveHistoryError = error;
  }

  // Never present a gateway failure as an empty conversation. If OpenWA has
  // not stored anything locally yet and its live-history call fails, let the
  // inbox show a retryable error instead of incorrectly saying there are no
  // messages in the selected chat.
  if (storedMessages.length === 0 && liveHistoryError) {
    throw new AppError(
      "WhatsApp could not load this chat's history. Refresh and try again in a moment.",
      502,
      "whatsapp_history_unavailable",
    );
  }

  const merged = new Map<string, OpenwaChatMessage>();
  for (const message of [...storedMessages, ...liveMessages]) {
    const key = message.messageId ?? message.id;
    // Live history carries the original WhatsApp message ID and should win
    // when both sources describe the same message.
    merged.set(key, message);
  }
  return [...merged.values()];
}

/** Lists the linked account's recent chats, sorted by WhatsApp activity. */
export async function listOpenwaChats(ownerId: string): Promise<OpenwaChat[]> {
  const session = await readySession(ownerId);
  const body = await openwaRequest<unknown>(
    `sessions/${encodeURIComponent(session.id)}/chats?limit=250`,
  );
  const record = asRecord(body);
  const chats = Array.isArray(body)
    ? body
    : Array.isArray(record?.data)
      ? record.data
      : [];

  return chats.flatMap((item) => {
    const chat = asRecord(item);
    const id = stringValue(chat?.id);
    if (!id) return [];
    return [
      {
        id,
        name: stringValue(chat?.name) ?? id,
        isGroup: chat?.isGroup === true,
        unreadCount:
          typeof chat?.unreadCount === "number" && chat.unreadCount > 0
            ? Math.floor(chat.unreadCount)
            : 0,
        timestamp: typeof chat?.timestamp === "number" ? chat.timestamp : null,
        lastMessage: stringValue(chat?.lastMessage),
      },
    ];
  });
}

/** Loads a conversation using the exact chat ID returned by the linked account. */
export async function listOpenwaChatMessages(ownerId: string, value: string) {
  const session = await readySession(ownerId);
  return listMessagesForChat(session, chatId(value));
}

/**
 * Returns the people synced from the owner's linked WhatsApp account. Contact
 * data remains scoped to that owner's private OpenWA session.
 */
export async function listOpenwaContacts(
  ownerId: string,
): Promise<OpenwaContact[]> {
  const session = await readySession(ownerId);
  const body = await openwaRequest<unknown>(
    `sessions/${encodeURIComponent(session.id)}/contacts?limit=1000`,
  );
  const record = asRecord(body);
  const contacts = Array.isArray(body)
    ? body
    : Array.isArray(record?.data)
      ? record.data
      : [];

  // OpenWA can return the same person twice: once with the WhatsApp chat ID
  // and once with a phone-number variant. The canonical chat ID is stable, so
  // keep a single merged contact for each ID before returning it to the UI.
  const uniqueContacts = new Map<string, OpenwaContact>();
  for (const item of contacts) {
    const contact = asRecord(item);
    const id = stringValue(contact?.id);
    if (!id || contact?.isBlocked === true) continue;

    const chatPhone = id.endsWith("@c.us")
      ? id.slice(0, id.length - "@c.us".length)
      : null;
    const candidate: OpenwaContact = {
      id,
      name:
        stringValue(contact?.name) ??
        stringValue(contact?.pushName) ??
        stringValue(contact?.pushname),
      // The ID is the reliable E.164-like number. OpenWA's raw `number`
      // field can be a duplicated or stale display value.
      phone:
        chatPhone && /^\d{8,16}$/.test(chatPhone)
          ? chatPhone
          : stringValue(contact?.number),
      isMyContact: contact?.isMyContact === true,
    };
    const existing = uniqueContacts.get(id);
    uniqueContacts.set(id, {
      id,
      name: candidate.name ?? existing?.name ?? null,
      phone: candidate.phone ?? existing?.phone ?? null,
      isMyContact: candidate.isMyContact || existing?.isMyContact || false,
    });
  }

  return [...uniqueContacts.values()];
}

/** Gets a direct contact's WhatsApp profile photo without exposing OpenWA credentials. */
export async function getOpenwaProfilePicture(
  ownerId: string,
  value: string,
): Promise<OpenwaProfilePicture> {
  const contactId = chatId(value);
  if (contactId.endsWith("@g.us")) return { url: null };

  const session = await readySession(ownerId);
  try {
    const body = await openwaRequest<unknown>(
      `sessions/${encodeURIComponent(session.id)}/contacts/${encodeURIComponent(contactId)}/profile-picture`,
    );
    const url = stringValue(responseRecord(body)?.url);
    return { url: isSafeImageUrl(url) ? url : null };
  } catch (error) {
    // Profile images are optional and can be hidden by a contact's privacy
    // settings. The rest of the profile must remain available.
    if (error instanceof AppError && [400, 404].includes(error.statusCode)) {
      return { url: null };
    }
    throw error;
  }
}

async function sendTextToChat(
  ownerId: string,
  session: OpenwaSession,
  chatId: string,
  text: string,
) {
  let body: unknown;
  try {
    body = await openwaRequest<unknown>(
      `sessions/${encodeURIComponent(session.id)}/messages/send-text`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, text }),
      },
    );
  } catch (error) {
    // A WhatsApp account can disconnect after the UI has already checked its
    // session. Re-read and persist the state so the next screen tells the
    // couple to reconnect instead of reporting an unexplained send failure.
    if (error instanceof AppError && error.code === "openwa_request_failed") {
      const refreshed = await updateSessionFromGateway(ownerId, session.id);
      if (sessionReady(refreshed.status) !== true) {
        throw new AppError(
          sessionMessage(refreshed.status, refreshed.lastError),
          409,
          "whatsapp_session_not_ready",
        );
      }
    }
    throw error;
  }
  const record = responseRecord(body);
  return {
    provider: "openwa" as const,
    chatId,
    messageId: stringValue(record?.messageId) ?? stringValue(record?.id),
  };
}

/** Sends only after an authenticated user explicitly approves the message. */
export async function sendOpenwaText(
  ownerId: string,
  phone: string,
  text: string,
) {
  const session = await readySession(ownerId);
  const chatId = `${normalizedPhone(phone)}@c.us`;
  return sendTextToChat(ownerId, session, chatId, text);
}

/** Sends to a selected personal or group chat using its OpenWA-issued ID. */
export async function sendOpenwaChatText(
  ownerId: string,
  value: string,
  text: string,
) {
  const session = await readySession(ownerId);
  return sendTextToChat(ownerId, session, chatId(value), text);
}
