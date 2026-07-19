import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  connectWhatsApp,
  getWhatsAppGatewayStatus,
  getWhatsAppProfilePicture,
  getWhatsAppQr,
  listWhatsAppChatMessages,
  listWhatsAppChats,
  listWhatsAppContacts,
  listWhatsAppMessages,
  sendWhatsAppChatMessage,
  sendWhatsAppMessage,
} from "@/lib/communication.functions";
import type { WhatsAppContact } from "@/lib/communication.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listVendors } from "@/lib/planner.functions";
import { cn } from "@/lib/utils";
import { vendorWhatsAppMessage, whatsappChatUrl } from "@/lib/whatsapp";
import { VoiceOutreachPanel } from "@/components/messages/voice-outreach-panel";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
});

type Vendor = Awaited<ReturnType<typeof listVendors>>[number];

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatChatTime(timestamp: number | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const isToday = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    undefined,
    isToday ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" },
  ).format(date);
}

function WhatsAppAvatar({
  label,
  isGroup,
  photoUrl,
  className,
  iconClassName,
  initialsClassName,
}: {
  label: string;
  isGroup: boolean;
  photoUrl?: string | null;
  className: string;
  iconClassName: string;
  initialsClassName: string;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full",
        className,
      )}
    >
      {isGroup ? (
        <UsersRound className={iconClassName} />
      ) : (
        <span className={initialsClassName}>{initials(label)}</span>
      )}
      {!isGroup && photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => event.currentTarget.remove()}
        />
      ) : null}
    </div>
  );
}

function MessagesPage() {
  const listFn = useServerFn(listVendors);
  const gatewayFn = useServerFn(getWhatsAppGatewayStatus);
  const connectFn = useServerFn(connectWhatsApp);
  const qrFn = useServerFn(getWhatsAppQr);
  const contactsFn = useServerFn(listWhatsAppContacts);
  const chatsFn = useServerFn(listWhatsAppChats);
  const chatMessagesFn = useServerFn(listWhatsAppChatMessages);
  const profilePictureFn = useServerFn(getWhatsAppProfilePicture);
  const messagesFn = useServerFn(listWhatsAppMessages);
  const sendChatFn = useServerFn(sendWhatsAppChatMessage);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const queryClient = useQueryClient();
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [workspace, setWorkspace] = useState<"messages" | "calls">("messages");
  const [peopleLimit, setPeopleLimit] = useState(50);
  const [qrOpen, setQrOpen] = useState(false);
  // Keep the session returned by Connect WhatsApp until the QR dialog closes.
  // This prevents a stale gateway-status cache from requesting a QR code for a
  // deleted session after the API has already created its replacement.
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listFn() });
  const gatewayQuery = useQuery({
    queryKey: ["whatsapp-gateway"],
    queryFn: () => gatewayFn(),
    staleTime: 60_000,
  });

  const send = useMutation({
    mutationFn: ({ phone, text }: { phone: string; text: string }) =>
      sendFn({ data: { phone, text } }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      toast.success("Sent through WhatsApp");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connect = useMutation({
    mutationFn: () => connectFn({ data: undefined }),
    onSuccess: (connection) => {
      queryClient.setQueryData(["whatsapp-gateway"], connection);
      setQrSessionId(connection.connection?.sessionId ?? null);
      setQrOpen(Boolean(connection.connection));
      void gatewayQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const vendors = useMemo(() => vendorsQuery.data ?? [], [vendorsQuery.data]);
  const contactableVendors = useMemo(
    () => vendors.filter((vendor) => vendor.contact_phone || vendor.contact_email),
    [vendors],
  );
  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contactableVendors;
    return contactableVendors.filter((vendor) =>
      [vendor.name, vendor.category, vendor.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [contactableVendors, search]);
  const activeVendor =
    contactableVendors.find((vendor) => vendor.id === activeVendorId) ??
    contactableVendors.find((vendor) => vendor.contact_phone) ??
    contactableVendors[0];
  const defaultDraft = activeVendor ? vendorWhatsAppMessage(activeVendor.name) : "";
  const messageText = draft.trim() || defaultDraft;
  const whatsappUrl = activeVendor?.contact_phone
    ? whatsappChatUrl(activeVendor.contact_phone, messageText)
    : null;
  const gateway = gatewayQuery.data;
  const openwaReady = Boolean(
    gateway?.configured && gateway.reachable && gateway.sessionReady !== false,
  );
  const connectionMissing = Boolean(gateway?.connectionMissing);
  const gatewayNeedsAttention = Boolean(gateway?.configured && !openwaReady);
  const gatewayUnavailable = Boolean(
    gateway?.configured && !gateway.reachable && !connectionMissing,
  );
  const activeQrSessionId = qrSessionId ?? gateway?.connection?.sessionId ?? null;
  const qrGatewayReachable = Boolean(qrSessionId || gateway?.reachable);
  const contactsQuery = useQuery({
    queryKey: ["whatsapp-contacts", gateway?.connection?.sessionId],
    queryFn: () => contactsFn(),
    enabled: openwaReady,
    staleTime: 60_000,
  });
  const chatsQuery = useQuery({
    queryKey: ["whatsapp-chats", gateway?.connection?.sessionId],
    queryFn: () => chatsFn(),
    enabled: openwaReady,
    staleTime: 30_000,
    refetchInterval: openwaReady ? 30_000 : false,
  });
  const contacts = contactsQuery.data;
  const whatsappPeople = useMemo(() => {
    const uniquePeople = new Map<string, WhatsAppContact>();
    for (const person of contacts ?? []) {
      const existing = uniquePeople.get(person.id);
      uniquePeople.set(person.id, {
        id: person.id,
        name: person.name ?? existing?.name ?? null,
        phone: person.phone ?? existing?.phone ?? null,
        isMyContact: person.isMyContact || existing?.isMyContact || false,
      });
    }
    return [...uniquePeople.values()];
  }, [contacts]);
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return whatsappPeople.filter((person) => {
      if (!query) return true;
      return [person.name, person.phone, person.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search, whatsappPeople]);
  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (chatsQuery.data ?? []).filter((chat) => {
      if (!query) return true;
      return [chat.name, chat.lastMessage, chat.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [chatsQuery.data, search]);
  const activeChat = (chatsQuery.data ?? []).find((chat) => chat.id === activeChatId) ?? null;
  const activeContact = whatsappPeople.find((contact) => contact.id === activeChatId) ?? null;
  const activeInboxTarget = activeChat
    ? {
        id: activeChat.id,
        name: activeChat.name,
        isGroup: activeChat.isGroup,
        unreadCount: activeChat.unreadCount,
        timestamp: activeChat.timestamp,
        lastMessage: activeChat.lastMessage,
      }
    : activeContact
      ? {
          id: activeContact.id,
          name: activeContact.name ?? activeContact.phone ?? "WhatsApp contact",
          isGroup: false,
          unreadCount: 0,
          timestamp: null,
          lastMessage: null,
        }
      : null;
  const chatMessagesQuery = useQuery({
    queryKey: ["whatsapp-chat-messages", activeInboxTarget?.id],
    queryFn: () => chatMessagesFn({ data: { chatId: activeInboxTarget!.id } }),
    enabled: Boolean(openwaReady && activeInboxTarget),
    staleTime: 5_000,
    refetchInterval: openwaReady && activeInboxTarget ? 15_000 : false,
  });
  const profilePictureQuery = useQuery({
    queryKey: ["whatsapp-profile-picture", activeInboxTarget?.id],
    queryFn: () => profilePictureFn({ data: { chatId: activeInboxTarget!.id } }),
    enabled: Boolean(openwaReady && activeInboxTarget && !activeInboxTarget.isGroup),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const profilePictureUrl = profilePictureQuery.data?.url ?? null;
  const inboxMessages = useMemo(
    () =>
      [...(chatMessagesQuery.data ?? [])].sort((first, second) => {
        const firstCreatedAt = Date.parse(first.createdAt ?? "");
        const secondCreatedAt = Date.parse(second.createdAt ?? "");
        const firstTime = first.timestamp ?? (Number.isFinite(firstCreatedAt) ? firstCreatedAt : 0);
        const secondTime =
          second.timestamp ?? (Number.isFinite(secondCreatedAt) ? secondCreatedAt : 0);
        return firstTime - secondTime;
      }),
    [chatMessagesQuery.data],
  );
  const chatSend = useMutation({
    mutationFn: ({ chatId, text }: { chatId: string; text: string }) =>
      sendChatFn({ data: { chatId, text } }),
    onSuccess: () => {
      setChatDraft("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-messages"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-chats"] });
      toast.success("Sent through WhatsApp");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const connectionLabel = openwaReady
    ? "WhatsApp connected"
    : gateway?.configured
      ? connectionMissing
        ? "Reconnect WhatsApp"
        : gatewayUnavailable
        ? "WhatsApp unavailable"
        : gateway?.connection
          ? "Continue WhatsApp setup"
          : "Connect WhatsApp"
      : "Set up WhatsApp";
  const connectionAction = () => {
    if (!gateway?.configured) {
      setSetupOpen(true);
      return;
    }
    // The API has confirmed that the gateway is online but the old session is
    // gone. connectOpenwa replaces the stale owner mapping and opens a fresh
    // QR code; showing the old QR would only repeat the 404.
    if (connectionMissing) {
      connect.mutate();
      return;
    }
    if (gatewayUnavailable) {
      setSetupOpen(true);
      return;
    }
    if (!openwaReady) connect.mutate();
  };
  const conversationQuery = useQuery({
    queryKey: ["whatsapp-messages", activeVendor?.id, activeVendor?.contact_phone],
    queryFn: () => messagesFn({ data: { phone: activeVendor!.contact_phone! } }),
    enabled: Boolean(activeVendor?.contact_phone && openwaReady),
    staleTime: 10_000,
    refetchInterval: openwaReady ? 15_000 : false,
  });
  const qrQuery = useQuery({
    queryKey: ["whatsapp-qr", activeQrSessionId],
    queryFn: () => qrFn(),
    enabled: qrOpen && Boolean(activeQrSessionId && qrGatewayReachable),
    staleTime: 0,
    retry: 1,
    refetchInterval: qrOpen && qrGatewayReachable ? 3_000 : false,
  });
  const conversation = useMemo(
    () =>
      [...(conversationQuery.data ?? [])].sort((first, second) => {
        const firstCreatedAt = Date.parse(first.createdAt ?? "");
        const secondCreatedAt = Date.parse(second.createdAt ?? "");
        const firstTime = first.timestamp ?? (Number.isFinite(firstCreatedAt) ? firstCreatedAt : 0);
        const secondTime =
          second.timestamp ?? (Number.isFinite(secondCreatedAt) ? secondCreatedAt : 0);
        return firstTime - secondTime;
      }),
    [conversationQuery.data],
  );

  const openWhatsApp = () => {
    if (!whatsappUrl) {
      toast.error("Add a WhatsApp number to this vendor first.");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const sendDefault = () => {
    if (!activeVendor?.contact_phone) {
      toast.error("This vendor does not have a WhatsApp number.");
      return;
    }
    if (gatewayNeedsAttention) {
      toast.error(gateway?.message ?? "OpenWA needs attention before it can send.");
      return;
    }
    if (!gateway?.configured) {
      openWhatsApp();
      return;
    }
    send.mutate({ phone: activeVendor.contact_phone, text: messageText });
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!activeInboxTarget || !text) return;
    chatSend.mutate({ chatId: activeInboxTarget.id, text });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col space-y-4 p-6 lg:p-8">
      <PageHeader
        eyebrow="Messages"
        title="Vendor communication"
        subtitle="WhatsApp is the default. Calls and email stay available as fallbacks."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" /> WhatsApp first
          </span>
        }
        action={
          <Button
            type="button"
            variant={openwaReady ? "outline" : "default"}
            onClick={connectionAction}
            disabled={connect.isPending}
            className={cn(
              "min-h-11 gap-2 rounded-full px-4",
              !openwaReady && "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {connect.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : openwaReady ? (
              <CircleCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {connectionLabel}
          </Button>
        }
      />

      <div
        className="flex shrink-0 items-center gap-2"
        role="tablist"
        aria-label="Communication workspace"
      >
        <Button
          type="button"
          size="sm"
          variant={workspace === "messages" ? "default" : "outline"}
          onClick={() => setWorkspace("messages")}
          role="tab"
          aria-selected={workspace === "messages"}
          className={cn(
            "min-h-11 rounded-full",
            workspace === "messages" && "bg-emerald-600 text-white hover:bg-emerald-700",
          )}
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp inbox
        </Button>
        <Button
          type="button"
          size="sm"
          variant={workspace === "calls" ? "default" : "outline"}
          onClick={() => setWorkspace("calls")}
          role="tab"
          aria-selected={workspace === "calls"}
          className={cn(
            "min-h-11 rounded-full",
            workspace === "calls" && "bg-violet-600 text-white hover:bg-violet-700",
          )}
        >
          <Phone className="h-4 w-4" /> Availability calls
        </Button>
      </div>

      {workspace === "calls" ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <VoiceOutreachPanel vendors={vendors} />
        </div>
      ) : (
        <div className="soft-card flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-full shrink-0 flex-col border-b border-border lg:w-80 lg:border-r lg:border-b-0">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people or vendors…"
                  className="h-9 w-full rounded-lg bg-secondary pl-9 pr-3 text-[13px] outline-hidden"
                />
              </div>
            </div>
            <div className="max-h-56 flex-1 overflow-y-auto lg:max-h-none">
              {vendorsQuery.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading vendors…</div>
              ) : filteredVendors.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No saved vendor with contact details yet.
                </div>
              ) : (
                filteredVendors.map((vendor) => {
                  const isWhatsapp = Boolean(vendor.contact_phone);
                  const selected = activeVendor?.id === vendor.id;
                  return (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => {
                        setActiveVendorId(vendor.id);
                        setActiveChatId(null);
                        setDraft("");
                      }}
                      className={cn(
                        "w-full border-b border-border/60 p-4 text-left transition-colors hover:bg-secondary/50",
                        selected && "bg-secondary",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-purple-brand/20 text-[11px] font-semibold text-primary">
                            {vendor.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{vendor.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              {isWhatsapp ? (
                                <MessageCircle className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Mail className="h-3 w-3" />
                              )}
                              {isWhatsapp ? "WhatsApp" : "Email fallback"}
                            </p>
                          </div>
                        </div>
                        {isWhatsapp && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
              {openwaReady && (
                <section className="border-t border-border">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent chats
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {chatsQuery.isLoading
                          ? "Syncing conversations…"
                          : `${chatsQuery.data?.length ?? 0} conversations`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void chatsQuery.refetch()}
                      disabled={chatsQuery.isFetching}
                      aria-label="Refresh WhatsApp chats"
                      title="Refresh WhatsApp chats"
                      className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5", chatsQuery.isFetching && "animate-spin")}
                      />
                    </button>
                  </div>
                  {chatsQuery.isLoading ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      Loading recent chats…
                    </div>
                  ) : filteredChats.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      {chatsQuery.data?.length
                        ? "No chats match your search."
                        : "No WhatsApp chats have synced yet. Refresh in a moment."}
                    </div>
                  ) : (
                    filteredChats.slice(0, 100).map((chat) => {
                      const selected = activeInboxTarget?.id === chat.id;
                      return (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => {
                            setActiveChatId(chat.id);
                            setChatDraft("");
                          }}
                          className={cn(
                            "w-full border-t border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                            selected && "bg-emerald-50/70",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                              {chat.isGroup ? (
                                <UsersRound className="h-4 w-4" />
                              ) : (
                                <span className="text-[11px] font-semibold">
                                  {initials(chat.name)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-[13px] font-medium">{chat.name}</p>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatChatTime(chat.timestamp)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {chat.lastMessage ??
                                    (chat.isGroup ? "Group conversation" : "No message preview")}
                                </p>
                                {chat.unreadCount > 0 && (
                                  <span className="grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </section>
              )}
              {openwaReady && (
                <section className="border-t border-border">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        WhatsApp people
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {contactsQuery.isLoading
                          ? "Syncing contacts…"
                          : `${whatsappPeople.length} people in your linked account`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void contactsQuery.refetch()}
                      disabled={contactsQuery.isFetching}
                      aria-label="Refresh WhatsApp people"
                      title="Refresh WhatsApp people"
                      className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5", contactsQuery.isFetching && "animate-spin")}
                      />
                    </button>
                  </div>
                  {contactsQuery.isLoading ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      Loading WhatsApp people…
                    </div>
                  ) : filteredPeople.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      {whatsappPeople.length
                        ? "No people match your search."
                        : "No WhatsApp people have synced yet. Refresh in a moment."}
                    </div>
                  ) : (
                    filteredPeople.slice(0, peopleLimit).map((person) => {
                      const label = person.name ?? person.phone ?? "WhatsApp contact";
                      const selected = activeInboxTarget?.id === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setActiveChatId(person.id);
                            setChatDraft("");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 border-t border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                            selected && "bg-emerald-50/70",
                          )}
                        >
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                            {initials(label)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{label}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MessageCircle className="h-3 w-3 text-emerald-600" />
                              {person.isMyContact
                                ? "Saved WhatsApp contact"
                                : (person.phone ?? "WhatsApp contact")}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                  {filteredPeople.length > peopleLimit && (
                    <div className="border-t border-border/60 px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPeopleLimit((limit) => limit + 50)}
                        className="min-h-11 w-full"
                      >
                        Show 50 more people
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </div>
          </aside>

          {activeInboxTarget ? (
            <section
              className="flex min-w-0 flex-1"
              aria-label={`WhatsApp conversation with ${activeInboxTarget.name}`}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <WhatsAppAvatar
                      label={activeInboxTarget.name}
                      isGroup={activeInboxTarget.isGroup}
                      photoUrl={profilePictureUrl}
                      className="h-10 w-10 bg-emerald-50 text-emerald-700"
                      iconClassName="h-5 w-5"
                      initialsClassName="text-xs font-semibold"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg">{activeInboxTarget.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        {activeInboxTarget.isGroup ? (
                          <UsersRound className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <UserRound className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {activeInboxTarget.isGroup
                          ? "WhatsApp group"
                          : (activeContact?.phone ?? "WhatsApp contact")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void chatMessagesQuery.refetch()}
                    disabled={chatMessagesQuery.isFetching}
                    className="h-11 w-11 shrink-0"
                    aria-label="Refresh selected WhatsApp chat"
                    title="Refresh selected WhatsApp chat"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", chatMessagesQuery.isFetching && "animate-spin")}
                    />
                  </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 sm:p-6">
                  {chatMessagesQuery.isLoading ? (
                    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Loading WhatsApp messages…
                    </div>
                  ) : chatMessagesQuery.isError ? (
                    <div className="m-auto max-w-md text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                        <CircleAlert className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 font-display text-xl">
                        WhatsApp history isn’t available yet
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        WhatsApp has not provided earlier messages for this chat. Messages sent or
                        received while this account is connected will appear here.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void chatMessagesQuery.refetch()}
                        className="mt-4 min-h-11"
                      >
                        <RefreshCw className="h-4 w-4" /> Try again
                      </Button>
                    </div>
                  ) : inboxMessages.length > 0 ? (
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
                      <p className="mb-1 text-center text-xs text-muted-foreground">
                        Private WhatsApp history · refreshes automatically
                      </p>
                      {inboxMessages.map((message) => {
                        const outgoing = message.direction === "outgoing";
                        return (
                          <div
                            key={message.id}
                            className={cn("flex", outgoing ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                outgoing
                                  ? "rounded-br-md bg-emerald-600 text-white"
                                  : "rounded-bl-md bg-secondary text-foreground",
                              )}
                            >
                              <p>{message.body}</p>
                              <div
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1.5 text-[10px] capitalize",
                                  outgoing ? "text-emerald-50/80" : "text-muted-foreground",
                                )}
                              >
                                <span>{formatChatTime(message.timestamp)}</span>
                                <span>{message.status}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="m-auto max-w-md text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 font-display text-xl">No messages in this chat yet</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Send a message below to start this private WhatsApp conversation.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-border p-4">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Message {activeInboxTarget.name}
                  </label>
                  <div className="soft-card flex items-end gap-2 p-2">
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      rows={2}
                      placeholder="Write a WhatsApp message…"
                      className="min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] outline-hidden"
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={!chatDraft.trim() || chatSend.isPending}
                      onClick={sendChatMessage}
                      className="h-11 w-11 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      aria-label="Send selected WhatsApp message"
                      title="Send through WhatsApp"
                    >
                      {chatSend.isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Messages are sent only when you press Send.
                  </p>
                </div>
              </div>

              <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-secondary/20 xl:flex">
                <div className="border-b border-border px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Profile
                  </p>
                </div>
                <div className="space-y-5 p-5">
                  <div className="text-center">
                    <WhatsAppAvatar
                      label={activeInboxTarget.name}
                      isGroup={activeInboxTarget.isGroup}
                      photoUrl={profilePictureUrl}
                      className="mx-auto h-16 w-16 bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-800"
                      iconClassName="h-7 w-7"
                      initialsClassName="text-lg font-semibold"
                    />
                    <h3 className="mt-3 break-words font-display text-xl">
                      {activeInboxTarget.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeInboxTarget.isGroup
                        ? "WhatsApp group conversation"
                        : activeContact?.isMyContact
                          ? "Saved WhatsApp contact"
                          : "WhatsApp contact"}
                    </p>
                  </div>

                  <dl className="space-y-3 rounded-xl border border-border bg-background p-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {activeInboxTarget.isGroup ? "Conversation ID" : "Phone"}
                      </dt>
                      <dd className="mt-1 break-all font-medium text-foreground">
                        {activeInboxTarget.isGroup
                          ? activeInboxTarget.id
                          : (activeContact?.phone ?? activeInboxTarget.id.split("@")[0])}
                      </dd>
                    </div>
                    <div className="border-t border-border pt-3">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Unread messages
                      </dt>
                      <dd className="mt-1 font-medium text-foreground">
                        {activeInboxTarget.unreadCount}
                      </dd>
                    </div>
                    <div className="border-t border-border pt-3">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Last activity
                      </dt>
                      <dd className="mt-1 font-medium text-foreground">
                        {formatChatTime(activeInboxTarget.timestamp) || "Not available"}
                      </dd>
                    </div>
                    <div className="border-t border-border pt-3">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Loaded messages
                      </dt>
                      <dd className="mt-1 font-medium text-foreground">{inboxMessages.length}</dd>
                    </div>
                    {!activeInboxTarget.isGroup && (
                      <div className="border-t border-border pt-3">
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Profile photo
                        </dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {profilePictureQuery.isLoading
                            ? "Loading from WhatsApp…"
                            : profilePictureUrl
                              ? "Loaded from WhatsApp"
                              : "Not shared by this contact"}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </aside>
            </section>
          ) : activeVendor ? (
            <section
              className="flex min-w-0 flex-1 flex-col"
              aria-label={`Message ${activeVendor.name}`}
            >
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg">{activeVendor.name}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    {activeVendor.contact_phone ? (
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    {activeVendor.contact_phone ? "WhatsApp preferred" : "Email fallback only"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {activeVendor.contact_phone && (
                    <a
                      href={`tel:${activeVendor.contact_phone}`}
                      aria-label={`Call ${activeVendor.name}`}
                      className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {activeVendor.contact_email && (
                    <a
                      href={`mailto:${activeVendor.contact_email}`}
                      aria-label={`Email ${activeVendor.name}`}
                      className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
                {openwaReady && activeVendor.contact_phone ? (
                  conversationQuery.isLoading ? (
                    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Loading WhatsApp messages…
                    </div>
                  ) : conversation.length > 0 ? (
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
                      <p className="mb-1 text-center text-xs text-muted-foreground">
                        Private OpenWA conversation · refreshes automatically
                      </p>
                      {conversation.map((message) => {
                        const outgoing = message.direction === "outgoing";
                        return (
                          <div
                            key={message.id}
                            className={cn("flex", outgoing ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                outgoing
                                  ? "rounded-br-md bg-emerald-600 text-white"
                                  : "rounded-bl-md bg-secondary text-foreground",
                              )}
                            >
                              <p>{message.body}</p>
                              <p
                                className={cn(
                                  "mt-1 text-[10px] capitalize",
                                  outgoing ? "text-emerald-50/80" : "text-muted-foreground",
                                )}
                              >
                                {message.status}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="m-auto max-w-md text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 font-display text-xl">Start this conversation</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Your connected OpenWA session has no messages with this vendor yet. Review
                        the draft below to send the first one.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="m-auto max-w-md text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-display text-xl">Start on WhatsApp</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      WhatsApp is selected by default for this vendor. Connect your private OpenWA
                      session below, or open WhatsApp directly with the approved draft.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-border p-4">
                <div
                  className={cn(
                    "mb-3 rounded-xl border px-3 py-2.5",
                    openwaReady
                      ? "border-emerald-600/20 bg-emerald-50/70"
                      : gatewayNeedsAttention
                        ? "border-amber-500/25 bg-amber-50/80"
                        : "border-border bg-secondary/40",
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-2">
                      {openwaReady ? (
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      ) : (
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      )}
                      <div>
                        <p className="text-xs font-semibold">
                          {gatewayQuery.isLoading
                            ? "Checking OpenWA connection…"
                            : openwaReady
                              ? "OpenWA connected"
                              : gateway?.configured
                                ? gateway.connection
                                  ? "OpenWA needs attention"
                                  : "Connect your WhatsApp"
                                : "WhatsApp app fallback"}
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                          {gatewayQuery.isLoading
                            ? "Verifying the connected WhatsApp session before managed sending is enabled."
                            : (gateway?.message ??
                              "Open WhatsApp directly with a pre-filled message while OpenWA is being configured.")}
                        </p>
                      </div>
                    </div>
                    {gateway?.configured && (
                      <div className="flex shrink-0 items-center gap-1">
                        {!gateway.connection ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => connect.mutate()}
                            disabled={connect.isPending || !gateway.reachable}
                            className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            {connect.isPending ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <MessageCircle />
                            )}
                            Connect
                          </Button>
                        ) : !openwaReady ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={connectionAction}
                            disabled={connect.isPending}
                            className="h-11"
                          >
                            {connect.isPending && <LoaderCircle className="animate-spin" />}
                            {connectionMissing ? "Reconnect" : "Show QR"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void gatewayQuery.refetch()}
                          disabled={gatewayQuery.isFetching}
                          className="h-11 w-11"
                          aria-label="Refresh OpenWA connection"
                          title="Refresh OpenWA connection"
                        >
                          <RefreshCw
                            className={cn("h-4 w-4", gatewayQuery.isFetching && "animate-spin")}
                          />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700">
                    <Sparkles className="h-3 w-3" /> WhatsApp draft
                  </div>
                  {[
                    "Could you share your availability and package options?",
                    "Please send your latest quote.",
                    "Can we schedule a short call this week?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setDraft(suggestion)}
                      className="rounded-full border border-border px-2.5 py-1 text-[11.5px] hover:border-emerald-600/35 hover:bg-emerald-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div className="soft-card flex items-end gap-2 p-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    placeholder={defaultDraft}
                    className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] outline-hidden"
                  />
                  <Button
                    type="button"
                    size="icon"
                    disabled={
                      !activeVendor.contact_phone || send.isPending || gatewayQuery.isLoading
                    }
                    onClick={sendDefault}
                    className="h-11 w-11 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    aria-label={
                      openwaReady
                        ? "Send through OpenWA"
                        : gatewayNeedsAttention
                          ? "Show OpenWA connection issue"
                          : "Open WhatsApp"
                    }
                    title={
                      openwaReady
                        ? "Send through OpenWA"
                        : gatewayNeedsAttention
                          ? "Show OpenWA connection issue"
                          : "Open WhatsApp"
                    }
                  >
                    {send.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {openwaReady
                      ? "Send this approved draft through your connected OpenWA account."
                      : gatewayNeedsAttention
                        ? "Resolve the OpenWA connection above, or use WhatsApp directly."
                        : "Opens WhatsApp with your draft — no message is sent automatically."}
                  </span>
                  {whatsappUrl && (
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 hover:underline"
                    >
                      Open WhatsApp <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="No vendor communication yet"
              subtitle="Add a vendor with a WhatsApp number from the Vendors page to start a conversation."
            />
          )}
        </div>
      )}
      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) setQrSessionId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp</DialogTitle>
            <DialogDescription>
              In WhatsApp, open Linked devices, choose Link a device, then scan this private QR
              code.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-64 place-items-center rounded-xl bg-secondary/60 p-5">
            {!qrGatewayReachable ? (
              <div className="max-w-xs text-center text-sm text-muted-foreground">
                <CircleAlert className="mx-auto mb-3 h-7 w-7 text-amber-700" />
                OpenWA is not reachable yet. Start the gateway, then check the connection again.
              </div>
            ) : qrQuery.isError ? (
              <div className="max-w-xs text-center text-sm text-muted-foreground" role="alert">
                <CircleAlert className="mx-auto mb-3 h-7 w-7 text-destructive" />
                <p className="font-medium text-foreground">We could not load a QR code.</p>
                <p className="mt-1.5 leading-relaxed">
                  {qrQuery.error instanceof Error
                    ? qrQuery.error.message
                    : "Check the OpenWA connection and try again."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                >
                  {connect.isPending && <LoaderCircle className="animate-spin" />}
                  Reconnect WhatsApp
                </Button>
              </div>
            ) : qrQuery.isLoading || !qrQuery.data ? (
              <div className="text-center text-sm text-muted-foreground">
                <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />
                Preparing a secure QR code…
              </div>
            ) : qrQuery.data.qrCode ? (
              <img
                src={qrQuery.data.qrCode}
                alt="OpenWA QR code for linking WhatsApp"
                className="h-56 w-56 rounded-lg bg-white p-2"
              />
            ) : qrQuery.data.status === "ready" ? (
              <div className="text-center text-sm text-emerald-700">
                <CircleCheck className="mx-auto mb-3 h-8 w-8" />
                WhatsApp is connected.
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />
                OpenWA is preparing the QR code. Keep this window open.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void qrQuery.refetch()}
              disabled={qrQuery.isFetching || !qrGatewayReachable}
            >
              {qrQuery.isFetching && <LoaderCircle className="animate-spin" />}
              Refresh QR
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await gatewayQuery.refetch();
                if (result.data?.sessionReady) {
                  setQrSessionId(null);
                  setQrOpen(false);
                }
              }}
              disabled={gatewayQuery.isFetching}
            >
              {gatewayQuery.isFetching && <LoaderCircle className="animate-spin" />}I scanned it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set up WhatsApp</DialogTitle>
            <DialogDescription>
              {gateway?.configured
                ? "MarryMap cannot reach the deployed OpenWA gateway right now."
                : "MarryMap needs its private OpenWA gateway before you can connect a WhatsApp account."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-500/20 bg-amber-50/70 p-3 text-sm leading-relaxed text-amber-950">
            <p className="font-semibold">What needs attention</p>
            <p className="mt-1.5 text-amber-900/80">
              {gateway?.message ??
                "Start the local OpenWA gateway, add its server-only connection values, then restart the API."}
            </p>
          </div>
          {gateway?.configured ? (
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>
                <span className="mr-2 font-semibold text-foreground">1.</span>
                Check that the <code>marrymap-openwa</code> Cloud Run service is healthy.
              </li>
              <li>
                <span className="mr-2 font-semibold text-foreground">2.</span>
                Confirm its URL and private API key match <code>OPENWA_BASE_URL</code> and <code>OPENWA_API_KEY</code> on <code>wedding-planner-api</code>.
              </li>
              <li>
                <span className="mr-2 font-semibold text-foreground">3.</span>
                Check the connection again, then reconnect WhatsApp to scan a new QR code.
              </li>
            </ol>
          ) : (
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>
                <span className="mr-2 font-semibold text-foreground">1.</span>
                Deploy a private OpenWA gateway, or start it locally with <code>npm run whatsapp:gateway</code>.
              </li>
              <li>
                <span className="mr-2 font-semibold text-foreground">2.</span>
                Add its server-only URL and operator key to the MarryMap API environment.
              </li>
              <li>
                <span className="mr-2 font-semibold text-foreground">3.</span>
                Check the connection, then scan the QR code from WhatsApp → Linked devices.
              </li>
            </ol>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void gatewayQuery.refetch()}
              disabled={gatewayQuery.isFetching}
              className="min-h-11"
            >
              {gatewayQuery.isFetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Check connection
            </Button>
            <Button type="button" onClick={() => setSetupOpen(false)} className="min-h-11">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
